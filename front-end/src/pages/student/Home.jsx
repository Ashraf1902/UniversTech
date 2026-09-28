import { Link } from 'react-router-dom'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, Counter, Empty, I, Prog, Reveal, Spinner, StatCard } from '../../lib/ui'
export function StudentHome() {
  const { user } = useAuth()
  const { t } = useI18n()
  const profile = useAsync(() => request('/api/user'))
  const reports = useAsync(() => request('/api/user/reports'))
  const notifs = useAsync(() => request('/api/user/notifications'))
  const schedule = useAsync(() => request('/api/user/schedule'))

  const p = profile.data
  const r = reports.data
  const overall = r?.overall || {}
  const courses = r?.courses || []
  const avgProgress = courses.length ? Math.round(courses.reduce((a, c) => a + (Number(c.progress) || 0), 0) / courses.length) : 0
  const attendance = courses.reduce((a, c) => a + (c.present || 0), 0)
  const absences = courses.reduce((a, c) => a + (c.absent || 0), 0)
  const sched = schedule.data?.schedule || []
  const notes = Array.isArray(notifs.data) ? notifs.data : notifs.data?.data || []

  return (
    <>
      <Reveal className="cta-band" style={{ padding: '40px 34px', marginBottom: 28, textAlign: 'left' }}>
<span className="badge grn" style={{ marginBottom: 14 }}>
          <span className="gd" /> {t('activeTerm')}
        </span>
        <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', marginBottom: 10 }}>
          <span className="grad-text">{t('welcomeBack', { name: user?.name?.split(' ')[0] || t('student') })}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 620 }}>
          {p?.level?.name || t('yourYear')} · {p?.department?.name || t('general')} · {t('avgProgressLine', { avg: avgProgress })}
        </p>
      </Reveal>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="book" label={t('registeredCourses')} value={courses.length} tone="vio" delay={0} />
        <StatCard icon="chart" label={t('averageProgress')} value={<Counter to={avgProgress} suffix="%" />} tone="cy" delay={0.06}>
          <div style={{ marginTop: 12 }}>
            <Prog value={avgProgress} tone="cy" sm />
          </div>
        </StatCard>
        <StatCard icon="award" label={t('cumulativeGpa')} value={overall.cumulative_gpa ?? '—'} sub={overall.rate ? t('ratePrefix', { rate: overall.rate }) : t('noGradesYet')} tone="grn" delay={0.12} />
        <StatCard icon="calendar" label={t('attendance')} value={attendance} sub={t('absencesCount', { n: absences })} tone="amb" delay={0.18} />
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head">
            <h3>{t('courseProgress')}</h3>
            <Link to="/app/student/courses" className="badge vio">{t('viewAll')}</Link>
          </div>
          {reports.loading ? <Spinner /> : courses.length ? (
            courses.slice(0, 5).map((c) => {
              const pct = c.total_lectures ? Math.round((c.progress / c.total_lectures) * 100) : 0
              return (
                <div key={c.course_name} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.course_name}</span>
                    <span style={{ color: 'var(--muted)' }}>{t('progressFraction', { done: c.progress, total: c.total_lectures, pct })}</span>
                  </div>
                  <Prog value={pct} />
                </div>
              )
            })
          ) : (
            <Empty icon="book" title={t('noCoursesYet')} sub={t('registerInCatalog')} action={<Link to="/app/student/catalog"><Btn size="sm">{t('openCatalog')}</Btn></Link>} />
          )}
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>{t('nextClasses')}</h3>
              <Link to="/app/student/schedule" className="badge cy">{t('schedule')}</Link>
            </div>
            {sched.slice(0, 4).map((s, i) => (
              <div className="list-row" key={i}>
                <span className="av" style={{ background: 'var(--grad)', width: 40, height: 40, fontSize: '0.7rem' }}>
                  {t('dayShort_' + String(s.day_of_week || '').toLowerCase())}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.course_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{s.start_time} – {s.end_time} · {t('type_' + String(s.section_type || '').toLowerCase())}</div>
                </div>
              </div>
            ))}
            {!sched.length && !schedule.loading ? <Empty icon="calendar" title={t('noScheduleYet')} /> : null}
          </Reveal>

          <Reveal className="card" delay={0.14}>
            <div className="card-head">
              <h3>{t('latestNotices')}</h3>
              <Link to="/app/student/notifications" className="badge pnk">{t('all')}</Link>
            </div>
            {notes.slice(0, 3).map((n) => (
              <div className="list-row" key={n.id}>
                <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6', width: 40, height: 40 }}>
                  <I name="bell" size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{n.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{n.created_at}</div>
                </div>
              </div>
            ))}
            {!notes.length && !notifs.loading ? <Empty icon="bell" title={t('noNotifications')} /> : null}
          </Reveal>
        </div>
      </div>
    </>
  )
}
