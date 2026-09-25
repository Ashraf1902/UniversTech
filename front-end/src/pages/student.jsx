import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request, normalizePage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/hooks'
import { Badge, Btn, Counter, CourseLoader, Empty, Field, I, Modal, Pager, Prog, RateBadge, Reveal, Ring, Spinner, StatCard, useToast } from '../lib/ui'

const money = (n) => `EGP ${Number(n || 0).toLocaleString()}`

function Head({ kicker, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {sub ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

function CourseCard({ course, footer, delay = 0 }) {
  const cover = course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null
  return (
    <Reveal className="card" delay={delay} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 128, position: 'relative', background: cover ? `center/cover url(${cover})` : 'var(--grad)' }}>
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(4,5,14,.85))' }} />
        {course.course_code ? (
          <span className="badge vio" style={{ position: 'absolute', top: 12, left: 12 }}>{course.course_code}</span>
        ) : null}
        {course.no_of_hours ? (
          <span className="badge" style={{ position: 'absolute', top: 12, right: 12 }}>{course.no_of_hours} cr</span>
        ) : null}
      </div>
      <div style={{ padding: 20 }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{course.course_name}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', marginBottom: 16 }}>
          {course.professor || course.course_professor || 'No professor assigned'}
        </p>
        {footer}
      </div>
    </Reveal>
  )
}

/* ============ HOME ============ */
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

/* ============ COURSES ============ */
export function StudentCourses() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { data, loading, error, run } = useAsync(() => request(`/api/user/courses?page=${page}`), [page])
  const paged = normalizePage(data)
  const paywall = error && (error.status === 403 || /pay/i.test(error.message))

  const pay = async (type) => {
    try {
      await request('/api/user/make-payment', { method: 'POST', data: { type } })
      toast.success('Payment successful. Your courses are unlocked!')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker="My learning"
        title="My courses"
        sub="Everything you are enrolled in this term, with live progress."
        actions={
          <Link to="/app/student/catalog">
            <Btn icon="plus">Register courses</Btn>
          </Link>
        }
      />

      {paywall ? (
        <Reveal className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="eic" style={{ margin: '0 auto 16px' }}>
            <I name="wallet" size={26} />
          </div>
          <h3>Unlock your registered courses</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '10px auto 24px' }}>
            You have not paid for your courses yet. Choose a plan below to unlock lectures, quizzes, and progress tracking.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn icon="wallet" onClick={() => pay('courses')}>Pay {money(700)} — Courses</Btn>
            <Btn variant="ghost" icon="wallet" onClick={() => pay('year')}>Pay {money(575)} — Year</Btn>
          </div>
        </Reveal>
      ) : loading ? (
        <CourseLoader label="Loading your courses…" />
      ) : paged.items.length ? (
        <>
          <div className="grid grid-3">
            {paged.items.map((c, i) => (
              <CourseCard
                key={c.id}
                course={c}
                delay={i * 0.05}
                footer={
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
                      <span>Progress</span>
                      <span>{c.progress}/{c.total_lectures} lectures</span>
                    </div>
                    <Prog value={c.progress_percent} tone="cy" />
                    <Link to={`/app/student/course/${c.course_id}`} style={{ display: 'block', marginTop: 18 }}>
                      <Btn variant="soft" className="btn-block" iconRight="arrow">Continue learning</Btn>
                    </Link>
                  </>
                }
              />
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="book" title="You are not registered in any course" sub="Browse the catalog and register for this semester's courses." action={<Link to="/app/student/catalog"><Btn>Open catalog</Btn></Link>} />
      )}
    </>
  )
}

/* ============ CATALOG ============ */
export function StudentCatalog() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request(`/api/user/all-courses?page=${page}`), [page])
  const paged = normalizePage(data)

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const register = async () => {
    if (!selected.length) return toast.info('Select at least one course first.')
    setBusy(true)
    try {
      const res = await request('/api/user/register-course', { method: 'POST', data: { course_ids: selected } })
      toast.success(res?.registered?.length ? `Registered ${res.registered.length} course(s).` : 'Registration completed.')
      setSelected([])
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head
        kicker="Catalog"
        title="Register for courses"
        sub="Pick the courses for your semester, then confirm your registration."
        actions={
          <Btn loading={busy} onClick={register} icon="check">
            Register {selected.length ? `(${selected.length})` : ''}
          </Btn>
        }
      />

      {loading ? (
        <div className="grid grid-3">{[0, 1, 2, 3, 4, 5].map((i) => <div className="card" key={i}><div className="sk" style={{ height: 160 }} /></div>)}</div>
      ) : paged.items.length ? (
        <>
          <div className="grid grid-3">
            {paged.items.map((c, i) => {
              const on = selected.includes(c.id)
              return (
                <Reveal key={c.id} className="fcard" delay={i * 0.04} onClick={() => toggle(c.id)} style={{ cursor: 'pointer', borderColor: on ? 'var(--vio)' : undefined, boxShadow: on ? 'var(--glow-vio)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <span className="fic" style={{ marginBottom: 0, width: 44, height: 44 }}>
                      <I name="book" size={20} />
                    </span>
                    <span className={`rate ${on ? 'r-a' : ''}`} style={{ minWidth: 30, height: 30, background: on ? undefined : 'var(--card)', border: on ? undefined : '1px solid var(--line)' }}>
                      {on ? <I name="check" size={16} /> : ''}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem' }}>{c.course_name}</h3>
                  <p style={{ fontSize: '0.85rem' }}>{c.professor || 'No professor assigned'}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                    {c.no_of_hours ? <Badge tone="cy">{c.no_of_hours} credit hrs</Badge> : null}
                  </div>
                </Reveal>
              )
            })}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="layers" title="No courses available" sub="There are no courses open for your semester and department yet." />
      )}
    </>
  )
}

/* ============ COURSE DETAIL ============ */
export function StudentCourseDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { data: course, loading } = useAsync(() => request(`/api/user/course/${id}`), [id])
  const [watched, setWatched] = useState({})

  const watch = async (lecture) => {
    try {
      await request('/api/user/update_progress', { method: 'PUT', data: { course_id: Number(id), lecture_id: lecture.id } })
      setWatched((w) => ({ ...w, [lecture.id]: true }))
      if (lecture.content) window.open(lecture.content, '_blank', 'noopener')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return <CourseLoader label="Opening course…" />
  if (!course) return <Empty icon="book" title="Course not found" />

  return (
    <>
      <Head kicker="Course" title={course.course_name} sub={`${course.course_code || ''} · ${course.course_professor || 'No professor'}`} actions={<Link to="/app/student/courses"><Btn variant="ghost" icon="chevron" style={{ transform: 'scaleX(-1)' }}>Back</Btn></Link>} />

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card">
            <div className="card-head">
              <h3>Lectures</h3>
              <Badge tone="cy">{course.lectures?.length || 0} total</Badge>
            </div>
            {course.lectures?.length ? (
              course.lectures.map((l, i) => {
                const done = watched[l.id]
                return (
                  <div className="list-row" key={l.id}>
                    <span className="av" style={{ background: done ? 'rgba(52,245,162,.16)' : 'var(--grad)', color: done ? '#8af7c7' : '#fff', width: 40, height: 40 }}>
                      {done ? <I name="check" size={17} /> : i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{l.lecture_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{done ? 'Watched' : 'Not started'}</div>
                    </div>
                    <Btn size="sm" variant="soft" icon="play" onClick={() => watch(l)}>Watch</Btn>
                  </div>
                )
              })
            ) : (
              <Empty icon="file" title="No lectures yet" sub="Your professor has not uploaded any lectures." />
            )}
          </Reveal>

          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>Quizzes</h3>
              <Badge tone="pnk">{course.quizzes?.length || 0} total</Badge>
            </div>
            {course.quizzes?.length ? (
              course.quizzes.map((q) => (
                <div className="list-row" key={q.id}>
                  <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6', width: 40, height: 40 }}>
                    <I name="award" size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{q.due_at ? `Due ${new Date(q.due_at).toLocaleDateString()}` : 'No due date'}</div>
                  </div>
                  <a href={q.content} target="_blank" rel="noreferrer">
                    <Btn size="sm" variant="soft" icon="file">Open</Btn>
                  </a>
                </div>
              ))
            ) : (
              <Empty icon="award" title="No quizzes yet" />
            )}
          </Reveal>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" style={{ textAlign: 'center' }}>
            <div style={{ height: 130, borderRadius: 14, marginBottom: 18, background: course.cover_image && !course.cover_image.endsWith('default.jpg') ? `center/cover url(${course.cover_image})` : 'var(--grad)' }} />
            <div className="gpa-meter" style={{ justifyContent: 'center' }}>
              <Ring value={course.progress_percent || 0} max={100} label={`${Math.round(course.progress_percent || 0)}%`} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Progress</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>across lectures</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  )
}

/* ============ SCHEDULE ============ */
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

/* ============ REPORTS ============ */
export function StudentReports() {
  const { data, loading } = useAsync(() => request('/api/user/reports'))
  if (loading) return <Spinner size={26} />
  const overall = data?.overall || {}
  const cards = data?.semester_cards || []
  const courses = data?.courses || []

  return (
    <>
      <Head kicker="Performance" title="Reports & GPA" sub="Per-semester final scores with letter rates, and your cumulative GPA across all graded subjects." />

      <Reveal className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gpa-meter">
            <Ring value={overall.cumulative_gpa || 0} max={4} size={104} label={overall.cumulative_gpa ?? '—'} sub="CGPA" />
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Cumulative GPA</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>{overall.cumulative_gpa ?? '—'} / 4.0</div>
              {overall.rate ? <RateBadge rate={overall.rate} /> : null}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Graded courses</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_graded_courses ?? 0}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Credit hours</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_credit_hours ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        {cards.length ? (
          cards.map((c, i) => (
            <Reveal key={c.semester?.id ?? i} className="card" delay={i * 0.08}>
              <div className="card-head">
                <div>
                  <h3 style={{ marginBottom: 4 }}>{c.semester?.name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                    {c.semester?.academic_year} · {c.semester?.grading_system === 'fixed_term' ? 'Fixed-Term' : 'Credit-Hour'} system
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem' }}>
                    {c.final_score?.type === 'fixed_term' ? `${c.final_score?.percentage}%` : c.final_score?.gpa}
                  </div>
                  <RateBadge rate={c.final_score?.rate} />
                </div>
              </div>
              <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
                <table className="table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Marks</th>
                      <th>%</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.courses || []).map((row) => (
                      <tr key={row.course_id}>
                        <td className="cell-main">{row.course_name}<div style={{ fontSize: '0.74rem', color: 'var(--faint)', fontWeight: 400 }}>{row.course_code} · {row.credit_hours} cr</div></td>
                        <td>{row.marks}/{row.max_marks}</td>
                        <td style={{ minWidth: 110 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Prog value={row.percentage} sm />
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', minWidth: 36 }}>{row.percentage}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}><RateBadge rate={row.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          ))
        ) : (
          <Reveal className="card" style={{ gridColumn: '1 / -1' }}>
            <Empty icon="award" title="No results yet" sub="Your semester cards will appear here once grades are recorded." />
          </Reveal>
        )}
      </div>

      <Reveal className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h3>Attendance & progress</h3>
        </div>
        {courses.length ? (
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table">
              <thead>
                <tr><th>Course</th><th>Progress</th><th>Present</th><th>Absent</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const pct = c.total_lectures ? Math.round((c.progress / c.total_lectures) * 100) : 0
                  return (
                    <tr key={c.course_name}>
                      <td className="cell-main">{c.course_name}</td>
                      <td style={{ minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Prog value={pct} tone="cy" sm />
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{pct}%</span>
                        </div>
                      </td>
                      <td><Badge tone="grn">{c.present}</Badge></td>
                      <td><Badge tone={c.absent ? 'red' : ''}>{c.absent}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="chart" title="No data yet" />
        )}
      </Reveal>
    </>
  )
}

/* ============ NOTIFICATIONS ============ */
export function StudentNotifications() {
  const [tab, setTab] = useState('notifications')
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/user/notifications/${tab === 'notifications' ? '' : tab}?page=${page}`.replace('/?', '?')), [tab, page])
  const paged = normalizePage(data)

  const tabs = [
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'events', label: 'Events', icon: 'spark' },
    { key: 'announcments', label: 'Announcements', icon: 'info' },
  ]

  return (
    <>
      <Head kicker="Inbox" title="Notifications" sub="Course updates, events, and announcements — all in one place." />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 520 }}>
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => { setTab(t.key); setPage(1) }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paged.items.map((n, i) => (
              <Reveal key={n.id} className="card" delay={i * 0.04} style={{ display: 'flex', gap: 16 }}>
                <span className="av" style={{ width: 46, height: 46, background: n.type === 'event' ? 'linear-gradient(135deg,#ffce66,#f563b0)' : 'var(--grad)' }}>
                  <I name={n.type === 'event' ? 'spark' : 'bell'} size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{n.title}</h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{n.created_at}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 8, whiteSpace: 'pre-line' }}>{n.content}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {n.professor ? <Badge tone="cy">Prof. {n.professor}</Badge> : null}
                    {n.admin ? <Badge tone="vio">{n.admin}</Badge> : null}
                    {n.image_path ? <a href={n.image_path} target="_blank" rel="noreferrer" className="badge amb">Attachment</a> : null}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="bell" title="Nothing here" sub="You have no items in this inbox yet." />
      )}
    </>
  )
}