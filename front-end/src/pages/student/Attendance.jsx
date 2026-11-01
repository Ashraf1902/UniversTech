import { useState } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Reveal, Ring, Spinner } from '../../lib/ui'
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

function clampPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function CourseAttendance({ course, delay = 0 }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const records = course.records || []
  const absence = clampPct(course.absence_percentage)
  const status = course.status || 'ok'

  return (
    <Reveal className="card std-att-card" delay={delay}>
      <div className="std-att-head">
        <div>
          <h3>{course.course_name}</h3>
          <div className="std-card-sub">
            {course.course_code || '—'} · {t('warnThresholdLabel', { n: course.warn_threshold })} · {t('barThresholdLabel', { n: course.bar_threshold })}
          </div>
        </div>
        <div className="std-att-rate">
          <strong>{course.absence_percentage ?? 0}%</strong>
          <span>{t('absenceRate')}</span>
        </div>
      </div>

      <div className="std-att-counts">
        <Badge tone="grn">{t('presentCount', { n: course.present })}</Badge>
        <Badge tone={course.absent ? 'red' : ''}>{t('absentCount', { n: course.absent })}</Badge>
        <Badge>{t('totalSessions')}: {course.total}</Badge>
        <StatusBadge status={status} />
      </div>

      <div className="std-scale">
        <div
          className="std-scale-track"
          role="img"
          aria-label={`${t('absenceRate')}: ${absence}%`}
        >
          <span className={`std-scale-fill is-${status}`} style={{ width: `${absence}%` }} />
          {course.warn_threshold != null ? (
            <i className="std-scale-mark is-warn" style={{ insetInlineStart: `${clampPct(course.warn_threshold)}%` }} />
          ) : null}
          {course.bar_threshold != null ? (
            <i className="std-scale-mark is-bar" style={{ insetInlineStart: `${clampPct(course.bar_threshold)}%` }} />
          ) : null}
        </div>
        <div className="std-scale-legend">
          <span className="std-legend is-warn">{t('warnThresholdLabel', { n: course.warn_threshold })}</span>
          <span className="std-legend is-bar">{t('barThresholdLabel', { n: course.bar_threshold })}</span>
        </div>
      </div>

      {status === 'barred' ? (
        <div className="form-alert" role="status">{t('barredNotice')}</div>
      ) : null}

      {records.length ? (
        <>
          <Btn size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <I name="chevronDown" size={15} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            {open ? t('hideRecords') : t('showRecords')}
          </Btn>
          {open ? (
            <div className="std-att-records">
              {records.map((r) => (
                <div className="std-record" key={r.id}>
                  <span className="std-record-date">{r.date || '—'}</span>
                  <div className="std-record-lecture">
                    <strong>{r.lecture || '—'}</strong>
                    <span>
                      {r.reason || '—'} · {t('recordedBy')}: {r.recorded_by || '—'}
                    </span>
                  </div>
                  {r.present ? <Badge tone="grn">{t('present')}</Badge> : <Badge tone="red">{t('absent')}</Badge>}
                </div>
              ))}
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

  const totals = courses.reduce(
    (acc, course) => {
      acc.total += Number(course.total) || 0
      acc.present += Number(course.present) || 0
      acc.absent += Number(course.absent) || 0
      return acc
    },
    { total: 0, present: 0, absent: 0 },
  )
  const attendanceRate = totals.total ? Math.round((totals.present / totals.total) * 100) : 0
  const overallAbsence = totals.total ? Math.round((totals.absent / totals.total) * 100) : 0
  const atRisk = courses.filter((course) => course.status && course.status !== 'ok').length

  return (
    <>
      <Head kicker={t('attendance')} title={t('myAttendance')} sub={t('myAttendanceSub')} />

      {courses.length ? (
        <Reveal className="std-hero std-hero--attendance">
          <div className="std-hero-body">
            <span className="std-eyebrow">{t('attendanceSummary')}</span>
            <h2 className="std-hero-title">{t('myAttendance')}</h2>
            <p className="std-hero-note">{t('attendanceHeroNote')}</p>
          </div>
          <div className="std-hero-ring">
            <Ring value={attendanceRate} max={100} size={122} label={`${attendanceRate}%`} sub={t('attendanceRate')} />
          </div>
          <dl className="std-hero-stats">
            <div>
              <dt>{t('sessionsAttended')}</dt>
              <dd>{totals.present}<span className="std-stat-of">/{totals.total}</span></dd>
            </div>
            <div>
              <dt>{t('overallAbsence')}</dt>
              <dd>{overallAbsence}%</dd>
            </div>
            <div>
              <dt>{t('coursesAtRisk')}</dt>
              <dd>{atRisk}</dd>
            </div>
          </dl>
        </Reveal>
      ) : null}

      {courses.length ? (
        <div className="std-att-grid">
          {courses.map((course, index) => (
            <CourseAttendance key={course.course_id} course={course} delay={index * 0.05} />
          ))}
        </div>
      ) : (
        <Reveal className="card">
          <Empty icon="calendar" title={t('noAttendanceYet')} sub={t('noAttendanceYetSub')} />
        </Reveal>
      )}
    </>
  )
}
