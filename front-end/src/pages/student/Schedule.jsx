import { useMemo } from 'react'
import { request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'
export function StudentSchedule() {
  const { data, loading } = useAsync(() => request('/api/user/schedule'))
  const rows = data?.schedule || []
  const days = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      const key = r.day_of_week || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    return [...map.entries()]
  }, [rows])

  return (
    <>
      <Head kicker="This term" title="Weekly schedule" sub="Your classes for the active semester, sorted by day." />
      {loading ? (
        <Spinner size={24} />
      ) : days.length ? (
        <div className="grid grid-3">
          {days.map(([day, items], di) => (
            <Reveal key={day} className="card" delay={di * 0.06}>
              <div className="card-head">
                <h3 style={{ fontSize: '1rem' }}>{day}</h3>
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
                      <div style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{s.start_time} – {s.end_time}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {s.section_type ? <Badge tone="cy">{s.section_type}</Badge> : null}
                    {s.course_code ? <Badge>{s.course_code}</Badge> : null}
                    {s.path ? <a href={s.path} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}><Btn size="sm" variant="soft" icon="file">File</Btn></a> : null}
                  </div>
                </div>
              ))}
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="calendar" title="No schedule published" sub="Your schedule will appear here once the administration publishes it." />
      )}
    </>
  )
}
