/**
 * Работа с датами в часовом поясе пользователя.
 * В базе всё хранится в UTC (timestamptz); пояс нужен только для отображения,
 * раскладки по дням и границ месяца. Библиотек нет — достаточно Intl.
 */

export const DEFAULT_TIME_ZONE = 'Europe/Moscow'
export const TIME_ZONE_COOKIE = 'tz'

export type ZonedParts = {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  second: number
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(tz, f)
  }
  return f
}

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** Календарные компоненты момента времени в заданном поясе. */
export function zonedParts(value: Date | string | number, tz: string): ZonedParts {
  const out: Record<string, number> = {}
  for (const p of partsFormatter(tz).formatToParts(toDate(value))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function makeDayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Ключ дня «ГГГГ-ММ-ДД» в поясе пользователя. Тренировка относится к дню своего начала. */
export function dayKey(value: Date | string | number, tz: string): string {
  const p = zonedParts(value, tz)
  return makeDayKey(p.year, p.month, p.day)
}

/** Момент UTC, соответствующий «настенному» времени в заданном поясе. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second)
  const offsetAt = (instant: number) => {
    const p = zonedParts(instant, tz)
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant
  }
  let result = wall - offsetAt(wall)
  // Второй проход нужен рядом с переводом часов
  const corrected = wall - offsetAt(result)
  if (corrected !== result) result = corrected
  return new Date(result)
}

/** Границы месяца [start, end) в UTC для пояса пользователя. */
export function monthRange(year: number, month: number, tz: string) {
  const next = addMonths(year, month, 1)
  return {
    start: zonedTimeToUtc(year, month, 1, 0, 0, 0, tz),
    end: zonedTimeToUtc(next.year, next.month, 1, 0, 0, 0, tz),
  }
}

export function addMonths(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 }
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Сетка месяца: недели с понедельника, null — ячейки соседних месяцев.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0 = воскресенье
  const lead = (first + 6) % 7
  const total = daysInMonth(year, month)
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Параметр месяца из URL: «2026-11». */
export function parseMonthParam(value: unknown): { year: number; month: number } | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null
  return { year, month }
}

export function monthParam(year: number, month: number) {
  return `${year}-${pad(month)}`
}

/** Значение для <input type="datetime-local"> в локальном времени устройства. */
export function toLocalInputValue(value: Date | string | number): string {
  const d = toDate(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
