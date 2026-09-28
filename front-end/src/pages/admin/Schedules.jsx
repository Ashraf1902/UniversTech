import { useState } from 'react'
import { request } from '../../lib/api'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, useFieldErrors, useList, useOptions } from './_shared'
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const emptySched = { level_id: '', semester_id: '', department_id: '', course_id: '', day_of_week: 'Saturday', start_time: '', end_time: '', section_type: 'lecture', image: null }

export function AdminSchedules() {
  const { t } = useI18n()
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
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

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
toast.success(t('scheduleSaved'))
      setOpen(false)
      clearErrors()
      run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteEntry'))) return
    try {
      await request(`/api/schedule/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('entryDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker={t('timetable')} title={t('schedules')} sub={t('schedulesSub')} actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm(emptySched); setOpen(true) }}>{t('newEntry')}</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'course', label: t('course'), main: true, render: (r) => r.course?.course_name || '—' },
          { key: 'level', label: t('level'), render: (r) => r.level?.name || r.level_id || '—' },
          { key: 'semester', label: t('semester'), render: (r) => r.semester?.name || '—' },
          { key: 'department', label: t('department'), render: (r) => r.department?.name || t('general') },
          { key: 'day_of_week', label: t('day'), render: (r) => <Badge tone="vio">{t('day_' + String(r.day_of_week).toLowerCase())}</Badge> },
          { key: 'time', label: t('time'), render: (r) => `${(r.start_time || '').slice(0, 5)} – ${(r.end_time || '').slice(0, 5)}` },
          { key: 'section_type', label: t('type'), render: (r) => <Badge tone="cy">{t('type_' + String(r.section_type).toLowerCase())}</Badge> },
        ]}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editEntry') : t('newEntryTitle')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('levelId')} hint={t('levelIdHint')} error={errors?.level_id?.[0]}><input className="input" type="number" min="1" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} placeholder="e.g. 1" /></Field>
          <Field label={t('semester')} error={errors?.semester_id?.[0]}>
            <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('course')} error={errors?.course_id?.[0]}>
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={t('departmentOptional')} error={errors?.department_id?.[0]}>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('generalOption')}</option>
              {depts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('day')} error={errors?.day_of_week?.[0]}>
            <select className="select" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{t('day_' + d.toLowerCase())}</option>)}
            </select>
          </Field>
          <Field label={t('sectionType')} error={errors?.section_type?.[0]}>
            <select className="select" value={form.section_type} onChange={(e) => setForm({ ...form, section_type: e.target.value })}>
              <option value="lecture">{t('lectureType')}</option>
              <option value="seminar">{t('seminar')}</option>
              <option value="lab">{t('lab')}</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('startTime')} error={errors?.start_time?.[0]}><input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
          <Field label={t('endTime')} error={errors?.end_time?.[0]}><input className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
        </div>
        {!editId ? <Field label={t('timetableImageOptional')} error={errors?.image?.[0]}><input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} /></Field> : null}
      </FormModal>
    </>
  )
}
