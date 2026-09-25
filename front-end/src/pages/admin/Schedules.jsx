import { useState } from 'react'
import { request } from '../../lib/api'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useList, useOptions } from './_shared'
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const emptySched = { level_id: '', semester_id: '', department_id: '', course_id: '', day_of_week: 'Saturday', start_time: '', end_time: '', section_type: 'lecture', image: null }

export function AdminSchedules() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/schedule/get/all', page)
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))
  const depts = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))
  const courses = useOptions('/api/course/get/all', (c) => ({ value: c.id, label: c.course_name }))

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptySched)
  const [busy, setBusy] = useState(false)

  const openEdit = (row) => {
    setEditId(row.id)
    setForm({
      level_id: row.level_id || '', semester_id: row.semester_id || '', department_id: row.department_id || '',
      course_id: row.course_id || '', day_of_week: row.day_of_week || 'Saturday',
      start_time: (row.start_time || '').slice(0, 5), end_time: (row.end_time || '').slice(0, 5),
      section_type: row.section_type || 'lecture', image: null,
    })
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) {
        const payload = { schedule_id: editId, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, section_type: form.section_type, course_id: Number(form.course_id), level_id: Number(form.level_id), semester_id: Number(form.semester_id) }
        if (form.department_id) payload.department_id = Number(form.department_id)
        await request('/api/schedule/update', { method: 'POST', data: payload })
      } else {
        const fd = new FormData()
        fd.append('level_id', form.level_id)
        fd.append('semester_id', form.semester_id)
        if (form.department_id) fd.append('department_id', form.department_id)
        fd.append('course_id', form.course_id)
        fd.append('day_of_week', form.day_of_week)
        fd.append('start_time', form.start_time)
        fd.append('end_time', form.end_time)
        fd.append('section_type', form.section_type)
        if (form.image) fd.append('image', form.image)
        await request('/api/schedule/store', { method: 'POST', formData: fd })
      }
      toast.success('Schedule saved.')
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm('Delete this schedule entry?')) return
    try {
      await request(`/api/schedule/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Schedule entry deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Timetable" title="Schedules" sub="Weekly class entries per level, semester, and department." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm(emptySched); setOpen(true) }}>New entry</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'course', label: 'Course', main: true, render: (r) => r.course?.course_name || 'â€”' },
          { key: 'level', label: 'Level', render: (r) => r.level?.name || r.level_id || 'â€”' },
          { key: 'semester', label: 'Semester', render: (r) => r.semester?.name || 'â€”' },
          { key: 'department', label: 'Department', render: (r) => r.department?.name || 'General' },
          { key: 'day_of_week', label: 'Day', render: (r) => <Badge tone="vio">{r.day_of_week}</Badge> },
          { key: 'time', label: 'Time', render: (r) => `${(r.start_time || '').slice(0, 5)} â€“ ${(r.end_time || '').slice(0, 5)}` },
          { key: 'section_type', label: 'Type', render: (r) => <Badge tone="cy">{r.section_type}</Badge> },
        ]}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit schedule entry' : 'New schedule entry'} onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Level ID" hint="Numeric id from the levels table"><input className="input" type="number" min="1" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} placeholder="e.g. 1" /></Field>
          <Field label="Semester">
            <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Course">
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Department (optional)">
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">â€” General â€”</option>
              {depts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Day">
            <select className="select" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Section type">
            <select className="select" value={form.section_type} onChange={(e) => setForm({ ...form, section_type: e.target.value })}>
              <option value="lecture">Lecture</option>
              <option value="seminar">Seminar</option>
              <option value="lab">Lab</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Start time"><input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
          <Field label="End time"><input className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
        </div>
        {!editId ? <Field label="Timetable image (optional)"><input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} /></Field> : null}
      </FormModal>
    </>
  )
}
