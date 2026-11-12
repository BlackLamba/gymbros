import { describe, expect, it } from 'vitest'
import type { ExerciseContext } from '@/lib/types'
import {
  type EditorExercise,
  fromWorkout,
  move,
  nextSetDefaults,
  parseReps,
  parseWeight,
  sanitizeRepsInput,
  sanitizeWeightInput,
  stepReps,
  stepWeight,
  toPayload,
  totalsOf,
} from './workout-editor'

const ex = (sets: [string, string][], exerciseId: string | null = 'e1'): EditorExercise => ({
  id: 'x',
  exerciseId,
  name: 'Жим лёжа',
  sets: sets.map(([weight, reps], i) => ({ id: String(i), weight, reps })),
})

describe('ввод веса и повторений', () => {
  it('принимает запятую и точку', () => {
    expect(parseWeight('62,5')).toBe(62.5)
    expect(parseWeight('62.5')).toBe(62.5)
    expect(parseWeight('100')).toBe(100)
    expect(parseWeight(' 7,25 ')).toBe(7.25)
  })

  it('пустой вес — это «без отягощения»', () => {
    expect(parseWeight('')).toBe(0)
  })

  it('отклоняет некорректный вес', () => {
    expect(parseWeight('abc')).toBeNull()
    expect(parseWeight('1000')).toBeNull()
    expect(parseWeight('12,345')).toBeNull()
    expect(parseWeight('-5')).toBeNull()
  })

  it('повторения — целое от 1 до 999', () => {
    expect(parseReps('12')).toBe(12)
    expect(parseReps('0')).toBeNull()
    expect(parseReps('')).toBeNull()
    expect(parseReps('1,5')).toBeNull()
    expect(parseReps('1000')).toBeNull()
  })

  it('очищает ввод на лету', () => {
    expect(sanitizeWeightInput('72.5')).toBe('72,5')
    expect(sanitizeWeightInput('7a2,,5.1')).toBe('72,51')
    expect(sanitizeWeightInput(',5')).toBe('0,5')
    expect(sanitizeWeightInput('12345')).toBe('123')
    expect(sanitizeWeightInput('1,2345')).toBe('1,23')
    expect(sanitizeRepsInput('1a2b3c4')).toBe('123')
  })

  it('кнопки шага', () => {
    expect(stepWeight('60', 1)).toBe('62,5')
    expect(stepWeight('62,5', -1)).toBe('60')
    expect(stepWeight('', 1)).toBe('2,5')
    expect(stepWeight('2,5', -1)).toBe('')
    expect(stepWeight('', -1)).toBe('')
    expect(stepReps('', 1)).toBe('1')
    expect(stepReps('8', 1)).toBe('9')
    expect(stepReps('1', -1)).toBe('1')
  })
})

describe('снимок тренировки', () => {
  it('в снимок попадают только заполненные подходы', () => {
    const payload = toPayload([ex([['60', '12'], ['70', ''], ['', '10'], ['abc', '5']])])
    expect(payload).toEqual([
      {
        exercise_id: 'e1',
        name: 'Жим лёжа',
        sets: [
          { weight: 60, reps: 12 },
          { weight: 0, reps: 10 },
        ],
      },
    ])
  })

  it('упражнение без подходов сохраняется (чтобы не пропасть при перезагрузке)', () => {
    expect(toPayload([ex([])])).toEqual([{ exercise_id: 'e1', name: 'Жим лёжа', sets: [] }])
  })

  it('итоги: упражнения, подходы, повторения, объём, незаполненные', () => {
    const totals = totalsOf([ex([['60', '12'], ['70', '10'], ['70', '']]), ex([['', '8']]), ex([['50', '']])])
    expect(totals).toEqual({ exercises: 2, sets: 3, reps: 30, volume: 60 * 12 + 70 * 10, incompleteSets: 2 })
  })

  it('данные с сервера превращаются в поля ввода и обратно без потерь', () => {
    const editor = fromWorkout([
      { id: 'we1', exerciseId: 'e1', name: 'Жим лёжа', sets: [{ weight: 72.5, reps: 8 }, { weight: 0, reps: 12 }] },
    ])
    expect(editor[0].sets.map((s) => [s.weight, s.reps])).toEqual([['72,5', '8'], ['', '12']])
    expect(toPayload(editor)[0].sets).toEqual([{ weight: 72.5, reps: 8 }, { weight: 0, reps: 12 }])
  })
})

describe('значения нового подхода', () => {
  const context: ExerciseContext = {
    exerciseId: 'e1',
    workoutsCount: 1,
    maxWeight: 75,
    maxVolume: 0,
    repsByWeight: [],
    last: { workoutId: 'w', startedAt: '2026-11-01T10:00:00Z', sets: [{ weight: 60, reps: 12 }, { weight: 70, reps: 10 }] },
  }

  it('берёт тот же по счёту подход из прошлой тренировки', () => {
    expect(nextSetDefaults(ex([]), context)).toEqual({ weight: '60', reps: '12' })
    expect(nextSetDefaults(ex([['65', '12']]), context)).toEqual({ weight: '70', reps: '10' })
  })

  it('если в прошлый раз подходов было меньше — копирует предыдущий', () => {
    expect(nextSetDefaults(ex([['65', '12'], ['72,5', '9']]), context)).toEqual({ weight: '72,5', reps: '9' })
  })

  it('без истории: первый подход пустой, дальше копия предыдущего', () => {
    expect(nextSetDefaults(ex([]), undefined)).toEqual({ weight: '', reps: '' })
    expect(nextSetDefaults(ex([['40', '15']]), undefined)).toEqual({ weight: '40', reps: '15' })
  })
})

describe('порядок упражнений', () => {
  it('перемещает элемент и не выходит за границы', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    const list = ['a', 'b', 'c']
    expect(move(list, 0, -1)).toBe(list)
    expect(move(list, 2, 3)).toBe(list)
  })
})
