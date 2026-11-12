import { WORDS, formatNumber, formatWeight, plural } from '@/lib/format'
import type { ExerciseContext, SetValue } from '@/lib/types'

/**
 * Сравнение тренировки с прошлыми результатами.
 *
 * Правила корректности:
 *  - сравниваем только с завершёнными тренировками, которые были РАНЬШЕ этой
 *    (их и содержит ExerciseContext);
 *  - первое выполнение упражнения — точка отсчёта, а не рекорд;
 *  - повторения сравниваются только при одинаковом весе;
 *  - для упражнений без отягощения вес и объём не сравниваются;
 *  - сообщаем только о росте; длительность — нейтрально и только при заметной разнице.
 */

export type InsightKind =
  | 'weight_record'
  | 'reps_record'
  | 'volume_record'
  | 'more_weight'
  | 'more_reps'
  | 'more_sets'
  | 'duration'

export type InsightTone = 'record' | 'better' | 'neutral'

export type Insight = {
  kind: InsightKind
  tone: InsightTone
  label: string
  text: string
}

export type ExerciseAnalysis = {
  /** untracked — упражнение удалено из списка или в нём нет подходов; first — раньше не выполнялось */
  state: 'untracked' | 'first' | 'compared'
  /** Индексы подходов, в которых установлен личный рекорд (вес или повторения на весе) */
  recordSets: number[]
  previous: { startedAt: string; sets: SetValue[] } | null
}

export type AnalysisInput = {
  exercises: { exerciseId: string | null; name: string; sets: SetValue[] }[]
  contexts: Record<string, ExerciseContext>
  durationSeconds?: number | null
  previousDurationSeconds?: number | null
}

export const MAX_INSIGHTS = 4
const MIN_DURATION_DIFF_SECONDS = 5 * 60

const PRIORITY: Record<InsightKind, number> = {
  weight_record: 1,
  reps_record: 2,
  volume_record: 3,
  more_weight: 4,
  more_reps: 5,
  more_sets: 6,
  duration: 9,
}

const sameWeight = (a: number, b: number) => Math.abs(a - b) < 0.005

export function volumeOf(sets: SetValue[]) {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
}

export function topWeightOf(sets: SetValue[]) {
  return sets.reduce((max, s) => Math.max(max, s.weight), 0)
}

function bestRepsAt(sets: SetValue[], weight: number): number | null {
  let best: number | null = null
  for (const s of sets) {
    if (sameWeight(s.weight, weight) && (best === null || s.reps > best)) best = s.reps
  }
  return best
}

function distinctWeights(sets: SetValue[]) {
  const out: number[] = []
  for (const s of sets) if (!out.some((w) => sameWeight(w, s.weight))) out.push(s.weight)
  return out.sort((a, b) => b - a) // от тяжёлого к лёгкому
}

function repsPhrase(n: number) {
  return `${n} ${plural(n, WORDS.reps)}`
}

function atWeight(name: string, weight: number) {
  return weight > 0 ? `${name}, ${formatWeight(weight)} кг` : name
}

type Tagged = Insight & { group: string }

export function analyzeWorkout(input: AnalysisInput): { insights: Insight[]; exercises: ExerciseAnalysis[] } {
  const analyses: ExerciseAnalysis[] = input.exercises.map(() => ({
    state: 'untracked',
    recordSets: [],
    previous: null,
  }))

  // Одно и то же упражнение может встретиться в тренировке дважды — считаем его целиком
  const groups = new Map<string, { name: string; refs: { exercise: number; set: number }[]; sets: SetValue[] }>()
  input.exercises.forEach((exercise, exerciseIndex) => {
    if (!exercise.exerciseId || exercise.sets.length === 0) return
    let group = groups.get(exercise.exerciseId)
    if (!group) {
      group = { name: exercise.name, refs: [], sets: [] }
      groups.set(exercise.exerciseId, group)
    }
    exercise.sets.forEach((set, setIndex) => {
      group.refs.push({ exercise: exerciseIndex, set: setIndex })
      group.sets.push(set)
    })
  })

  const found: Tagged[] = []

  for (const [exerciseId, group] of groups) {
    const context = input.contexts[exerciseId]
    const indexes = [...new Set(group.refs.map((r) => r.exercise))]

    if (!context || context.workoutsCount === 0) {
      for (const i of indexes) analyses[i].state = 'first'
      continue
    }

    const previous = { startedAt: context.last.startedAt, sets: context.last.sets }
    for (const i of indexes) {
      analyses[i].state = 'compared'
      analyses[i].previous = previous
    }

    const { name, sets } = group
    const markRecord = (predicate: (s: SetValue) => boolean) => {
      const at = sets.findIndex(predicate)
      if (at === -1) return
      const ref = group.refs[at]
      if (!analyses[ref.exercise].recordSets.includes(ref.set)) analyses[ref.exercise].recordSets.push(ref.set)
    }
    const push = (kind: InsightKind, tone: InsightTone, label: string, text: string) =>
      found.push({ kind, tone, label, text, group: exerciseId })

    const top = topWeightOf(sets)
    const lastTop = topWeightOf(previous.sets)

    // 1. Рекорд рабочего веса
    const isWeightRecord = top > 0 && context.maxWeight > 0 && top > context.maxWeight
    if (isWeightRecord) {
      markRecord((s) => sameWeight(s.weight, top))
      push(
        'weight_record',
        'record',
        'Рекорд веса',
        `${name}: ${formatWeight(top)} кг — на ${formatWeight(top - context.maxWeight)} кг больше прежнего`,
      )
    } else if (top > lastTop && lastTop > 0) {
      push('more_weight', 'better', 'Прибавка', `${name}: на ${formatWeight(top - lastTop)} кг больше, чем в прошлый раз`)
    }

    // 2. Повторения — только при одинаковом весе
    let repsRecord: { weight: number; reps: number; diff: number } | null = null
    let moreReps: { weight: number; diff: number } | null = null
    for (const weight of distinctWeights(sets)) {
      const current = bestRepsAt(sets, weight)!
      const historic = context.repsByWeight.find((r) => sameWeight(r.weight, weight))
      if (historic && current > historic.maxReps) {
        markRecord((s) => sameWeight(s.weight, weight) && s.reps === current)
        repsRecord ??= { weight, reps: current, diff: current - historic.maxReps }
      }
      const lastTime = bestRepsAt(previous.sets, weight)
      if (lastTime !== null && current > lastTime) {
        moreReps ??= { weight, diff: current - lastTime }
      }
    }
    if (repsRecord) {
      push(
        'reps_record',
        'record',
        'Рекорд повторений',
        `${atWeight(name, repsRecord.weight)}: ${repsPhrase(repsRecord.reps)} — на ${repsRecord.diff} больше прежнего максимума`,
      )
    } else if (moreReps) {
      push(
        'more_reps',
        'better',
        'Больше повторений',
        `${atWeight(name, moreReps.weight)}: на ${repsPhrase(moreReps.diff)} больше, чем в прошлый раз`,
      )
    }

    // 3. Рекорд объёма (для упражнений без веса объём не считается)
    const volume = volumeOf(sets)
    if (top > 0 && context.maxVolume > 0 && volume > context.maxVolume) {
      push('volume_record', 'record', 'Рекорд объёма', `${name}: ${formatNumber(Math.round(volume))} кг за тренировку`)
    }

    // 4. Больше подходов, чем в прошлый раз
    const extraSets = sets.length - previous.sets.length
    if (previous.sets.length > 0 && extraSets > 0) {
      push(
        'more_sets',
        'better',
        'Больше подходов',
        extraSets === 1
          ? `${name}: на один подход больше`
          : `${name}: на ${extraSets} ${plural(extraSets, WORDS.sets)} больше`,
      )
    }
  }

  // Отбор: сначала по одному самому важному сообщению на упражнение, затем остальные
  const byPriority = [...found].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const picked: Tagged[] = []
  const seenGroups = new Set<string>()
  for (const item of byPriority) {
    if (picked.length >= MAX_INSIGHTS) break
    if (seenGroups.has(item.group)) continue
    seenGroups.add(item.group)
    picked.push(item)
  }
  for (const item of byPriority) {
    if (picked.length >= MAX_INSIGHTS) break
    if (!picked.includes(item)) picked.push(item)
  }
  picked.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])

  const insights: Insight[] = picked.map(({ kind, tone, label, text }) => ({ kind, tone, label, text }))

  // Длительность — нейтрально, только при разнице от 5 минут и если есть место
  const { durationSeconds, previousDurationSeconds } = input
  if (insights.length < MAX_INSIGHTS && durationSeconds != null && previousDurationSeconds != null) {
    const diff = durationSeconds - previousDurationSeconds
    if (Math.abs(diff) >= MIN_DURATION_DIFF_SECONDS) {
      const minutes = Math.round(Math.abs(diff) / 60)
      insights.push({
        kind: 'duration',
        tone: 'neutral',
        label: 'Длительность',
        text: `Тренировка длилась на ${minutes} ${plural(minutes, WORDS.minutes)} ${diff > 0 ? 'дольше' : 'короче'} предыдущей`,
      })
    }
  }

  return { insights, exercises: analyses }
}

/** Личные рекорды по упражнению за всё время — для страницы упражнения. */
export function recordsFromContext(context: ExerciseContext | undefined) {
  if (!context || context.workoutsCount === 0) return null
  const weighted = context.maxWeight > 0
  const atTop = context.repsByWeight.find((r) => sameWeight(r.weight, context.maxWeight))
  const bestReps = context.repsByWeight.reduce((max, r) => Math.max(max, r.maxReps), 0)
  return {
    weighted,
    maxWeight: context.maxWeight,
    repsAtMaxWeight: atTop?.maxReps ?? null,
    maxVolume: context.maxVolume,
    bestReps,
    workoutsCount: context.workoutsCount,
  }
}
