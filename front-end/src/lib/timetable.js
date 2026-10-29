// Helpers for rendering the weekly timetable. Times arrive from the API
// already formatted as HH:mm in the university's timezone; the day heading is
// derived from the real upcoming date for that weekday so labels always match
// the actual calendar (via Intl) instead of being hardcoded per language.

// Position of each weekday in the campus teaching week (starts Saturday).
const WEEK_INDEX = { saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6 }

// JS Date#getDay() numbering (Sunday = 0).
const DATE_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

export function dayIndex(day) {
  const key = String(day || '').toLowerCase()
  return key in WEEK_INDEX ? WEEK_INDEX[key] : Object.keys(WEEK_INDEX).length
}

// The next calendar date that falls on the given weekday (today included).
export function upcomingDate(day) {
  const key = String(day || '').toLowerCase()
  if (!(key in DATE_INDEX)) return null
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  base.setDate(base.getDate() + ((DATE_INDEX[key] - base.getDay() + 7) % 7))
  return base
}

function format(date, lang, tz, options) {
  if (!date) return null
  try {
    return new Intl.DateTimeFormat(lang || 'en', { timeZone: tz || undefined, ...options }).format(date)
  } catch {
    return new Intl.DateTimeFormat(lang || 'en', options).format(date)
  }
}

export function weekdayLabel(day, lang, tz) {
  return format(upcomingDate(day), lang, tz, { weekday: 'long' })
}

export function shortWeekdayLabel(day, lang, tz) {
  return format(upcomingDate(day), lang, tz, { weekday: 'short' })
}

export function dateLabel(day, lang, tz) {
  return format(upcomingDate(day), lang, tz, { day: 'numeric', month: 'short' })
}

// Normalise a time value to HH:mm. Values already in HH:mm pass through; ISO
// datetimes are rendered in the university timezone.
export function formatTime(value, tz) {
  if (!value) return ''
  const text = String(value)
  if (/^\d{1,2}:\d{2}$/.test(text)) return text.length === 4 ? `0${text}` : text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return format(date, 'en-GB', tz, { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Minutes since midnight for an HH:mm value.
export function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function zoneParts(tz, at) {
  const now = at ? new Date(at) : new Date()
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const get = (type) => parts.find((p) => p.type === type)?.value
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      weekday: String(get('weekday') || '').toLowerCase(),
      hour: Number(get('hour')) % 24,
      minute: Number(get('minute')),
    }
  } catch {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      weekday: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()],
      hour: now.getHours(),
      minute: now.getMinutes(),
    }
  }
}

// Current date, weekday and minute-of-day in the university timezone. Pass an
// explicit `at` Date to freeze the clock in tests.
export function nowInTimezone(tz, at) {
  const parts = zoneParts(tz, at)
  return {
    date: new Date(parts.year, parts.month - 1, parts.day),
    weekday: parts.weekday,
    minutes: parts.hour * 60 + parts.minute,
  }
}

// The Saturday-to-Friday teaching week that contains today, with real dates.
export function currentWeek(tz, at) {
  const now = nowInTimezone(tz, at)
  const offset = WEEK_INDEX[now.weekday] ?? 0
  const start = new Date(now.date)
  start.setDate(start.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const day = Object.keys(WEEK_INDEX)[i]
    return { day, date, isToday: i === offset }
  })
}

// Index of the first lecture today that has not started yet (-1 when the day
// is over). Kept separate from the component so the badge rules are testable.
export function nextLectureIndex(rows, nowMinutes) {
  return (rows || []).findIndex((row) => (timeToMinutes(row.start_time) ?? 0) > nowMinutes)
}

// State of one lecture at the injected minute-of-day clock: 'now' while it is
// running, 'done' once it ended, 'next' for the next one up, otherwise 'later'.
// An empty string means the row has no usable times.
export function lectureState(row, nowMinutes, index = -1, nextUp = -1) {
  const start = timeToMinutes(row?.start_time)
  const end = timeToMinutes(row?.end_time)
  if (start == null || end == null) return ''
  if (start <= nowMinutes && end > nowMinutes) return 'now'
  if (end <= nowMinutes) return 'done'
  return index === nextUp ? 'next' : 'later'
}

export function formatDate(date, lang, tz, options) {
  return format(date, lang, tz, options)
}

// The next lecture in the week. Already-finished lectures today roll over to
// next week; a lecture in progress counts as the next one.
export function nextLecture(rows, tz, at) {
  const now = nowInTimezone(tz, at)
  const todayIndex = WEEK_INDEX[now.weekday] ?? 0
  let best = null

  ;(rows || []).forEach((row) => {
    const index = dayIndex(row.day_of_week)
    const start = timeToMinutes(row.start_time)
    const end = timeToMinutes(row.end_time)
    if (index > 6 || start == null || end == null) return
    let delta = (index - todayIndex + 7) % 7
    if (delta === 0 && end <= now.minutes) delta = 7
    const score = delta * 24 * 60 + start
    if (best && score >= best.score) return
    const date = new Date(now.date)
    date.setDate(date.getDate() + delta)
    best = {
      row,
      date,
      score,
      live: delta === 0 && start <= now.minutes && end > now.minutes,
    }
  })

  return best
}
