import { useState } from 'react'
import { request } from '../../lib/api'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, withSearch } from './_shared'
export function AdminSemesters() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { paged, loading, run } = useList(withSearch('/api/semester/get/all', search), page, [search])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', academic_year: '', is_active: false, grading_system: 'gpa' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) {
        await request('/api/semester/update', { method: 'POST', data: { semester_id: editId, name: form.name, academic_year: form.academic_year, is_active: !!form.is_active, grading_system: form.grading_system } })
      } else {
        await request('/api/semester/store', { method: 'POST', data: { name: form.name, academic_year: form.academic_year } })
      }
      toast.success(t('semesterSaved'))
      setOpen(false)
      clearErrors()
      run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const activate = async (row) => {
    try {
      await request('/api/semester/update', { method: 'POST', data: { semester_id: row.id, is_active: true } })
      toast.success(t('semesterActivated', { name: row.name }))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteSemester', { name: row.name }))) return
    try {
      await request(`/api/semester/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('semesterDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker={t('calendar')} title={t('semesters')} sub={t('semestersSub')} actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ name: '', academic_year: '', is_active: false, grading_system: 'gpa' }); setOpen(true) }}>{t('newSemester')}</Btn>} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchSemestersPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'name', label: t('semester'), main: true },
          { key: 'academic_year', label: t('academicYear') },
          { key: 'grading_system', label: t('grading'), render: (r) => <Badge tone="cy">{r.grading_system === 'fixed_term' ? t('gradingFixedTerm') : t('gradingGpa')}</Badge> },
          { key: 'courses_count', label: t('courses'), render: (r) => <Badge tone="vio">{r.courses_count ?? 0}</Badge> },
          { key: 'is_active', label: t('status'), render: (r) => (r.is_active ? <Badge tone="grn" dot>{t('active')}</Badge> : <button className="badge" onClick={() => activate(r)}>{t('setActive')}</button>) },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ name: row.name || '', academic_year: row.academic_year || '', is_active: !!row.is_active, grading_system: row.grading_system || 'gpa' }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editSemester') : t('newSemester')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('name')} error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('egFall')} /></Field>
          <Field label={t('academicYear')} error={errors?.academic_year?.[0]}><input className="input" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder={t('egYear')} /></Field>
        </div>
        <Field label={t('gradingSystem')} error={errors?.grading_system?.[0]}>
          <div className="radio-row">
            <button type="button" className={`chip ${form.grading_system === 'gpa' ? 'on' : ''}`} onClick={() => setForm({ ...form, grading_system: 'gpa' })}>{t('creditHourGpa')}</button>
            <button type="button" className={`chip ${form.grading_system === 'fixed_term' ? 'on' : ''}`} onClick={() => setForm({ ...form, grading_system: 'fixed_term' })}>{t('fixedTermPct')}</button>
          </div>
        </Field>
        {editId ? (
          <Field label={t('active')}>
            <button type="button" className={`switch ${form.is_active ? 'on' : ''}`} onClick={() => setForm({ ...form, is_active: !form.is_active })} aria-label={t('toggleActive')} />
          </Field>
        ) : null}
      </FormModal>
    </>
  )
}
