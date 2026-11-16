import { type EditorExercise, toFinalPayload, toPayload } from '@/lib/workout-editor'

/**
 * Сохранность активной тренировки.
 *
 * Источник истины во время тренировки — черновик на устройстве (localStorage).
 * Каждое изменение сразу записывается в черновик и с небольшой задержкой уходит
 * на сервер целым снимком. Если сети нет — повторяем с нарастающей паузой,
 * при появлении сети и при возврате на вкладку.
 */

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error' | 'auth' | 'gone'
export type FinishResult = 'ok' | 'offline' | 'auth' | 'gone' | 'error'

type Draft = {
  v: 1
  exercises: EditorExercise[]
  /** Название сплита, загруженного в тренировку */
  splitName?: string | null
  /** Есть изменения, которые ещё не дошли до сервера */
  dirty: boolean
  /** updated_at тренировки на сервере на момент последней успешной синхронизации */
  base: string | null
  /** Пользователь нажал «Завершить» и находится на экране итогов */
  finishAt: number | null
}

const PREFIX = 'gymbros:workout-draft:'
const DEBOUNCE_MS = 800
const RETRY_MIN_MS = 3_000
const RETRY_MAX_MS = 60_000

function readDraft(workoutId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + workoutId)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    if (draft?.v !== 1 || !Array.isArray(draft.exercises)) return null
    return draft
  } catch {
    return null
  }
}

function writeDraft(workoutId: string, draft: Draft) {
  try {
    window.localStorage.setItem(PREFIX + workoutId, JSON.stringify(draft))
  } catch {
    // Хранилище недоступно (приватный режим, переполнение) — остаётся серверная синхронизация
  }
}

export function clearDraft(workoutId: string) {
  try {
    window.localStorage.removeItem(PREFIX + workoutId)
  } catch {}
}

/** Черновики прошлых тренировок больше не нужны. */
function pruneDrafts(keepWorkoutId: string) {
  try {
    const stale: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PREFIX) && key !== PREFIX + keepWorkoutId) stale.push(key)
    }
    stale.forEach((key) => window.localStorage.removeItem(key))
  } catch {}
}

export class WorkoutSync {
  readonly initialExercises: EditorExercise[]
  readonly initialFinishAt: number | null
  readonly initialSplitName: string | null

  private exercises: EditorExercise[]
  private splitName: string | null
  private version = 0
  private synced = 0
  private base: string | null
  private finishAt: number | null
  private status: SyncStatus = 'saved'
  private listeners = new Set<() => void>()
  private inFlight = false
  private paused = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private backoff = RETRY_MIN_MS

  constructor(
    private readonly workoutId: string,
    serverUpdatedAt: string,
    serverExercises: EditorExercise[],
    serverSplitName: string | null = null,
  ) {
    pruneDrafts(workoutId)
    const draft = readDraft(workoutId)

    // Черновик берём, если в нём есть неотправленные правки (они важнее) либо если
    // сервер с момента нашей последней синхронизации не менялся. Иначе тренировку
    // правили с другого устройства — берём серверную версию.
    if (draft && (draft.dirty || draft.base === serverUpdatedAt)) {
      this.exercises = draft.exercises
      // В черновиках прежней версии поля нет — тогда берём серверное значение
      this.splitName = draft.splitName === undefined ? serverSplitName : draft.splitName
      this.base = draft.base
      this.finishAt = draft.finishAt ?? null
      if (draft.dirty) {
        this.version = 1
        this.status = 'saving'
      }
    } else {
      this.exercises = serverExercises
      this.splitName = serverSplitName
      this.base = serverUpdatedAt
      this.finishAt = null
    }
    this.initialExercises = this.exercises
    this.initialFinishAt = this.finishAt
    this.initialSplitName = this.splitName
  }

  // --- подписка для useSyncExternalStore -----------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getStatus = () => this.status

  private setStatus(status: SyncStatus) {
    if (this.status === status) return
    this.status = status
    this.listeners.forEach((l) => l())
  }

  // --- изменения ------------------------------------------------------------

  private get dirty() {
    return this.version !== this.synced
  }

  private persist() {
    writeDraft(this.workoutId, {
      v: 1,
      exercises: this.exercises,
      splitName: this.splitName,
      dirty: this.dirty,
      base: this.base,
      finishAt: this.finishAt,
    })
  }

  change(exercises: EditorExercise[], splitName: string | null = this.splitName) {
    this.exercises = exercises
    this.splitName = splitName
    this.version++
    this.persist()
    this.schedule(DEBOUNCE_MS)
  }

  setFinishAt(value: number | null) {
    this.finishAt = value
    this.persist()
  }

  // --- синхронизация ----------------------------------------------------------

  private schedule(ms: number) {
    clearTimeout(this.timer)
    if (this.paused) return
    this.timer = setTimeout(() => void this.run(), ms)
  }

  /** Отправить немедленно (keepalive — запрос переживёт закрытие вкладки). */
  flush(keepalive = false) {
    if (this.dirty && !this.paused) {
      clearTimeout(this.timer)
      void this.run(keepalive)
    }
  }

  private request(body: Record<string, unknown>, keepalive = false) {
    return fetch(`/api/workouts/${this.workoutId}/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
      credentials: 'same-origin',
    })
  }

  private async run(keepalive = false) {
    if (this.paused || this.inFlight) return
    if (!this.dirty) {
      this.setStatus('saved')
      return
    }

    this.inFlight = true
    const version = this.version
    this.setStatus('saving')
    let retry = false

    try {
      const response = await this.request(
        { exercises: toPayload(this.exercises), expect: 'active', splitName: this.splitName },
        keepalive,
      )
      if (this.paused) return

      if (response.ok) {
        const json = (await response.json()) as { updatedAt?: string }
        this.synced = version
        this.base = json.updatedAt ?? this.base
        this.backoff = RETRY_MIN_MS
        this.persist()
        if (!this.dirty) this.setStatus('saved')
      } else if (response.status === 401) {
        this.setStatus('auth')
      } else if (response.status === 404 || response.status === 409) {
        // Тренировку завершили или удалили с другого устройства
        this.paused = true
        clearDraft(this.workoutId)
        this.setStatus('gone')
      } else if (response.status === 400) {
        // Данные не прошли проверку — повтор не поможет, ждём следующей правки
        this.setStatus('error')
      } else {
        retry = true
        this.setStatus('error')
      }
    } catch {
      if (this.paused) return
      retry = true
      this.setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error')
    } finally {
      this.inFlight = false
    }

    if (this.paused) return
    if (retry) {
      this.schedule(this.backoff)
      this.backoff = Math.min(this.backoff * 2, RETRY_MAX_MS)
    } else if (this.dirty && this.status !== 'auth' && this.status !== 'error') {
      this.schedule(0) // пока шёл запрос, появились новые правки
    }
  }

  /** Подключает реакции на сеть и видимость вкладки. Возвращает функцию отключения. */
  attach() {
    const onOnline = () => {
      this.backoff = RETRY_MIN_MS
      this.flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') this.flush(true)
      else this.flush()
    }
    const onPageHide = () => this.flush(true)

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    if (this.dirty) this.schedule(0)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      // Экран скрыт или закрыт: отправляем то, что не успело уйти
      this.flush(true)
      clearTimeout(this.timer)
    }
  }

  /** Завершить тренировку: финальный снимок и перевод в «завершена» одной транзакцией. */
  async finish(finishedAt: number): Promise<FinishResult> {
    this.paused = true
    clearTimeout(this.timer)
    // Упражнения без подходов (например, пропущенные из сплита) в запись не попадают
    const exercises = toFinalPayload(this.exercises)
    const splitName = this.splitName

    try {
      let response = await this.request({
        exercises,
        splitName,
        expect: 'active',
        finish: true,
        finishedAt: new Date(finishedAt).toISOString(),
      })

      // Тренировка уже завершена: ответ на прошлую попытку мог потеряться.
      // Досохраняем содержимое, чтобы последние правки не пропали.
      if (response.status === 409) {
        response = await this.request({ exercises, splitName, expect: 'completed' })
      }

      if (response.ok) {
        clearDraft(this.workoutId)
        return 'ok'
      }
      if (response.status === 404) {
        clearDraft(this.workoutId)
        return 'gone'
      }
      this.paused = false
      return response.status === 401 ? 'auth' : 'error'
    } catch {
      this.paused = false
      return 'offline'
    }
  }

  /** Тренировка отменена: черновик больше не нужен. */
  discard() {
    this.paused = true
    clearTimeout(this.timer)
    clearDraft(this.workoutId)
  }
}
