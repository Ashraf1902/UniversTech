import { Link } from 'react-router-dom'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/hooks'
import { Btn, Counter, Empty, I, Prog, Reveal, Spinner, StatCard } from '../../lib/ui'
export function StudentHome() {
  const { user } = useAuth()
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
          <span className="gd" /> Active term
        </span>
        <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', marginBottom: 10 }}>
          Welcome back, <span className="grad-text">{user?.name?.split(' ')[0] || 'student'}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 620 }}>
          {p?.level?.name || 'Your year'} · {p?.department?.name || 'General'} · {avgProgress}% average progress across your courses.
        </p>
      </Reveal>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="book" label="Registered courses" value={courses.length} tone="vio" delay={0} />
        <StatCard icon="chart" label="Average progress" value={<Counter to={avgProgress} suffix="%" />} tone="cy" delay={0.06}>
          <div style={{ marginTop: 12 }}>
            <Prog value={avgProgress} tone="cy" sm />
          </div>
        </StatCard>
        <StatCard icon="award" label="Cumulative GPA" value={overall.cumulative_gpa ?? '—'} sub={overall.rate ? `Rate ${overall.rate}` : 'No grades yet'} tone="grn" delay={0.12} />
        <StatCard icon="calendar" label="Attendance" value={attendance} sub={`${absences} absences`} tone="amb" delay={0.18} />
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head">
            <h3>Course progress</h3>
            <Link to="/app/student/courses" className="badge vio">View all</Link>
          </div>
          {reports.loading ? <Spinner /> : courses.length ? (
            courses.slice(0, 5).map((c) => {
              const pct = c.total_lectures ? Math.round((c.progress / c.total_lectures) * 100) : 0
              return (
                <div key={c.course_name} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.course_name}</span>
                    <span style={{ color: 'var(--muted)' }}>{c.progress}/{c.total_lectures} · {pct}%</span>
                  </div>
                  <Prog value={pct} />
                </div>
              )
            })
          ) : (
            <Empty icon="book" title="No courses yet" sub="Register for courses in the catalog to get started." action={<Link to="/app/student/catalog"><Btn size="sm">Open catalog</Btn></Link>} />
          )}
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>Next classes</h3>
              <Link to="/app/student/schedule" className="badge cy">Schedule</Link>
            </div>
            {sched.slice(0, 4).map((s, i) => (
              <div className="list-row" key={i}>
                <span className="av" style={{ background: 'var(--grad)', width: 40, height: 40, fontSize: '0.7rem' }}>
                  {String(s.day_of_week || '').slice(0, 3)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.course_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{s.start_time} – {s.end_time} · {s.section_type}</div>
                </div>
              </div>
            ))}
            {!sched.length && !schedule.loading ? <Empty icon="calendar" title="No schedule yet" /> : null}
          </Reveal>

          <Reveal className="card" delay={0.14}>
            <div className="card-head">
              <h3>Latest notices</h3>
              <Link to="/app/student/notifications" className="badge pnk">All</Link>
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
            {!notes.length && !notifs.loading ? <Empty icon="bell" title="No notifications" /> : null}
          </Reveal>
        </div>
      </div>
    </>
  )
}
