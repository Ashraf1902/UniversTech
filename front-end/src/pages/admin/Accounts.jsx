import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Btn, Field, Pager, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useList, useOptions } from './_shared'
const emptyAccount = { name: '', email: '', password: '', gender: 0, nationalid: '', phone: '', credit_points: '', semester: '', type: 0, department_id: '', level_id: '', job_title: '' }

export function AdminAccounts() {
  const [tab, setTab] = useState('students')
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)
  const listPath = tab === 'students' ? '/api/student/get/all' : '/api/doctor/get/all'
  const { paged, loading, run } = useList(archived ? `${listPath}?deleted=1` : listPath, page, [tab, archived])
  const departments = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyAccount)
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyAccount, type: tab === 'doctors' ? 1 : 0, job_title: tab === 'doctors' ? 'Doctor' : '' })
    setOpen(true)
  }

  const openEdit = async (row) => {
    try {
      const u = await request(`/api/user/single/${row.id}`)
      setEditId(row.id)
      setForm({
        name: u.name || '', email: u.email || '', password: '', gender: u.gender === 'Female' ? 1 : 0,
        nationalid: u.national_id || '', phone: u.phone || '', credit_points: u.credit_points ?? '',
        semester: u.semester || '', type: (u.type === 1 || u.type === 'professor') ? 1 : 0,
        department_id: u.department?.id || '', level_id: u.level?.id || '', job_title: u.job_title || '',
      })
      setOpen(true)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const submit = async () => {
    setBusy(true)
    try {
      const payload = {
        name: form.name, email: form.email, gender: Number(form.gender), type: Number(form.type),
      }
      if (form.nationalid) payload.nationalid = form.nationalid
      if (form.phone) payload.phone = form.phone
      if (form.credit_points !== '') payload.credit_points = Number(form.credit_points)
      if (form.semester) payload.semester = form.semester
      if (form.department_id) payload.department_id = Number(form.department_id)
      if (form.level_id) payload.level_id = Number(form.level_id)
      if (form.type === 1 && form.job_title) payload.job_title = form.job_title
      if (editId) {
        payload.account_id = editId
        if (form.password) payload.password = form.password
        await request('/api/user/update', { method: 'PUT', data: payload })
        toast.success('Account updated.')
      } else {
        payload.password = form.password
        await request('/api/user/store', { method: 'POST', data: payload })
        toast.success('Account created.')
      }
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

const remove = async (row) => {
    if (!window.confirm(`Archive ${row.name}? They will not be able to sign in.`)) return
    try {
      await request(`/api/user/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Account archived.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(`Restore ${row.name}?`)) return
    try {
      await request(`/api/user/restore/${row.id}`, { method: 'POST' })
      toast.success('Account restored.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(`Permanently delete ${row.name}? This destroys their grades, payments, and history.`)) return
    try {
      await request(`/api/user/purge/${row.id}`, { method: 'DELETE' })
      toast.success('Account permanently deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head
        kicker="People"
        title="Accounts"
        sub="Create and manage student and professor accounts."
        actions={!archived ? <Btn icon="plus" onClick={openCreate}>New {tab === 'students' ? 'student' : 'professor'}</Btn> : null}
      />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 340 }}>
        <button className={tab === 'students' ? 'on' : ''} onClick={() => { setTab('students'); setPage(1) }}>Students</button>
        <button className={tab === 'doctors' ? 'on' : ''} onClick={() => { setTab('doctors'); setPage(1) }}>Professors</button>
      </div>
      <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
        <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>Active</button>
        <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>Archived</button>
      </div>

      <DataTable
        loading={loading}
        rows={paged.items}
        columns={
          tab === 'students'
            ? [
                { key: 'name', label: 'Name', main: true },
                { key: 'email', label: 'Email' },
                { key: 'level', label: 'Level', render: (r) => r.level || 'â€”' },
                { key: 'department', label: 'Department', render: (r) => r.department || 'General' },
                { key: 'created_at', label: 'Joined', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'â€”') },
              ]
            : [
                { key: 'name', label: 'Name', main: true },
                { key: 'email', label: 'Email' },
                { key: 'job_title', label: 'Title', render: (r) => r.job_title || 'â€”' },
                { key: 'created_at', label: 'Joined', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'â€”') },
              ]
        }
onEdit={archived ? undefined : openEdit}
        onDelete={archived ? undefined : remove}
        onRestore={archived ? restore : undefined}
        onPurge={archived && isSuper ? purge : undefined}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />

      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit account' : 'Create account'} onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={editId ? 'New password (optional)' : 'Password'}><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="National ID (14 digits)"><input className="input" maxLength={14} value={form.nationalid} onChange={(e) => setForm({ ...form, nationalid: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Role">
            <div className="radio-row">
              <button type="button" className={`chip ${form.type === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 0 })}>Student</button>
              <button type="button" className={`chip ${form.type === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 1 })}>Professor</button>
            </div>
          </Field>
          <Field label="Gender">
            <div className="radio-row">
              <button type="button" className={`chip ${form.gender === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 0 })}>Male</button>
              <button type="button" className={`chip ${form.gender === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 1 })}>Female</button>
            </div>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Phone (11 digits)"><input className="input" maxLength={11} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Credit points"><input className="input" type="number" value={form.credit_points} onChange={(e) => setForm({ ...form, credit_points: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Department">
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">â€” None (General) â€”</option>
              {departments.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {form.type === 1 ? (
            <Field label="Job title"><input className="input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></Field>
          ) : (
            <Field label="Level ID"><input className="input" type="number" min="1" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} placeholder="e.g. 1" /></Field>
          )}
        </div>
        {form.type === 0 ? (
          <Field label="Semester">
            <select className="select" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              <option value="">â€” None â€”</option>
              <option value="first">First</option>
              <option value="second">Second</option>
            </select>
          </Field>
        ) : null}
      </FormModal>
    </>
  )
}
