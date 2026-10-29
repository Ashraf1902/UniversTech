import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentWeek,
  lectureState,
  nextLecture,
  nextLectureIndex,
  nowInTimezone,
} from './timetable.js'

// Thursday 29 October 2026, the anchor used for every clock-dependent case.
const at = (hhmm) => new Date(`2026-10-29T${hhmm}:00Z`)

const rows = [
  { id: 1, day_of_week: 'Thursday', start_time: '09:00', end_time: '10:30', course_name: 'Data Structures' },
  { id: 2, day_of_week: 'Thursday', start_time: '11:00', end_time: '12:30', course_name: 'Web Development' },
]

const minutesAt = (hhmm) => nowInTimezone('UTC', at(hhmm)).minutes

test('the injected clock drives weekday and minute-of-day', () => {
  const now = nowInTimezone('UTC', at('09:45'))
  assert.equal(now.weekday, 'thursday')
  assert.equal(now.minutes, 9 * 60 + 45)
})

test('before the first lecture, it is next and the rest are later', () => {
  const now = minutesAt('08:00')
  const nextUp = nextLectureIndex(rows, now)
  assert.equal(nextUp, 0)
  assert.equal(lectureState(rows[0], now, 0, nextUp), 'next')
  assert.equal(lectureState(rows[1], now, 1, nextUp), 'later')
})

test('the badge turns on at the exact start minute', () => {
  const now = minutesAt('09:00')
  const nextUp = nextLectureIndex(rows, now)
  assert.equal(lectureState(rows[0], now, 0, nextUp), 'now')
  assert.equal(nextUp, 1)
  assert.equal(lectureState(rows[1], now, 1, nextUp), 'next')
})

test('a running lecture is now and the following one is next', () => {
  const now = minutesAt('10:45')
  const nextUp = nextLectureIndex(rows, now)
  assert.equal(lectureState(rows[0], now, 0, nextUp), 'done')
  assert.equal(lectureState(rows[1], now, 1, nextUp), 'next')
})

test('the second lecture becomes now while the first stays done', () => {
  const now = minutesAt('11:15')
  const nextUp = nextLectureIndex(rows, now)
  assert.equal(lectureState(rows[0], now, 0, nextUp), 'done')
  assert.equal(lectureState(rows[1], now, 1, nextUp), 'now')
})

test('the badge turns off at the exact end minute', () => {
  const now = minutesAt('12:30')
  const nextUp = nextLectureIndex(rows, now)
  assert.equal(nextUp, -1)
  assert.equal(lectureState(rows[0], now, 0, nextUp), 'done')
  assert.equal(lectureState(rows[1], now, 1, nextUp), 'done')
})

test('rows without usable times have no badge state', () => {
  assert.equal(lectureState({ start_time: null, end_time: null }, 600, 0, 0), '')
  assert.equal(lectureState({ start_time: '09:00' }, 600, 0, 0), '')
})

test('next lecture skips today once the last one has ended', () => {
  const later = nextLecture(rows, 'UTC', at('13:00'))
  assert.equal(later.row.id, 1)
  assert.equal(later.date.getDate(), 5) // Thursday 5 November
  assert.equal(later.live, false)
})

test('next lecture is live while it is running', () => {
  const live = nextLecture(rows, 'UTC', at('11:15'))
  assert.equal(live.row.id, 2)
  assert.equal(live.live, true)
})

test('the week starts on Saturday and marks today', () => {
  const week = currentWeek('UTC', at('09:00'))
  assert.equal(week.length, 7)
  assert.equal(week[0].date.getDate(), 24)
  assert.deepEqual(week.map((d) => d.isToday), [false, false, false, false, false, true, false])
})
