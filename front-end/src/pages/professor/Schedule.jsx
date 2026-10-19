import { useMemo } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync, useUniversityTimezone } from '../../lib/hooks'
import { Badge, Empty, I, Reveal, Spinner } from '../../lib/ui'
import { dateLabel, dayIndex, formatTime, weekdayLabel } from '../../lib/timetable'
import { Head } from './_shared'

export function ProfessorSchedule() {
  const { t, lang } = useI18n()
  const timezone = useUniversityTimezone()
  const { data, loading } = useAsync(() => request('/api/professor/schedule'))
  const rows = data?.schedule || []
  const days = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      const key = r.day_of_week || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    return [...map.entries()].sort((a, b) => dayIndex(a[0]) - dayIndex(b[0]))
  }, [rows])

  return (
    <>
      <Head kicker={data?.active_semester || t('timetable')} title={t('myTimetable')} sub={t('myTimetableSub')} />
      {loading ? (
        <Spinner size={24} />
      ) : days.length ? (
        <div className="grid grid-3">
          {days.map(([day, items], di) => (
            <Reveal key={day} className="card" delay={di * 0.06}>
              <div className="card-head">
                <h3 style={{ fontSize: '1rem' }}>
                  {weekdayLabel(day, lang, timezone) || t('day_' + String(day).toLowerCase())}
                  {dateLabel(day, lang, timezone) ? <span style={{ color: 'var(--faint)', fontWeight: 400, marginInlineStart: 8, fontSize: '0.8rem' }}>{dateLabel(day, lang, timezone)}</span> : null}
                </h3>
                <Badge tone="vio">{items.length}</Badge>
              </div>
              {items.map((s, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="av" style={{ width: 34, height: 34, fontSize: '0.7rem', background: 'var(--grad)' }}>
                      <I name="clock" size={15} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.course_name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{formatTime(s.start_time, timezone)} – {formatTime(s.end_time, timezone)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {s.section_type ? <Badge tone="cy">{t('type_' + String(s.section_type).toLowerCase())}</Badge> : null}
                    {s.course_code ? <Badge>{s.course_code}</Badge> : null}
                    {s.room ? <Badge tone="vio"><I name="building" size={12} /> {s.room}{s.building ? ` · ${s.building}` : ''}</Badge> : null}
                  </div>
                </div>
              ))}
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="calendar" title={t('noTimetable')} sub={t('noTimetableSub')} />
      )}
    </>
  )
}
