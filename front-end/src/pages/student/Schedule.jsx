import { useMemo } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync, useUniversityTimezone } from '../../lib/hooks'
import { Badge, Empty, I, Reveal, Spinner } from '../../lib/ui'
import { currentWeek, formatDate, formatTime, nowInTimezone, timeToMinutes } from '../../lib/timetable'
import { Head } from './_shared'

const TONES = ['a', 'b', 'c', 'd']

function toneFor(code) {
  const sum = [...String(code || '')].reduce((total, ch) => total + ch.charCodeAt(0), 0)
  return TONES[sum % TONES.length]
}

export function StudentSchedule() {
  const { t, lang } = useI18n()
  const timezone = useUniversityTimezone()
  const { data, loading } = useAsync(() => request('/api/user/schedule'))
  const rows = data?.schedule || []

  const now = nowInTimezone(timezone)
  const week = currentWeek(timezone)

  const byDay = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      const key = String(row.day_of_week || '').toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    map.forEach((items) => {
      items.sort((a, b) => (timeToMinutes(a.start_time) ?? 0) - (timeToMinutes(b.start_time) ?? 0))
    })
    return map
  }, [rows])

  const totalLectures = rows.length

  return (
    <>
      <Head kicker={t('thisTerm')} title={t('weeklySchedule')} sub={t('weeklyScheduleSub')} />

      {loading ? (
        <Spinner size={24} />
      ) : totalLectures ? (
        <Reveal className="sched-board">
          <div className="sched-board-head">
            <span className="sched-week">
              {t('weekOf', {
                date: formatDate(week[0].date, lang, timezone, { day: 'numeric', month: 'short' }),
              })}
            </span>
            <div className="sched-legend">
              <Badge tone="cy">{t('type_lecture')}</Badge>
              <Badge tone="vio">{t('type_section')}</Badge>
              <span className="sched-count">{t('lecturesCount', { n: totalLectures })}</span>
            </div>
          </div>

          <div className="sched-grid">
            {week.map((day) => {
              const items = byDay.get(day.day) || []
              const isToday = day.isToday
              return (
                <div key={day.day} className={`sched-day ${isToday ? 'is-today' : ''} ${items.length ? '' : 'is-empty'}`}>
                  <div className="sched-day-head">
                    <span>{formatDate(day.date, lang, timezone, { weekday: 'short' })}</span>
                    <strong>{formatDate(day.date, lang, timezone, { day: 'numeric' })}</strong>
                    <small>{formatDate(day.date, lang, timezone, { month: 'short' })}</small>
                    {isToday ? <em>{t('scheduleToday')}</em> : null}
                  </div>

                  <div className="sched-blocks">
                    {items.length ? (
                      items.map((row, index) => {
                        const start = timeToMinutes(row.start_time)
                        const end = timeToMinutes(row.end_time)
                        const live = isToday && start != null && end != null && start <= now.minutes && end > now.minutes
                        return (
                          <div
                            key={row.id ?? index}
                            className={`sched-block tone-${toneFor(row.course_code)} ${live ? 'is-now' : ''}`}
                          >
                            <span className="sched-block-time">
                              {formatTime(row.start_time, timezone)}
                              <i>–</i>
                              {formatTime(row.end_time, timezone)}
                            </span>
                            <strong>{row.course_name}</strong>
                            <div className="sched-block-meta">
                              {row.course_code ? <span>{row.course_code}</span> : null}
                              {row.section_type ? (
                                <span className={`sched-type ${String(row.section_type).toLowerCase()}`}>
                                  {t('type_' + String(row.section_type).toLowerCase())}
                                </span>
                              ) : null}
                            </div>
                            {live ? <span className="sched-now">{t('lectureNow')}</span> : null}
                            {row.path ? (
                              <a className="sched-file" href={row.path} target="_blank" rel="noreferrer">
                                <I name="file" size={13} /> {t('fileAction')}
                              </a>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <span className="sched-none">{t('noLecturesThisDay')}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      ) : (
        <Empty icon="calendar" title={t('noSchedulePublished')} sub={t('noSchedulePublishedSub')} />
      )}

      {!loading && totalLectures ? (
        <p className="sched-foot">
          <I name="info" size={14} /> {t('weeklyScheduleSub')}
        </p>
      ) : null}
    </>
  )
}
