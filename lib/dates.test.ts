import { describe, expect, it } from 'vitest'
import { addMonths, dayKey, isValidTimeZone, monthGrid, monthRange, parseMonthParam, zonedParts, zonedTimeToUtc } from './dates'
import { formatClock, formatDuration, formatSet, formatWeight, plural, formatRelativeDay } from './format'

describe('даты и часовые пояса', () => {
  it('день тренировки определяется по поясу пользователя', () => {
    // 21:30 UTC 11 ноября — это уже 00:30 12 ноября в Москве
    const instant = '2026-11-11T21:30:00Z'
    expect(dayKey(instant, 'Europe/Moscow')).toBe('2026-11-12')
    expect(dayKey(instant, 'Europe/Berlin')).toBe('2026-11-11')
    expect(dayKey(instant, 'UTC')).toBe('2026-11-11')
  })

  it('границы месяца в поясе пользователя', () => {
    const { start, end } = monthRange(2026, 11, 'Europe/Moscow')
    expect(start.toISOString()).toBe('2026-10-31T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-30T21:00:00.000Z')
    const december = monthRange(2026, 12, 'Europe/Moscow')
    expect(december.end.toISOString()).toBe('2026-12-31T21:00:00.000Z')
  })

  it('учитывает перевод часов', () => {
    // Берлин: до 29 марта 2026 — UTC+1, после — UTC+2
    expect(zonedTimeToUtc(2026, 3, 1, 0, 0, 0, 'Europe/Berlin').toISOString()).toBe('2026-02-28T23:00:00.000Z')
    expect(zonedTimeToUtc(2026, 4, 1, 0, 0, 0, 'Europe/Berlin').toISOString()).toBe('2026-03-31T22:00:00.000Z')
    expect(zonedTimeToUtc(2026, 11, 1, 0, 0, 0, 'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z')
  })

  it('zonedParts и обратное преобразование согласованы', () => {
    const p = zonedParts('2026-07-15T12:34:56Z', 'Asia/Tokyo')
    expect(p).toEqual({ year: 2026, month: 7, day: 15, hour: 21, minute: 34, second: 56 })
    expect(zonedTimeToUtc(p.year, p.month, p.day, p.hour, p.minute, p.second, 'Asia/Tokyo').toISOString()).toBe(
      '2026-07-15T12:34:56.000Z',
    )
  })

  it('сетка месяца начинается с понедельника', () => {
    const grid = monthGrid(2026, 11) // 1 ноября 2026 — воскресенье
    expect(grid[0]).toEqual([null, null, null, null, null, null, 1])
    expect(grid[1][0]).toBe(2)
    expect(grid.flat().filter(Boolean)).toHaveLength(30)
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(monthGrid(2027, 2)).toHaveLength(4) // февраль 2027 начинается в понедельник: ровно 4 недели
  })

  it('переключение месяцев и разбор параметра', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(parseMonthParam('2026-11')).toEqual({ year: 2026, month: 11 })
    expect(parseMonthParam('2026-13')).toBeNull()
    expect(parseMonthParam('abc')).toBeNull()
    expect(parseMonthParam(undefined)).toBeNull()
  })

  it('проверяет название пояса', () => {
    expect(isValidTimeZone('Europe/Moscow')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('форматирование', () => {
  it('длительность', () => {
    expect(formatDuration(30)).toBe('< 1 мин')
    expect(formatDuration(45 * 60)).toBe('45 мин')
    expect(formatDuration(3600)).toBe('1 ч')
    expect(formatDuration(4350)).toBe('1 ч 12 мин')
    expect(formatDuration(null)).toBe('—')
  })

  it('секундомер', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(2537)).toBe('42:17')
    expect(formatClock(3737)).toBe('1:02:17')
    expect(formatClock(-5)).toBe('00:00')
  })

  it('вес и подход', () => {
    expect(formatWeight(72.5)).toBe('72,5')
    expect(formatWeight(60)).toBe('60')
    expect(formatSet(70, 8)).toBe('70 кг × 8')
    expect(formatSet(0, 12)).toBe('12 повт.')
  })

  it('склонения', () => {
    const f: [string, string, string] = ['подход', 'подхода', 'подходов']
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => plural(n, f))).toEqual([
      'подход', 'подхода', 'подходов', 'подходов', 'подход', 'подхода', 'подходов', 'подходов',
    ])
  })

  it('относительный день', () => {
    expect(formatRelativeDay('2026-11-11', '2026-11-11', 'x')).toBe('сегодня')
    expect(formatRelativeDay('2026-11-10', '2026-11-11', 'x')).toBe('вчера')
    expect(formatRelativeDay('2026-11-08', '2026-11-11', 'x')).toBe('3 дня назад')
    expect(formatRelativeDay('2026-10-01', '2026-11-11', '1 октября')).toBe('1 октября')
  })
})
