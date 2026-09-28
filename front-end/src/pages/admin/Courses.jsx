import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, useOptions, withSearch } from './_shared'
export function AdminCourses() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [archived, setArchived] = useState(false)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)
  const { paged, loading, run } = useList(withSearch(archived ? '/api/course/get/all?deleted=1' : '/api/course/get/all', search), page, [archived, search])
  const depts = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))
  const profs = useOptions('/api/doctor/get/all', (u) => ({ value: u.id, label: u.name }))
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ course_name: '', no_of_hours: '', course_code: '', department_id: '', professor_id: '', semester_id: '', cover_image: null })
const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const openEdit = async (row) => {
    try {
      const c = await request(`/api/course/single/${row.id}`)
      setEditId(row.id)
      setForm({
        course_name: c.course_name || '', no_of_hours: c.no_of_hours ?? '', course_code: c.course_code || '',
        department_id: c.department_id || '', professor_id: c.professor_id || '', semester_id: c.semester_id || '', cover_image: null,
      })
      setOpen(true)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const submit = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (editId) fd.append('course_id', editId)
      fd.append('course_name', form.course_name)
      fd.append('no_of_hours', form.no_of_hours)
      fd.append('course_code', form.course_code)
      if (form.department_id) fd.append('department_id', form.department_id)
      if (form.semester_id) fd.append('semester_id', form.semester_id)
      fd.append('professor_id', form.professor_id)
      if (form.cover_image) fd.append('cover_image', form.cover_image)
      await request(editId ? '/api/course/update' : '/api/course/store', { method: 'POST', formData: fd })
      toast.success(t('courseSaved'))
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
    if (!window.confirm(t('confirmArchiveCourse', { name: row.course_name }))) return
    try {
      await request(`/api/course/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('courseArchived'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(t('confirmRestoreCourse', { name: row.course_name }))) return
    try {
      await request(`/api/course/restore/${row.id}`, { method: 'POST' })
      toast.success(t('courseRestored'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(t('confirmPurgeCourse', { name: row.course_name }))) return
    try {
      await request(`/api/course/purge/${row.id}`, { method: 'DELETE' })
      toast.success(t('courseDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker={t('academics')} title={t('courses')} sub={t('coursesSub')} actions={!archived ? <Btn icon="plus" onClick={() => { setEditId(null); setForm({ course_name: '', no_of_hours: '', course_code: '', department_id: '', professor_id: '', semester_id: '', cover_image: null }); setOpen(true) }}>{t('newCourse')}</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
        <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>{t('active')}</button>
        <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>{t('archived')}</button>
      </div>
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchCoursesPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'course_name', label: t('course'), main: true, render: (r) => (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="av" style={{ width: 36, height: 36, borderRadius: 10, background: r.cover_image && !r.cover_image.endsWith('default.jpg') ? `center/cover url(${r.cover_image})` : 'var(--grad)', fontSize: '0.7rem' }} />{r.course_name}</div>) },
          { key: 'course_code', label: t('code'), render: (r) => <Badge tone="vio">{r.course_code}</Badge> },
          { key: 'professor', label: t('professor'), render: (r) => r.professor || '—' },
          { key: 'department', label: t('department'), render: (r) => r.department || t('general') },
          { key: 'semester', label: t('semester'), render: (r) => r.semester || '—' },
          { key: 'no_of_hours', label: t('hours') },
{ key: 'lecture_count', label: t('lectures') },
          ...(archived ? [{ key: 'deleted_at', label: t('archivedOn'), render: (r) => (r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—') }] : []),
        ]}
        onEdit={archived ? undefined : openEdit}
        onDelete={archived ? undefined : remove}
        onRestore={archived ? restore : undefined}
        onPurge={archived && isSuper ? purge : undefined}
      />
<Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editCourse') : t('newCourse')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('courseName')} error={errors?.course_name?.[0]}><input className="input" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} /></Field>
          <Field label={t('courseCode')} error={errors?.course_code?.[0]}><input className="input" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('creditHours')} error={errors?.no_of_hours?.[0]}><input className="input" type="number" min="1" value={form.no_of_hours} onChange={(e) => setForm({ ...form, no_of_hours: e.target.value })} /></Field>
          <Field label={t('professor')} error={errors?.professor_id?.[0]}>
            <select className="select" value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })}>
              <option value="">{t('selectProfessor')}</option>
              {profs.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('departmentOptional')} error={errors?.department_id?.[0]}>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('generalAllOption')}</option>
              {depts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={t('semesterOptional')} error={errors?.semester_id?.[0]}>
            <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">{t('anyOption')}</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('coverImage')} error={errors?.cover_image?.[0]}><input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, cover_image: e.target.files?.[0] || null })} /></Field>
      </FormModal>
    </>
  )
}
