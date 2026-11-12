import { describe, expect, it } from 'vitest'
import type { ExerciseContext, SetValue } from '@/lib/types'
import { MAX_INSIGHTS, analyzeWorkout } from './insights'

const s = (weight: number, reps: number): SetValue => ({ weight, reps })

function ctx(exerciseId: string, history: SetValue[][]): ExerciseContext {
  // history — тренировки по возрастанию даты
  const byWeight = new Map<number, number>()
  let maxWeight = 0
  let maxVolume = 0
  for (const sets of history) {
    let volume = 0
    for (const set of sets) {
      byWeight.set(set.weight, Math.max(byWeight.get(set.weight) ?? 0, set.reps))
      maxWeight = Math.max(maxWeight, set.weight)
      volume += set.weight * set.reps
    }
    maxVolume = Math.max(maxVolume, volume)
  }
  return {
    exerciseId,
    workoutsCount: history.length,
    maxWeight,
    maxVolume,
    repsByWeight: [...byWeight].map(([weight, maxReps]) => ({ weight, maxReps })),
    last: { workoutId: 'w-last', startedAt: '2026-11-01T10:00:00Z', sets: history[history.length - 1] },
  }
}

const bench = (sets: SetValue[]) => ({ exerciseId: 'bench', name: 'Жим лёжа', sets })
const kinds = (r: ReturnType<typeof analyzeWorkout>) => r.insights.map((i) => i.kind)

describe('analyzeWorkout', () => {
  it('первое выполнение — точка отсчёта, а не рекорд', () => {
    const r = analyzeWorkout({ exercises: [bench([s(60, 10), s(70, 8)])], contexts: {} })
    expect(r.insights).toEqual([])
    expect(r.exercises[0].state).toBe('first')
    expect(r.exercises[0].recordSets).toEqual([])
  })

  it('рекорд веса: считает прибавку к прежнему максимуму и отмечает подход', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(60, 12), s(80, 5)])],
      contexts: { bench: ctx('bench', [[s(60, 12), s(75, 6)]]) },
    })
    expect(r.insights[0]).toMatchObject({ kind: 'weight_record', tone: 'record' })
    expect(r.insights[0].text).toBe('Жим лёжа: 80 кг — на 5 кг больше прежнего')
    expect(r.exercises[0].recordSets).toEqual([1])
    expect(r.exercises[0].state).toBe('compared')
  })

  it('рекорд веса сравнивается со всей историей, а не только с прошлым разом', () => {
    // Исторический максимум 90, в прошлый раз 70, сейчас 80: это прибавка, но не рекорд
    const r = analyzeWorkout({
      exercises: [bench([s(80, 5)])],
      contexts: { bench: ctx('bench', [[s(90, 3)], [s(70, 8)]]) },
    })
    expect(kinds(r)).not.toContain('weight_record')
    expect(r.insights.find((i) => i.kind === 'more_weight')?.text).toBe('Жим лёжа: на 10 кг больше, чем в прошлый раз')
  })

  it('повторения сравниваются только при одинаковом весе', () => {
    // Раньше 70×8. Сейчас 60×9: вес другой — повторения сравнивать не с чем
    const r = analyzeWorkout({
      exercises: [bench([s(60, 9)])],
      contexts: { bench: ctx('bench', [[s(70, 8)]]) },
    })
    expect(kinds(r)).not.toContain('reps_record')
    expect(kinds(r)).not.toContain('more_reps')
    expect(r.insights).toEqual([])
  })

  it('рекорд повторений на том же весе', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(70, 10)])],
      contexts: { bench: ctx('bench', [[s(70, 8)]]) },
    })
    const insight = r.insights.find((i) => i.kind === 'reps_record')
    expect(insight?.text).toBe('Жим лёжа, 70 кг: 10 повторений — на 2 больше прежнего максимума')
    expect(r.exercises[0].recordSets).toEqual([0])
  })

  it('«больше, чем в прошлый раз», если это не рекорд за всё время', () => {
    // Давно было 70×12, в прошлый раз 70×8, сейчас 70×10
    const r = analyzeWorkout({
      exercises: [bench([s(70, 10)])],
      contexts: { bench: ctx('bench', [[s(70, 12)], [s(70, 8)]]) },
    })
    expect(kinds(r)).not.toContain('reps_record')
    expect(r.insights.find((i) => i.kind === 'more_reps')?.text).toBe(
      'Жим лёжа, 70 кг: на 2 повторения больше, чем в прошлый раз',
    )
    expect(r.exercises[0].recordSets).toEqual([])
  })

  it('упражнение без веса: сравниваются повторения и подходы, но не вес и объём', () => {
    const r = analyzeWorkout({
      exercises: [{ exerciseId: 'pull', name: 'Подтягивания', sets: [s(0, 12), s(0, 10), s(0, 8)] }],
      contexts: { pull: ctx('pull', [[s(0, 10), s(0, 8)]]) },
    })
    expect(kinds(r)).not.toContain('weight_record')
    expect(kinds(r)).not.toContain('volume_record')
    expect(r.insights.find((i) => i.kind === 'reps_record')?.text).toBe(
      'Подтягивания: 12 повторений — на 2 больше прежнего максимума',
    )
    expect(r.insights.find((i) => i.kind === 'more_sets')?.text).toBe('Подтягивания: на один подход больше')
  })

  it('переход с «без веса» на отягощение не объявляется рекордом веса', () => {
    const r = analyzeWorkout({
      exercises: [{ exerciseId: 'pull', name: 'Подтягивания', sets: [s(10, 6)] }],
      contexts: { pull: ctx('pull', [[s(0, 10)]]) },
    })
    expect(kinds(r)).not.toContain('weight_record')
    expect(kinds(r)).not.toContain('more_weight')
  })

  it('рекорд объёма', () => {
    // Раньше 3×(70×8) = 1680; сейчас 4×(70×8) = 2240
    const r = analyzeWorkout({
      exercises: [bench([s(70, 8), s(70, 8), s(70, 8), s(70, 8)])],
      contexts: { bench: ctx('bench', [[s(70, 8), s(70, 8), s(70, 8)]]) },
    })
    expect(r.insights.find((i) => i.kind === 'volume_record')?.text).toMatch(/^Жим лёжа: 2\s240 кг за тренировку$/)
    expect(r.insights.find((i) => i.kind === 'more_sets')?.text).toBe('Жим лёжа: на один подход больше')
  })

  it('склоняет «подхода/подходов»', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(50, 5), s(50, 5), s(50, 5)])],
      contexts: { bench: ctx('bench', [[s(50, 5)]]) },
    })
    expect(r.insights.find((i) => i.kind === 'more_sets')?.text).toBe('Жим лёжа: на 2 подхода больше')
  })

  it('о снижении результатов не сообщает', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(60, 6)])],
      contexts: { bench: ctx('bench', [[s(80, 8), s(80, 8)]]) },
    })
    expect(r.insights).toEqual([])
  })

  it('точное повторение прошлой тренировки — без сообщений', () => {
    const sets = [s(60, 12), s(70, 10)]
    const r = analyzeWorkout({ exercises: [bench(sets)], contexts: { bench: ctx('bench', [sets]) } })
    expect(r.insights).toEqual([])
  })

  it('длительность: нейтрально и только при разнице от 5 минут', () => {
    const base = { exercises: [], contexts: {} }
    expect(analyzeWorkout({ ...base, durationSeconds: 3600, previousDurationSeconds: 3600 - 240 }).insights).toEqual([])
    const longer = analyzeWorkout({ ...base, durationSeconds: 4500, previousDurationSeconds: 3600 })
    expect(longer.insights).toEqual([
      { kind: 'duration', tone: 'neutral', label: 'Длительность', text: 'Тренировка длилась на 15 минут дольше предыдущей' },
    ])
    const shorter = analyzeWorkout({ ...base, durationSeconds: 3000, previousDurationSeconds: 4260 })
    expect(shorter.insights[0].text).toBe('Тренировка длилась на 21 минуту короче предыдущей')
    expect(analyzeWorkout({ ...base, durationSeconds: 3600, previousDurationSeconds: null }).insights).toEqual([])
  })

  it('удалённое из списка упражнение и упражнение без подходов не анализируются', () => {
    const r = analyzeWorkout({
      exercises: [
        { exerciseId: null, name: 'Удалённое', sets: [s(100, 10)] },
        bench([]),
      ],
      contexts: { bench: ctx('bench', [[s(50, 5)]]) },
    })
    expect(r.insights).toEqual([])
    expect(r.exercises.map((e) => e.state)).toEqual(['untracked', 'untracked'])
  })

  it('упражнение, добавленное дважды, считается целиком', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(70, 8)]), { exerciseId: 'squat', name: 'Присед', sets: [s(100, 5)] }, bench([s(80, 4)])],
      contexts: { bench: ctx('bench', [[s(70, 8), s(75, 5)]]) },
    })
    expect(r.insights.filter((i) => i.kind === 'weight_record')).toHaveLength(1)
    expect(r.exercises[2].recordSets).toEqual([0]) // рекордный подход — во втором блоке
    expect(r.exercises[0].recordSets).toEqual([])
    expect(r.exercises[1].state).toBe('first')
  })

  it('не больше четырёх сообщений; сначала рекорды, по одному на упражнение', () => {
    const names = ['a', 'b', 'c', 'd', 'e']
    const r = analyzeWorkout({
      exercises: names.map((id) => ({ exerciseId: id, name: id.toUpperCase(), sets: [s(50, 10), s(60, 10), s(60, 10)] })),
      contexts: Object.fromEntries(names.map((id) => [id, ctx(id, [[s(50, 8), s(55, 8)]])])),
      durationSeconds: 5000,
      previousDurationSeconds: 3000,
    })
    expect(r.insights).toHaveLength(MAX_INSIGHTS)
    expect(new Set(kinds(r))).toEqual(new Set(['weight_record']))
    expect(new Set(r.insights.map((i) => i.text.split(':')[0])).size).toBe(4)
  })

  it('дробные веса сравниваются корректно', () => {
    const r = analyzeWorkout({
      exercises: [bench([s(72.5, 8)])],
      contexts: { bench: ctx('bench', [[s(72.5, 6), s(70, 8)]]) },
    })
    expect(kinds(r)).not.toContain('weight_record')
    expect(r.insights.find((i) => i.kind === 'reps_record')?.text).toBe(
      'Жим лёжа, 72,5 кг: 8 повторений — на 2 больше прежнего максимума',
    )
  })
})
