import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useList } from './_shared'
export function AdminDepartments() {
  const [page, setPage] = useState(1)
  const [archived, setArchived] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)
  const { paged, loading, run } = useList(archived ? '/api/department/get/all?deleted=1' : '/api/department/get/all', page, [archived])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', abbrevation: '' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) await request('/api/department/update', { method: 'PUT', data: { department_id: editId, ...form } })
      else await request('/api/department/store', { method: 'POST', data: form })
      toast.success('Department saved.')
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Archive department "${row.name}"?`)) return
    try {
      await request(`/api/department/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Department archived.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(`Restore department "${row.name}"?`)) return
    try {
      await request(`/api/department/restore/${row.id}`, { method: 'POST' })
      toast.success('Department restored.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(`Permanently delete department "${row.name}"?`)) return
    try {
      await request(`/api/department/purge/${row.id}`, { method: 'DELETE' })
      toast.success('Department permanently deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Academics" title="Departments" sub="Faculties and departments students and courses belong to." actions={!archived ? <Btn icon="plus" onClick={() => { setEditId(null); setForm({ name: '', abbrevation: '' }); setOpen(true) }}>New department</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
        <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>Active</button>
        <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>Archived</button>
      </div>
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'name', label: 'Name', main: true },
          { key: 'abbreviation', label: 'Abbreviation', render: (r) => <Badge tone="vio">{r.abbreviation || 'â€”'}</Badge> },
          { key: 'created_by', label: 'Created by', render: (r) => r.created_by || 'â€”' },
          ...(archived ? [{ key: 'deleted_at', label: 'Archived on', render: (r) => (r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : 'â€”') }] : [{ key: 'created_at', label: 'Created', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'â€”') }]),
        ]}
        onEdit={archived ? undefined : (row) => { setEditId(row.id); setForm({ name: row.name || '', abbrevation: row.abbreviation || '' }); setOpen(true) }}
        onDelete={archived ? undefined : remove}
        onRestore={archived ? restore : undefined}
        onPurge={archived && isSuper ? purge : undefined}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit department' : 'New department'} onSubmit={submit} busy={busy}>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Abbreviation"><input className="input" value={form.abbrevation} onChange={(e) => setForm({ ...form, abbrevation: e.target.value })} /></Field>
      </FormModal>
    </>
  )
}