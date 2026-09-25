import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Btn, Empty, Field, Modal, Pager, Prog, RateBadge, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useMyCourses } from './_shared'
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
