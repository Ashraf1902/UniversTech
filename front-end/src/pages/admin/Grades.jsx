import { useMemo, useState } from 'react'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Pager, Prog, RateBadge, Reveal, Spinner, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useOptions } from './_shared'
function SemesterCardExplorer({ students, sems }) {
  const [studentId, setStudentId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const card = useAsync(() => (studentId ? request(buildQuery('/api/semester-card', { student_id: studentId, semester_id: semesterId })) : Promise.resolve(null)), [studentId, semesterId])
  const d = card.data

  return (
    <>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="grid grid-2">
          <Field label="Student">
            <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">â€” Select student â€”</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Semester (optional â€” defaults to active)">
            <select className="select" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">â€” Active semester â€”</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {!studentId ? (
        <Empty icon="award" title="Pick a student" sub="Select a student to view their semester card." />
      ) : card.loading ? (
        <Spinner size={24} />
      ) : d ? (
        <Reveal className="card">
          <div className="card-head">
            <div>
              <h3 style={{ marginBottom: 4 }}>{d.student?.name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{d.student?.level || 'â€”'} Â· {d.student?.department || 'General'} Â· {d.semester?.name} ({d.semester?.academic_year})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                {d.semester?.grading_system === 'fixed_term' ? `${d.summary?.percentage ?? 'â€”'}%` : d.summary?.gpa ?? 'â€”'}
              </div>
              <RateBadge rate={d.summary?.grade} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <Badge tone="grn">{d.summary?.graded_courses} graded</Badge>
            <Badge tone="amb">{d.summary?.total_courses} total</Badge>
            <Badge tone="cy">{d.summary?.total_credit_hours} credit hours</Badge>
          </div>
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table" style={{ minWidth: 0 }}>
              <thead><tr><th>Course</th><th>Code</th><th>Hours</th><th>Marks</th><th>%</th><th style={{ textAlign: 'right' }}>Status</th></tr></thead>
              <tbody>
                {(d.courses || []).map((c) => (
                  <tr key={c.course_id}>
                    <td className="cell-main">{c.course_name}</td>
                    <td>{c.course_code}</td>
                    <td>{c.credit_hours}</td>
                    <td>{c.marks != null ? `${c.marks}/${c.max_marks}` : 'â€”'}</td>
                    <td>{c.percentage != null ? `${c.percentage}%` : 'â€”'}</td>
                    <td style={{ textAlign: 'right' }}>{c.status === 'graded' ? <Badge tone="grn" dot>Graded</Badge> : <Badge tone="amb" dot>Pending</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      ) : (
        <Empty icon="award" title="No card available" />
      )}
    </>
  )
}

export function AdminGrades() {
  const [tab, setTab] = useState('grades')
  const [page, setPage] = useState(1)
  const [archived, setArchived] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)

  const students = useOptions('/api/student/get/all', (s) => ({ value: s.id, label: s.name }))
  const courses = useOptions('/api/course/get/all', (c) => ({ value: c.id, label: c.course_name }))
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))

  const [filter, setFilter] = useState({ student_id: '', course_id: '', semester_id: '' })
  const query = useMemo(() => buildQuery({ ...filter, deleted: archived ? 1 : undefined, page }), [filter, archived, page])
  const list = useAsync(() => request(`/api/grade/get/all${query}`), [query])
  const paged = normalizePage(list.data)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ student_id: '', course_id: '', semester_id: '', marks: '', max_marks: '100' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/grade/store', {
        method: 'POST',
        data: {
          student_id: Number(form.student_id), course_id: Number(form.course_id),
          semester_id: form.semester_id ? Number(form.semester_id) : null,
          marks: Number(form.marks), max_marks: Number(form.max_marks),
        },
      })
      toast.success('Grade saved.')
      setOpen(false)
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

const remove = async (row) => {
    if (!window.confirm('Archive this grade?')) return
    try {
      await request(`/api/grade/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Grade archived.')
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm('Restore this grade?')) return
    try {
      await request(`/api/grade/restore/${row.id}`, { method: 'POST' })
      toast.success('Grade restored.')
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm('Permanently delete this grade?')) return
    try {
      await request(`/api/grade/purge/${row.id}`, { method: 'DELETE' })
      toast.success('Grade permanently deleted.')
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker="Results" title="Grades & semester cards" sub="Record marks for any subject, and view a student's full semester card with final score and rate." actions={tab === 'grades' && !archived ? <Btn icon="plus" onClick={() => setOpen(true)}>Add grade</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 380 }}>
        <button className={tab === 'grades' ? 'on' : ''} onClick={() => setTab('grades')}>Grade records</button>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>Semester cards</button>
      </div>

{tab === 'grades' ? (
        <>
          <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
            <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>Active</button>
            <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>Archived</button>
          </div>
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="grid grid-3">
              <Field label="Student">
                <select className="select" value={filter.student_id} onChange={(e) => { setFilter({ ...filter, student_id: e.target.value }); setPage(1) }}>
                  <option value="">All students</option>
                  {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Course">
                <select className="select" value={filter.course_id} onChange={(e) => { setFilter({ ...filter, course_id: e.target.value }); setPage(1) }}>
                  <option value="">All courses</option>
                  {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Semester">
                <select className="select" value={filter.semester_id} onChange={(e) => { setFilter({ ...filter, semester_id: e.target.value }); setPage(1) }}>
                  <option value="">All semesters</option>
                  {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
<DataTable
            loading={list.loading}
            rows={paged.items}
            columns={[
              { key: 'student', label: 'Student', main: true },
              { key: 'course', label: 'Course' },
              { key: 'semester', label: 'Semester', render: (r) => r.semester || 'â€”' },
              { key: 'marks', label: 'Marks', render: (r) => `${r.marks}/${r.max_marks}` },
              { key: 'percentage', label: '%', render: (r) => (<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 130 }}><Prog value={r.percentage} sm /><span style={{ fontSize: '0.78rem' }}>{r.percentage}%</span></div>) },
              { key: 'letter_grade', label: 'Rate', render: (r) => <RateBadge rate={r.letter_grade} /> },
              ...(archived ? [{ key: 'deleted_at', label: 'Archived on', render: (r) => (r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : 'â€”') }] : []),
            ]}
            onDelete={archived ? undefined : remove}
            onRestore={archived ? restore : undefined}
            onPurge={archived && isSuper ? purge : undefined}
          />
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <SemesterCardExplorer students={students} sems={sems} />
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title="Add / update grade" onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Student">
            <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Course">
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Marks"><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
          <Field label="Max marks"><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
        </div>
        <Field label="Semester (optional â€” defaults to active)">
          <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
            <option value="">â€” Active semester â€”</option>
            {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </FormModal>
    </>
  )
}
