import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, useOptions, withSearch } from './_shared'
const emptyAccount = { name: '', email: '', password: '', gender: 0, nationalid: '', phone: '', credit_points: '', semester: '', type: 0, department_id: '', level_id: '', job_title: '' }

export function AdminAccounts() {
  const { t } = useI18n()
  const [tab, setTab] = useState('students')
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)
  const listPath = tab === 'students' ? '/api/student/get/all' : '/api/doctor/get/all'
  const basePath = archived ? `${listPath}?deleted=1` : listPath
  const { paged, loading, run } = useList(withSearch(basePath, search), page, [tab, archived, search])
  const departments = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyAccount)
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

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
        toast.success(t('accountUpdated'))
      } else {
        payload.password = form.password
        await request('/api/user/store', { method: 'POST', data: payload })
        toast.success(t('accountCreated'))
      }
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
    if (!window.confirm(t('confirmArchiveAccount', { name: row.name }))) return
    try {
      await request(`/api/user/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('accountArchived'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(t('confirmRestoreAccount', { name: row.name }))) return
    try {
      await request(`/api/user/restore/${row.id}`, { method: 'POST' })
      toast.success(t('accountRestored'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(t('confirmPurgeAccount', { name: row.name }))) return
    try {
      await request(`/api/user/purge/${row.id}`, { method: 'DELETE' })
      toast.success(t('accountDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

return (
    <>
<Head
        kicker={t('people')}
        title={t('accounts')}
        sub={t('accountsSub')}
        actions={!archived ? <Btn icon="plus" onClick={openCreate}>{tab === 'students' ? t('newStudent') : t('newProfessor')}</Btn> : null}
      />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 340 }}>
        <button className={tab === 'students' ? 'on' : ''} onClick={() => { setTab('students'); setPage(1) }}>{t('students')}</button>
        <button className={tab === 'doctors' ? 'on' : ''} onClick={() => { setTab('doctors'); setPage(1) }}>{t('professors')}</button>
      </div>
      <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
        <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>{t('active')}</button>
        <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>{t('archived')}</button>
      </div>
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchUsersPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={
          tab === 'students'
            ? [
                { key: 'name', label: t('name'), main: true },
                { key: 'email', label: t('email') },
                { key: 'level', label: t('level'), render: (r) => r.level || '—' },
                { key: 'department', label: t('department'), render: (r) => r.department || t('general') },
                { key: 'created_at', label: t('joined'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
              ]
            : [
                { key: 'name', label: t('name'), main: true },
                { key: 'email', label: t('email') },
                { key: 'job_title', label: t('jobTitle'), render: (r) => r.job_title || '—' },
                { key: 'created_at', label: t('joined'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
              ]
        }
onEdit={archived ? undefined : openEdit}
        onDelete={archived ? undefined : remove}
        onRestore={archived ? restore : undefined}
        onPurge={archived && isSuper ? purge : undefined}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />

<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editAccount') : t('createAccount')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('fullName')} error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t('email')} error={errors?.email?.[0]}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={editId ? t('newPasswordOptional') : t('password')} error={errors?.password?.[0]}><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label={t('nationalId14')} error={errors?.nationalid?.[0]}><input className="input" maxLength={14} value={form.nationalid} onChange={(e) => setForm({ ...form, nationalid: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('role')} error={errors?.type?.[0]}>
            <div className="radio-row">
              <button type="button" className={`chip ${form.type === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 0 })}>{t('student')}</button>
              <button type="button" className={`chip ${form.type === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 1 })}>{t('professor')}</button>
            </div>
          </Field>
          <Field label={t('gender')} error={errors?.gender?.[0]}>
            <div className="radio-row">
              <button type="button" className={`chip ${form.gender === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 0 })}>{t('male')}</button>
              <button type="button" className={`chip ${form.gender === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 1 })}>{t('female')}</button>
            </div>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('phone11')} error={errors?.phone?.[0]}><input className="input" maxLength={11} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('creditPoints')} error={errors?.credit_points?.[0]}><input className="input" type="number" value={form.credit_points} onChange={(e) => setForm({ ...form, credit_points: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('department')} error={errors?.department_id?.[0]}>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('noneGeneralOption')}</option>
              {departments.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {form.type === 1 ? (
            <Field label={t('jobTitle')} error={errors?.job_title?.[0]}><input className="input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></Field>
          ) : (
            <Field label={t('levelId')} error={errors?.level_id?.[0]}><input className="input" type="number" min="1" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} placeholder="e.g. 1" /></Field>
          )}
        </div>
        {form.type === 0 ? (
          <Field label={t('semester')} error={errors?.semester?.[0]}>
            <select className="select" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              <option value="">{t('noneOption')}</option>
              <option value="first">{t('first')}</option>
              <option value="second">{t('second')}</option>
            </select>
          </Field>
        ) : null}
      </FormModal>
    </>
  )
}
