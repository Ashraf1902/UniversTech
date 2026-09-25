import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useMyCourses } from './_shared'
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
