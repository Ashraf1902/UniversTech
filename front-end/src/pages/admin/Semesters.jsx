import { useState } from 'react'
import { request } from '../../lib/api'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useList } from './_shared'
export function AdminSemesters() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/semester/get/all', page)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', academic_year: '', is_active: false, grading_system: 'gpa' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) {
        await request('/api/semester/update', { method: 'POST', data: { semester_id: editId, name: form.name, academic_year: form.academic_year, is_active: !!form.is_active, grading_system: form.grading_system } })
      } else {
        await request('/api/semester/store', { method: 'POST', data: { name: form.name, academic_year: form.academic_year } })
      }
      toast.success('Semester saved.')
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const activate = async (row) => {
    try {
      await request('/api/semester/update', { method: 'POST', data: { semester_id: row.id, is_active: true } })
      toast.success(`${row.name} is now the active semester.`)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete semester "${row.name}"?`)) return
    try {
      await request(`/api/semester/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Semester deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Calendar" title="Semesters" sub="Create terms, pick the grading system, and activate the current semester." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ name: '', academic_year: '', is_active: false, grading_system: 'gpa' }); setOpen(true) }}>New semester</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'name', label: 'Semester', main: true },
          { key: 'academic_year', label: 'Academic year' },
          { key: 'grading_system', label: 'Grading', render: (r) => <Badge tone="cy">{r.grading_system === 'fixed_term' ? 'Fixed-Term' : 'Credit-Hour'}</Badge> },
          { key: 'courses_count', label: 'Courses', render: (r) => <Badge tone="vio">{r.courses_count ?? 0}</Badge> },
          { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="grn" dot>Active</Badge> : <button className="badge" onClick={() => activate(r)}>Set active</button>) },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ name: row.name || '', academic_year: row.academic_year || '', is_active: !!row.is_active, grading_system: row.grading_system || 'gpa' }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit semester' : 'New semester'} onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fall" /></Field>
          <Field label="Academic year"><input className="input" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="e.g. 2026/2027" /></Field>
        </div>
        <Field label="Grading system">
          <div className="radio-row">
            <button type="button" className={`chip ${form.grading_system === 'gpa' ? 'on' : ''}`} onClick={() => setForm({ ...form, grading_system: 'gpa' })}>Credit-Hour (GPA)</button>
            <button type="button" className={`chip ${form.grading_system === 'fixed_term' ? 'on' : ''}`} onClick={() => setForm({ ...form, grading_system: 'fixed_term' })}>Fixed-Term (%)</button>
          </div>
        </Field>
        {editId ? (
          <Field label="Active">
            <button type="button" className={`switch ${form.is_active ? 'on' : ''}`} onClick={() => setForm({ ...form, is_active: !form.is_active })} aria-label="Toggle active" />
          </Field>
        ) : null}
      </FormModal>
    </>
  )
}
