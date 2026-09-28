import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, withSearch } from './_shared'
export function AdminDepartments() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [archived, setArchived] = useState(false)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)
  const { paged, loading, run } = useList(withSearch(archived ? '/api/department/get/all?deleted=1' : '/api/department/get/all', search), page, [archived, search])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', abbrevation: '' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) await request('/api/department/update', { method: 'PUT', data: { department_id: editId, ...form } })
      else await request('/api/department/store', { method: 'POST', data: form })
      toast.success(t('departmentSaved'))
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
    if (!window.confirm(t('confirmArchiveDepartment', { name: row.name }))) return
    try {
      await request(`/api/department/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('departmentArchived'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(t('confirmRestoreDepartment', { name: row.name }))) return
    try {
      await request(`/api/department/restore/${row.id}`, { method: 'POST' })
      toast.success(t('departmentRestored'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(t('confirmPurgeDepartment', { name: row.name }))) return
    try {
      await request(`/api/department/purge/${row.id}`, { method: 'DELETE' })
      toast.success(t('departmentDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker={t('academics')} title={t('departments')} sub={t('departmentsSub')} actions={!archived ? <Btn icon="plus" onClick={() => { setEditId(null); setForm({ name: '', abbrevation: '' }); setOpen(true) }}>{t('newDepartment')}</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
        <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>{t('active')}</button>
        <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>{t('archived')}</button>
      </div>
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchDepartmentsPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'name', label: t('name'), main: true },
          { key: 'abbreviation', label: t('abbreviation'), render: (r) => <Badge tone="vio">{r.abbreviation || '—'}</Badge> },
          { key: 'created_by', label: t('createdBy'), render: (r) => r.created_by || '—' },
          ...(archived ? [{ key: 'deleted_at', label: t('archivedOn'), render: (r) => (r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—') }] : [{ key: 'created_at', label: t('created'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') }]),
        ]}
        onEdit={archived ? undefined : (row) => { setEditId(row.id); setForm({ name: row.name || '', abbrevation: row.abbreviation || '' }); setOpen(true) }}
        onDelete={archived ? undefined : remove}
        onRestore={archived ? restore : undefined}
        onPurge={archived && isSuper ? purge : undefined}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editDepartment') : t('newDepartment')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <Field label={t('name')} error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t('abbreviation')} error={errors?.abbreviation?.[0]}><input className="input" value={form.abbrevation} onChange={(e) => setForm({ ...form, abbrevation: e.target.value })} /></Field>
      </FormModal>
    </>
  )
}