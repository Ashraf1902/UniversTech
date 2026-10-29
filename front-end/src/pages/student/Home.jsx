import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync, useDemoMode, useUniversityTimezone } from '../../lib/hooks'
import {
  currentWeek,
  formatDate,
  formatTime,
  nextLecture,
  nowInTimezone,
  timeToMinutes,
} from '../../lib/timetable'
import { Badge, Empty, I, Prog, Reveal, Spinner } from '../../lib/ui'
import { money } from './_shared'

function MiniEmpty({ icon, title, sub }) {
  return (
    <div className="home-empty">
      <span className="home-empty-icon">
        <I name={icon} size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </div>
  )
}

export function StudentHome() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const timezone = useUniversityTimezone()
  const demo = useDemoMode()

  const profile = useAsync(() => request('/api/user'))
  const reports = useAsync(() => request('/api/user/reports'))
  const schedule = useAsync(() => request('/api/user/schedule'))
  const attendance = useAsync(() => request('/api/user/attendance'))
  const payments = useAsync(() => request('/api/user/payments?page=1'))
  const notices = useAsync(() => request('/api/user/notifications/announcments'))

  const p = profile.data
  const r = reports.data
  const overall = r?.overall || {}
  const courses = r?.courses || []
  const rows = schedule.data?.schedule || []

  const avgProgress = courses.length
    ? Math.round(courses.reduce((sum, c) => sum + (Number(c.progress) || 0), 0) / courses.length)
    : 0

  const now = nowInTimezone(timezone)
  const week = currentWeek(timezone)
  const todayKey = now.weekday
  const todayRows = rows
    .filter((row) => String(row.day_of_week || '').toLowerCase() === todayKey)
    .sort((a, b) => (timeToMinutes(a.start_time) ?? 0) - (timeToMinutes(b.start_time) ?? 0))
  const next = nextLecture(rows, timezone)

  const nextUpIndex = todayRows.findIndex((row) => (timeToMinutes(row.start_time) ?? 0) > now.minutes)
  const lectureState = (row, index) => {
    const start = timeToMinutes(row.start_time)
    const end = timeToMinutes(row.end_time)
    if (start == null || end == null) return ''
    if (start <= now.minutes && end > now.minutes) return 'now'
    if (end <= now.minutes) return 'done'
    return index === nextUpIndex ? 'next' : 'later'
  }

  const attendanceData = attendance.data || {}
  const attendanceCourses = attendanceData.courses || []
  const thresholds = attendanceData.thresholds || {}
  const sessionsTotal = attendanceCourses.reduce((sum, c) => sum + (Number(c.total) || 0), 0)
  const presentTotal = attendanceCourses.reduce((sum, c) => sum + (Number(c.present) || 0), 0)
  const absentTotal = attendanceCourses.reduce((sum, c) => sum + (Number(c.absent) || 0), 0)

  const paymentPage = normalizePage(payments.data)
  const latestPayment = paymentPage.items[0]

  const noticeList = Array.isArray(notices.data) ? notices.data : notices.data?.data || []

  const firstName = user?.name?.split(' ')[0] || t('student')
  const dayCount = (day) => rows.filter((row) => String(row.day_of_week || '').toLowerCase() === day).length

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-main">
          <span className="home-term">
            <span className="gd" /> {t('activeTerm')}
          </span>
          <h1>{t('welcomeBack', { name: firstName })}</h1>
          <p>
            {p?.level?.name || t('yourYear')} · {p?.department?.name || t('general')}
          </p>
          <div className="home-stats">
            <div>
              <strong>{courses.length}</strong>
              <span>{t('courseCount', { n: courses.length })}</span>
            </div>
            <div>
              <strong>{overall.cumulative_gpa ?? '—'}</strong>
              <span>{t('cumulativeGpa')}</span>
            </div>
            <div>
              <strong>{avgProgress}%</strong>
              <span>{t('averageProgress')}</span>
            </div>
          </div>
        </div>

        <div className="home-next">
          <span className="home-next-label">
            <I name="calendar" size={15} /> {t('nextLecture')}
          </span>
          {next ? (
            <>
              <strong>{next.row.course_name}</strong>
              <span className="home-next-time">
                {formatDate(next.date, lang, timezone, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                {formatTime(next.row.start_time, timezone)}–{formatTime(next.row.end_time, timezone)}
              </span>
              <div className="home-next-tags">
                {next.row.course_code ? <Badge>{next.row.course_code}</Badge> : null}
                {next.row.section_type ? (
                  <Badge tone="cy">{t('type_' + String(next.row.section_type).toLowerCase())}</Badge>
                ) : null}
                {next.live ? <Badge tone="grn" dot>{t('lectureNow')}</Badge> : null}
              </div>
            </>
          ) : (
            <div className="home-next-empty">
              <strong>{t('nextLectureNone')}</strong>
              <span>{t('nextLectureNoneSub')}</span>
            </div>
          )}
        </div>
      </section>

      <section className="home-week" aria-label={t('currentWeek')}>
        <div className="home-week-head">
          <h2>{t('currentWeek')}</h2>
          <Link to="/app/student/schedule" className="home-link">
            {t('viewSchedule')} <I name="arrow" size={14} />
          </Link>
        </div>
        <div className="home-week-strip">
          {week.map((d) => {
            const count = dayCount(d.day)
            return (
              <Link
                key={d.day}
                to="/app/student/schedule"
                className={`week-day ${d.isToday ? 'is-today' : ''}`}
                aria-label={formatDate(d.date, lang, timezone, { weekday: 'long', day: 'numeric', month: 'long' })}
              >
                <span>{formatDate(d.date, lang, timezone, { weekday: 'short' })}</span>
                <strong>{formatDate(d.date, lang, timezone, { day: 'numeric' })}</strong>
                <span className={`week-count ${count ? 'has' : ''}`}>{count || ''}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="home-grid">
        <div className="home-col">
          <Reveal className="card home-today">
            <div className="card-head">
              <div>
                <h3>{t('todayLectures')}</h3>
                <span className="home-card-sub">
                  {formatDate(now.date, lang, timezone, { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <Badge tone="vio">{todayRows.length}</Badge>
            </div>

            {schedule.loading ? (
              <Spinner size={22} />
            ) : todayRows.length ? (
              <div className="home-lectures">
                {todayRows.map((row, index) => {
                  const state = lectureState(row, index)
                  return (
                    <div key={row.id ?? index} className={`lecture-row is-${state || 'later'}`}>
                      <div className="lecture-time">
                        <strong>{formatTime(row.start_time, timezone)}</strong>
                        <span>{formatTime(row.end_time, timezone)}</span>
                      </div>
                      <span className="lecture-bar" />
                      <div className="lecture-body">
                        <strong>{row.course_name}</strong>
                        <span>
                          {row.course_code || '—'}
                          {row.section_type ? ` · ${t('type_' + String(row.section_type).toLowerCase())}` : ''}
                        </span>
                      </div>
                      {state === 'now' ? <Badge tone="grn" dot>{t('lectureNow')}</Badge> : null}
                      {state === 'next' ? <Badge tone="amb">{t('lectureNext')}</Badge> : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty icon="calendar" title={t('todayNoLectures')} sub={t('todayNoLecturesSub')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.05}>
            <div className="card-head">
              <div>
                <h3>{t('courseProgress')}</h3>
                <span className="home-card-sub">{t('studentCoursesSub')}</span>
              </div>
              <Link to="/app/student/courses" className="home-link">
                {t('viewAll')} <I name="arrow" size={14} />
              </Link>
            </div>
            {reports.loading ? (
              <Spinner size={22} />
            ) : courses.length ? (
              <div className="home-progress">
                {courses.map((course) => {
                  const pct = course.total_lectures
                    ? Math.min(100, Math.round((course.progress / course.total_lectures) * 100))
                    : 0
                  return (
                    <div key={course.course_name} className="home-progress-row">
                      <div className="home-progress-top">
                        <span>{course.course_name}</span>
                        <span>{t('progressFraction', { done: course.progress, total: course.total_lectures, pct })}</span>
                      </div>
                      <Prog value={pct} tone="cy" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty
                icon="book"
                title={t('noCoursesYet')}
                sub={t('registerInCatalog')}
                action={
                  <Link to="/app/student/catalog">
                    <span className="btn btn-primary btn-sm">{t('openCatalog')}</span>
                  </Link>
                }
              />
            )}
          </Reveal>
        </div>

        <div className="home-col home-col-side">
          <Reveal className="card home-attendance" delay={0.06}>
            <div className="card-head">
              <h3>{t('attendanceThisTerm')}</h3>
              <Link to="/app/student/attendance" className="home-link">
                {t('viewAttendance')} <I name="arrow" size={14} />
              </Link>
            </div>
            {attendance.loading ? (
              <Spinner size={20} />
            ) : (
              <>
                <div className="att-summary">
                  <div>
                    <strong>{sessionsTotal}</strong>
                    <span>{t('sessions')}</span>
                  </div>
                  <div>
                    <strong>{presentTotal}</strong>
                    <span>{t('present')}</span>
                  </div>
                  <div>
                    <strong>{absentTotal}</strong>
                    <span>{t('absent')}</span>
                  </div>
                </div>
                {sessionsTotal ? (
                  <div className="att-courses">
                    {attendanceCourses.map((course) => (
                      <div key={course.course_id} className="att-course">
                        <span>{course.course_name}</span>
                        <strong>{Number(course.absence_percentage) || 0}%</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <MiniEmpty icon="check" title={t('noAttendanceYet')} sub={t('noAttendanceYetSub')} />
                )}
                {thresholds.warn || thresholds.bar ? (
                  <p className="home-hint">{t('thresholdHint', { warn: thresholds.warn, bar: thresholds.bar })}</p>
                ) : null}
              </>
            )}
          </Reveal>

          <Reveal className="card home-payments" delay={0.1}>
            <div className="card-head">
              <h3>{t('paymentsThisTerm')}</h3>
              <Link to="/app/student/payments" className="home-link">
                {t('viewPayments')} <I name="arrow" size={14} />
              </Link>
            </div>
            {payments.loading ? (
              <Spinner size={20} />
            ) : latestPayment ? (
              <>
                <div className="payment-line">
                  <span className="home-empty-icon">
                    <I name="wallet" size={18} />
                  </span>
                  <div>
                    <strong>{money(latestPayment.amount)}</strong>
                    <small>
                      {latestPayment.receipt_number || '—'}
                      {latestPayment.created_at ? ` · ${new Date(latestPayment.created_at).toLocaleDateString()}` : ''}
                    </small>
                  </div>
                  <Badge tone={latestPayment.status === 'paid' ? 'grn' : 'amb'}>
                    {t('status_' + latestPayment.status)}
                  </Badge>
                </div>
                <p className="home-hint">{t('paymentsSummary', { n: paymentPage.total })}</p>
              </>
            ) : (
              <MiniEmpty icon="wallet" title={t('noPaymentsYet')} sub={t('noPaymentsYetSub')} />
            )}
            {demo ? <span className="demo-chip">{t('demoPaymentsShort')}</span> : null}
          </Reveal>

          <Reveal className="card home-announcements" delay={0.14}>
            <div className="card-head">
              <div>
                <h3>{t('announcements')}</h3>
                <span className="home-card-sub">{t('announcementsSubShort')}</span>
              </div>
              <Link to="/app/student/notifications" className="home-link">
                {t('viewAll')} <I name="arrow" size={14} />
              </Link>
            </div>
            {notices.loading ? (
              <Spinner size={20} />
            ) : noticeList.length ? (
              <div className="home-notices">
                {noticeList.slice(0, 3).map((n) => (
                  <div key={n.id} className="home-notice">
                    <span className="home-notice-icon">
                      <I name={n.type === 'event' ? 'spark' : 'bell'} size={16} />
                    </span>
                    <div>
                      <strong>{n.title}</strong>
                      <small>{n.created_at}</small>
                    </div>
                    {n.type ? (
                      <Badge tone={n.type === 'event' ? 'cy' : 'vio'}>
                        {n.type === 'event' ? t('events') : t('notifications')}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <MiniEmpty icon="bell" title={t('noNotifications')} />
            )}
          </Reveal>
        </div>
      </div>
    </>
  )
}
