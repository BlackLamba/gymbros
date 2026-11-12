import { toDate } from '@/lib/dates'

const LOCALE = 'ru-RU'

/** Склонение: plural(3, ['подход', 'подхода', 'подходов']) → «подхода». */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export const WORDS = {
  sets: ['подход', 'подхода', 'подходов'] as [string, string, string],
  reps: ['повторение', 'повторения', 'повторений'] as [string, string, string],
  exercises: ['упражнение', 'упражнения', 'упражнений'] as [string, string, string],
  workouts: ['тренировка', 'тренировки', 'тренировок'] as [string, string, string],
  minutes: ['минуту', 'минуты', 'минут'] as [string, string, string],
}

export function countLabel(n: number, forms: [string, string, string]) {
  return `${formatNumber(n)} ${plural(n, forms)}`
}

export function formatNumber(n: number, maxFractionDigits = 0) {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFractionDigits }).format(n)
}

/** 72.5 → «72,5», 60 → «60». */
export function formatWeight(weight: number) {
  return formatNumber(weight, 2)
}

/** Один подход: «70 кг × 8» или «8 повт.» для упражнений без веса. */
export function formatSet(weight: number, reps: number) {
  return weight > 0 ? `${formatWeight(weight)} кг × ${reps}` : `${reps} повт.`
}

/** Компактно, для строки «в прошлый раз»: «70×8» или «×8». */
export function formatSetCompact(weight: number, reps: number) {
  return weight > 0 ? `${formatWeight(weight)}×${reps}` : `×${reps}`
}

/** 4350 → «1 ч 12 мин». */
export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null) return '—'
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 1) return '< 1 мин'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} мин`
  if (m === 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

/** Секундомер: «42:17» или «1:02:17». */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function fmt(value: Date | string | number, tz: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...options }).format(toDate(value))
}

/** «18:05» */
export function formatTime(value: Date | string | number, tz: string) {
  return fmt(value, tz, { hour: '2-digit', minute: '2-digit' })
}

/** «11 ноября» (с годом, если он не текущий) */
export function formatDate(value: Date | string | number, tz: string, now: Date | number = Date.now()) {
  const sameYear = fmt(value, tz, { year: 'numeric' }) === fmt(now, tz, { year: 'numeric' })
  return fmt(value, tz, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '')
}

/** «4 нояб.» → «4 ноя» */
export function formatDateShort(value: Date | string | number, tz: string) {
  const day = fmt(value, tz, { day: 'numeric' })
  const month = fmt(value, tz, { month: 'short' }).replace('.', '').slice(0, 3)
  return `${day} ${month}`
}

/** «среда» */
export function formatWeekday(value: Date | string | number, tz: string) {
  return fmt(value, tz, { weekday: 'long' })
}

/** «ср» */
export function formatWeekdayShort(value: Date | string | number, tz: string) {
  return fmt(value, tz, { weekday: 'short' })
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export function monthName(month: number) {
  return MONTHS[month - 1]
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** «сегодня», «вчера», «3 дня назад» или дата. */
export function formatRelativeDay(dayKeyValue: string, todayKey: string, fallback: string) {
  const diff = Math.round((Date.parse(todayKey) - Date.parse(dayKeyValue)) / 86_400_000)
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'вчера'
  if (diff > 1 && diff < 7) return `${diff} ${plural(diff, ['день', 'дня', 'дней'])} назад`
  return fallback
}
