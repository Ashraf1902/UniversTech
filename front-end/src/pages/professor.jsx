import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/hooks'
import { Badge, Btn, CourseLoader, Empty, Field, I, Modal, Pager, Prog, RateBadge, Reveal, Spinner, StatCard, useToast } from '../lib/ui'

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

function useMyCourses() {
  const { data, loading } = useAsync(() => request('/api/professors/courses'))
  const paged = normalizePage(data)
  return { courses: paged.items, loading }
}

function CourseSelect({ courses, value, onChange, loading }) {
  return (
    <Field label="Course">
      <select className="select" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} disabled={loading}>
        <option value="">{loading ? 'Loading courses…' : '— Select a course —'}</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.course_name} {c.course_code ? `(${c.course_code})` : ''}
          </option>
        ))}
      </select>
    </Field>
  )
}

/* ============ HOME ============ */
export function ProfessorHome() {
  const { user } = useAuth()
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
          <span className="gd" /> Faculty console
        </span>
        <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', marginBottom: 10 }}>
          Hello, <span className="grad-text">Prof. {user?.name?.split(' ').slice(-1)[0] || 'Professor'}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 620 }}>
          {p?.job_title || 'Faculty member'} · {p?.department?.name || 'University'} — manage your courses, students, and content.
        </p>
      </Reveal>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="book" label="My courses" value={courses.length} tone="vio" />
        <StatCard icon="file" label="Lectures uploaded" value={lectureTotal} tone="cy" delay={0.06} />
        <StatCard icon="users" label="Students taught" value={courses.reduce((a, c) => a + (c.students_count || 0), 0) || '—'} tone="grn" delay={0.12} />
        <StatCard icon="bell" label="Notifications" value={notes.length} tone="pnk" delay={0.18} />
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head">
            <h3>My courses</h3>
            <Link to="/app/professor/courses" className="badge vio">Manage</Link>
          </div>
          {coursesLoading ? <Spinner /> : courses.length ? (
            courses.slice(0, 5).map((c) => (
              <div className="list-row" key={c.id}>
                <span className="av" style={{ background: 'var(--grad)' }}>{String(c.course_code || c.course_name || '?').slice(0, 2)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.course_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{c.department?.name || 'General'} · {c.lectures?.length || 0} lectures</div>
                </div>
                <Link to={`/app/professor/lectures?course=${c.id}`}><Btn size="sm" variant="soft" icon="upload">Content</Btn></Link>
              </div>
            ))
          ) : (
            <Empty icon="book" title="No courses assigned" sub="The administration has not assigned you any courses yet." />
          )}
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>Latest events</h3>
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
            {!eventList.length && !events.loading ? <Empty icon="spark" title="No new events" /> : null}
          </Reveal>

          <Reveal className="card" delay={0.14}>
            <div className="card-head">
              <h3>Notifications</h3>
              <Link to="/app/professor/notifications" className="badge pnk">All</Link>
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
            {!notes.length && !notifs.loading ? <Empty icon="bell" title="No notifications" /> : null}
          </Reveal>
        </div>
      </div>
    </>
  )
}

/* ============ COURSES ============ */
export function ProfessorCourses() {
  const { courses, loading } = useMyCourses()
  return (
    <>
      <Head kicker="Teaching" title="My courses" sub="Jump into any course to manage its students, lectures, quizzes, and grades." />
      {loading ? (
        <CourseLoader label="Loading your courses…" />
      ) : courses.length ? (
        <div className="grid grid-3">
          {courses.map((c, i) => (
            <Reveal key={c.id} className="card" delay={i * 0.05}>
              <div style={{ height: 110, borderRadius: 14, marginBottom: 18, background: c.cover_image && !c.cover_image.endsWith('default.jpg') ? `center/cover url(${c.cover_image})` : 'var(--grad)' }} />
              <h3 style={{ fontSize: '1.02rem', marginBottom: 6 }}>{c.course_name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                <Badge tone="cy">{c.lectures?.length || 0} lectures</Badge>
                {c.no_of_hours ? <Badge>{c.no_of_hours} cr</Badge> : null}
              </div>
              <div className="grid grid-2" style={{ gap: 8 }}>
                <Link to={`/app/professor/students?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="users">Students</Btn></Link>
                <Link to={`/app/professor/lectures?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="file">Lectures</Btn></Link>
                <Link to={`/app/professor/quizzes?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="award">Quizzes</Btn></Link>
                <Link to={`/app/professor/grades?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="chart">Grades</Btn></Link>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="book" title="No courses assigned" />
      )}
    </>
  )
}

/* ============ STUDENTS + ATTENDANCE ============ */
export function ProfessorStudents() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()

  const students = useAsync(() => (courseId ? request(buildQuery('/api/professors/course/student', { course_id: courseId })) : Promise.resolve(null)), [courseId])
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ lecture_id: '', date: new Date().toISOString().slice(0, 10), status: true, reason: '' })
  const [busy, setBusy] = useState(false)

  const list = Array.isArray(students.data) ? students.data : []
  const lectureList = Array.isArray(lectures.data) ? lectures.data : []

  const setCourse = (id) => setParams(id ? { course: String(id) } : {})

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/professors/make/attendance', {
        method: 'POST',
        data: { student_id: target.id, lecture_id: Number(form.lecture_id), date: form.date, status: form.status, reason: form.reason || null },
      })
      toast.success(`Attendance recorded for ${target.name}.`)
      setTarget(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker="Classroom" title="Students & attendance" sub="Pick a course to see its enrolled students and record attendance." />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={setCourse} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="users" title="Select a course" sub="Choose one of your courses to load its students." />
      ) : students.loading ? (
        <Spinner size={24} />
      ) : list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Email</th><th>Gender</th><th>Attendance</th><th style={{ textAlign: 'right' }}>Action</th></tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const att = s.attendances || []
                const present = att.filter((a) => a.status).length
                return (
                  <tr key={s.id}>
                    <td className="cell-main">{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.gender}</td>
                    <td>
                      <Badge tone="grn">{present} present</Badge>{' '}
                      <Badge tone={att.length - present ? 'red' : ''}>{att.length - present} absent</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn size="sm" icon="check" onClick={() => { setTarget(s); setForm((f) => ({ ...f, lecture_id: lectureList[0]?.id || '' })) }}>Attendance</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="users" title="No students enrolled" />
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Attendance — ${target?.name || ''}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setTarget(null)}>Cancel</Btn>
            <Btn loading={busy} onClick={submit} icon="check" disabled={!form.lecture_id}>Save</Btn>
          </>
        }
      >
        {lectureList.length ? (
          <>
            <Field label="Lecture">
              <select className="select" value={form.lecture_id} onChange={(e) => setForm({ ...form, lecture_id: e.target.value })}>
                <option value="">— Select lecture —</option>
                {lectureList.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Status">
              <div className="radio-row">
                <button type="button" className={`chip ${form.status ? 'on' : ''}`} onClick={() => setForm({ ...form, status: true })}>Present</button>
                <button type="button" className={`chip ${!form.status ? 'on' : ''}`} onClick={() => setForm({ ...form, status: false })}>Absent</button>
              </div>
            </Field>
            {!form.status ? (
              <Field label="Reason (optional)">
                <textarea className="textarea" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for absence" />
              </Field>
            ) : null}
          </>
        ) : (
          <Empty icon="file" title="No lectures yet" sub="Upload a lecture first, then you can record attendance against it." />
        )}
      </Modal>
    </>
  )
}

/* ============ LECTURES ============ */
export function ProfessorLectures() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', pdf: null })
  const [busy, setBusy] = useState(false)

  const list = Array.isArray(lectures.data) ? lectures.data : []

  const submit = async () => {
    if (!form.name || !form.pdf) return toast.error('Name and PDF are required.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      fd.append('pdf', form.pdf)
      await request('/api/lecture/store', { method: 'POST', formData: fd })
      toast.success('Lecture uploaded.')
      setOpen(false)
      setForm({ name: '', pdf: null })
      lectures.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head
        kicker="Content"
        title="Lectures"
        sub="Upload lecture material and review what students can access."
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>Upload lecture</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => setParams(id ? { course: String(id) } : {})} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="file" title="Select a course" />
      ) : lectures.loading ? (
        <Spinner size={24} />
      ) : list.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((l, i) => (
            <Reveal key={l.id} className="card" delay={i * 0.04} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="av" style={{ background: 'var(--grad)' }}><I name="file" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{new Date(l.created_at).toLocaleDateString()}</div>
              </div>
              <a href={l.path} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="play">Open</Btn></a>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="file" title="No lectures uploaded" sub="Upload the first lecture for this course." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload lecture"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={submit} icon="upload">Upload</Btn></>}
      >
        <Field label="Lecture name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Introduction to Algorithms" /></Field>
        <Field label="PDF file"><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>
    </>
  )
}

/* ============ QUIZZES ============ */
export function ProfessorQuizzes() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const toast = useToast()
  const quizzes = useAsync(() => (courseId ? request(`/api/quiz/get/all/${courseId}?page=${page}`) : Promise.resolve(null)), [courseId, page])
  const paged = normalizePage(quizzes.data)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', due_at: '', pdf: null })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.name || !form.pdf) return toast.error('Name and PDF are required.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      if (form.due_at) fd.append('due_at', form.due_at)
      fd.append('pdf', form.pdf)
      await request('/api/quiz/store', { method: 'POST', formData: fd })
      toast.success('Quiz uploaded.')
      setOpen(false)
      setForm({ name: '', due_at: '', pdf: null })
      quizzes.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      await request(`/api/quiz/delete/${id}`, { method: 'DELETE' })
      toast.success('Quiz deleted.')
      quizzes.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker="Assessment"
        title="Quizzes"
        sub="Publish quizzes with due dates and manage existing ones."
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>Upload quiz</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="award" title="Select a course" />
      ) : quizzes.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.items.map((q, i) => (
              <Reveal key={q.id} className="card" delay={i * 0.04} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6' }}><I name="award" size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{q.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{q.due_at ? `Due ${new Date(q.due_at).toLocaleDateString()}` : 'No due date'}</div>
                </div>
                <a href={q.content} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="file">Open</Btn></a>
                <Btn size="sm" variant="danger" icon="trash" onClick={() => remove(q.id)} />
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="award" title="No quizzes yet" sub="Upload the first quiz for this course." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload quiz"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={submit} icon="upload">Upload</Btn></>}
      >
        <Field label="Quiz name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Midterm Quiz" /></Field>
        <Field label="Due date (optional)"><input className="input" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field>
        <Field label="PDF file"><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>
    </>
  )
}

/* ============ GRADES ============ */
export function ProfessorGrades() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const toast = useToast()
  const grades = useAsync(() => (courseId ? request(buildQuery('/api/professor/grade/get/all', { course_id: courseId, page })) : Promise.resolve(null)), [courseId, page])
  const paged = normalizePage(grades.data)
  const students = useAsync(() => (courseId ? request(buildQuery('/api/professors/course/student', { course_id: courseId })) : Promise.resolve(null)), [courseId])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ student_id: '', marks: '', max_marks: '100' })
  const [busy, setBusy] = useState(false)

  const studentList = Array.isArray(students.data) ? students.data : []

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/professor/grade/store', {
        method: 'POST',
        data: {
          student_id: Number(form.student_id),
          course_id: courseId,
          marks: Number(form.marks),
          max_marks: Number(form.max_marks),
        },
      })
      toast.success('Grade saved.')
      setOpen(false)
      setForm({ student_id: '', marks: '', max_marks: '100' })
      grades.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      await request(`/api/professor/grade/delete/${id}`, { method: 'DELETE' })
      toast.success('Grade removed.')
      grades.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker="Results"
        title="Grades"
        sub="Record marks for students in your own subjects. The semester defaults to the active term."
        actions={<Btn icon="plus" onClick={() => setOpen(true)} disabled={!courseId}>Add grade</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="chart" title="Select a course" />
      ) : grades.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>Semester</th><th>Marks</th><th>%</th><th>Rate</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
              <tbody>
                {paged.items.map((g) => (
                  <tr key={g.id}>
                    <td className="cell-main">{g.student}</td>
                    <td>{g.semester || '—'}</td>
                    <td>{g.marks}/{g.max_marks}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Prog value={g.percentage} sm />
                        <span style={{ fontSize: '0.78rem' }}>{g.percentage}%</span>
                      </div>
                    </td>
                    <td><RateBadge rate={g.rate} /></td>
                    <td style={{ textAlign: 'right' }}><Btn size="sm" variant="danger" icon="trash" onClick={() => remove(g.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="chart" title="No grades recorded" sub="Add the first grade for this course." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add / update grade"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={submit} icon="check" disabled={!form.student_id}>Save grade</Btn></>}
      >
        <Field label="Student">
          <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
            <option value="">— Select student —</option>
            {studentList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Marks"><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
          <Field label="Max marks"><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ============ NOTIFICATIONS ============ */
export function ProfessorNotifications() {
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/professor/notifications?page=${page}`), [page])
  const paged = normalizePage(data)

  return (
    <>
      <Head kicker="Inbox" title="Notifications" sub="Everything the platform has sent your way." />
      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paged.items.map((n, i) => (
              <Reveal key={n.id} className="card" delay={i * 0.04} style={{ display: 'flex', gap: 16 }}>
                <span className="av" style={{ width: 46, height: 46, background: 'var(--grad)' }}><I name="bell" size={20} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{n.title}</h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{n.created_at}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 8, whiteSpace: 'pre-line' }}>{n.content}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="bell" title="No notifications" />
      )}
    </>
  )
}