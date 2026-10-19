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
