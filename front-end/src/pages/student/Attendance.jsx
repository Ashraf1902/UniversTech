import { useState } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Empty, Prog, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'

const STATUS_META = {
  ok: { tone: 'grn', key: 'status_ok' },
  warning: { tone: 'amb', key: 'status_warning' },
  barred: { tone: 'red', key: 'status_barred' },
}

function StatusBadge({ status }) {
  const { t } = useI18n()
  const meta = STATUS_META[status] || STATUS_META.ok
  return <Badge tone={meta.tone} dot>{t(meta.key)}</Badge>
}

function CourseAttendance({ course }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const records = course.records || []

  return (
    <Reveal className="card" style={{ marginBottom: 20 }}>
      <div className="card-head">
        <div>
          <h3 style={{ marginBottom: 4 }}>{course.course_name}</h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
            {course.course_code || ''} · {t('warnThresholdLabel', { n: course.warn_threshold })} · {t('barThresholdLabel', { n: course.bar_threshold })}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem' }}>{course.absence_percentage}%</div>
          <StatusBadge status={course.status} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <Badge tone="grn">{t('presentCount', { n: course.present })}</Badge>
        <Badge tone={course.absent ? 'red' : ''}>{t('absentCount', { n: course.absent })}</Badge>
        <Badge>{t('totalSessions')}: {course.total}</Badge>
      </div>

      <Prog value={course.absence_percentage} tone={course.status === 'barred' ? '' : 'cy'} />

      {course.status === 'barred' ? (
        <div className="form-alert" role="status" style={{ marginTop: 14 }}>{t('barredNotice')}</div>
      ) : null}

      {records.length ? (
        <>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setOpen((o) => !o)}>
            {t('attendanceRecords')}
          </button>
          {open ? (
            <div className="table-wrap" style={{ border: 'none', background: 'transparent', marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr><th>{t('date')}</th><th>{t('lecture')}</th><th>{t('status')}</th><th>{t('reason')}</th><th>{t('recordedBy')}</th></tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date || '—'}</td>
                      <td className="cell-main">{r.lecture || '—'}</td>
                      <td>{r.present ? <Badge tone="grn">{t('present')}</Badge> : <Badge tone="red">{t('absent')}</Badge>}</td>
                      <td style={{ maxWidth: 260 }}>{r.reason || '—'}</td>
                      <td>{r.recorded_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </Reveal>
  )
}

export function StudentAttendance() {
  const { t } = useI18n()
  const { data, loading } = useAsync(() => request('/api/user/attendance'))

  if (loading) return <Spinner size={26} />
  const courses = data?.courses || []

  return (
    <>
      <Head kicker={t('attendance')} title={t('myAttendance')} sub={t('myAttendanceSub')} />
      {courses.length ? (
        courses.map((c) => <CourseAttendance key={c.course_id} course={c} />)
      ) : (
        <Reveal className="card">
          <Empty icon="calendar" title={t('noAttendanceYet')} sub={t('noAttendanceYetSub')} />
        </Reveal>
      )}
    </>
  )
}
