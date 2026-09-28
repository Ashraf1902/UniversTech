import { Link } from 'react-router-dom'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, Empty, I, Reveal, Spinner, StatCard } from '../../lib/ui'
import { useMyCourses } from './_shared'
export function ProfessorHome() {
  const { user } = useAuth()
  const { t } = useI18n()
  const profile = useAsync(() => request('/api/professor/profile'))
  const { courses, loading: coursesLoading } = useMyCourses()
  const events = useAsync(() => request('/api/professor/event/get/new'))
  const notifs = useAsync(() => request('/api/professor/notifications'))

  const p = profile.data
  const lectureTotal = courses.reduce((a, c) => a + (c.lectures?.length || 0), 0)
  const eventList = Array.isArray(events.data) ? events.data : events.data?.data || []
  const notes = Array.isArray(notifs.data) ? notifs.data : notifs.data?.data || []

  return (
    <>
      <Reveal className="cta-band" style={{ padding: '40px 34px', marginBottom: 28, textAlign: 'left' }}>
<span className="badge cy" style={{ marginBottom: 14 }}>
          <span className="gd" /> {t('facultyConsole')}
        </span>
        <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', marginBottom: 10 }}>
          {t('helloPre')} <span className="grad-text">{t('profTitle', { name: user?.name?.split(' ').slice(-1)[0] || t('profPrefix') })}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 620 }}>
          {p?.job_title || t('facultyMember')} · {p?.department?.name || t('university')} — {t('manageLine')}
        </p>
      </Reveal>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="book" label={t('myCourses')} value={courses.length} tone="vio" />
        <StatCard icon="file" label={t('lecturesUploaded')} value={lectureTotal} tone="cy" delay={0.06} />
        <StatCard icon="users" label={t('studentsTaught')} value={courses.reduce((a, c) => a + (c.students_count || 0), 0) || '—'} tone="grn" delay={0.12} />
        <StatCard icon="bell" label={t('notifications')} value={notes.length} tone="pnk" delay={0.18} />
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head">
            <h3>{t('myCourses')}</h3>
            <Link to="/app/professor/courses" className="badge vio">{t('manage')}</Link>
          </div>
          {coursesLoading ? <Spinner /> : courses.length ? (
            courses.slice(0, 5).map((c) => (
              <div className="list-row" key={c.id}>
                <span className="av" style={{ background: 'var(--grad)' }}>{String(c.course_code || c.course_name || '?').slice(0, 2)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.course_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{c.department?.name || t('general')} · {t('lecturesCount', { n: c.lectures?.length || 0 })}</div>
                </div>
                <Link to={`/app/professor/lectures?course=${c.id}`}><Btn size="sm" variant="soft" icon="upload">{t('content')}</Btn></Link>
              </div>
            ))
          ) : (
            <Empty icon="book" title={t('noCoursesAssigned')} sub={t('noCoursesAssignedSub')} />
          )}
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>{t('latestEvents')}</h3>
            </div>
            {eventList.slice(0, 4).map((e, i) => (
              <div className="list-row" key={e.id || i}>
                <span className="av" style={{ background: 'linear-gradient(135deg,#ffce66,#f563b0)', width: 40, height: 40 }}>
                  <I name="spark" size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.title || e.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{e.created_at || ''}</div>
                </div>
              </div>
            ))}
            {!eventList.length && !events.loading ? <Empty icon="spark" title={t('noNewEvents')} /> : null}
          </Reveal>

          <Reveal className="card" delay={0.14}>
            <div className="card-head">
              <h3>{t('notifications')}</h3>
              <Link to="/app/professor/notifications" className="badge pnk">{t('all')}</Link>
            </div>
            {notes.slice(0, 3).map((n) => (
              <div className="list-row" key={n.id}>
                <span className="av" style={{ background: 'rgba(124,92,255,.16)', color: '#a48bff', width: 40, height: 40 }}>
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
