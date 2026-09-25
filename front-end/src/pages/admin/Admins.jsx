import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, CourseLoader, Empty, Field, I, useToast } from '../../lib/ui'
import { FormModal, Head } from './_shared'
const ADMIN_ROLES = [
  ['accounts', 'roleAccounts', 'users'],
  ['access_requests', 'roleAccessRequests', 'mail'],
  ['departments', 'roleDepartments', 'building'],
  ['courses', 'roleCourses', 'book'],
  ['semesters', 'roleSemesters', 'calendar'],
  ['schedules', 'roleSchedules', 'clock'],
  ['events', 'roleEvents', 'spark'],
  ['grades', 'roleGrades', 'award'],
]

export function AdminAdmins() {
  const { user } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request('/api/admin-management/get/all'))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', roles: [] })
  const [busyId, setBusyId] = useState(null)

  const isSuper = Boolean(user?.is_super_admin)
  const admins = normalizePage(data).items || []

  const toggleRole = (scope) =>
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(scope) ? f.roles.filter((r) => r !== scope) : [...f.roles, scope],
    }))

  const openCreate = () => {
    setEditId(null)
    setForm({ name: '', email: '', password: '', roles: [] })
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditId(row.id)
    setForm({ name: row.name, email: row.email, password: '', roles: row.roles || [] })
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) {
        const payload = { id: editId, name: form.name, roles: form.roles }
        if (form.password) payload.password = form.password
        await request('/api/admin-management/update', { method: 'POST', data: payload })
        toast.success(t('adminUpdated'))
      } else {
        await request('/api/admin-management/store', {
          method: 'POST',
          data: { name: form.name, email: form.email, password: form.password, roles: form.roles },
        })
        toast.success(t('adminCreated'))
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
    if (!window.confirm(`${t('deleteAdminConfirm')}\n\n${row.name} <${row.email}>`)) return
    setBusyId(row.id)
    try {
      await request(`/api/admin-management/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('adminDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (!isSuper) {
    return <Empty icon="shield" title={t('notAuthorized')} />
  }

  return (
    <>
      <Head
        kicker={t('adminMgmtKicker')}
        title={t('adminMgmtTitle')}
        sub={t('adminMgmtSub')}
        actions={
          <Btn icon="plus" onClick={openCreate}>
            {t('addAdmin')}
          </Btn>
        }
      />

      {loading ? (
        <CourseLoader label="Loading admins…" />
      ) : !admins.length ? (
        <Empty icon="shield" title={t('noAdmins')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((row) => {
                const isSelf = row.id === user?.id
                return (
                  <tr key={row.id}>
                    <td className="cell-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="av" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--grad)', fontSize: '0.75rem' }}>
                          {String(row.name || '?').split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('') || '?'}
                        </span>
                        {row.name}
                        {isSelf ? <Badge tone="cy">{t('superAdminSelf')}</Badge> : null}
                      </div>
                    </td>
                    <td>{row.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.is_super_admin
                          ? <Badge tone="vio" dot>{t('superAdmin')}</Badge>
                          : (row.roles || []).map((r) => <Badge key={r}>{r.replace('_', ' ')}</Badge>)}
                      </div>
                    </td>
                    <td>{row.is_super_admin ? <Badge tone="grn">Root</Badge> : <Badge>Admin</Badge>}</td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        {!row.is_super_admin && !isSelf ? (
                          <>
                            <Btn size="sm" variant="soft" icon="edit" onClick={() => openEdit(row)} />
                            <Btn size="sm" variant="danger" icon="trash" loading={busyId === row.id} onClick={() => remove(row)} />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? t('editAdmin') : t('newAdmin')}
        onSubmit={submit}
        busy={busy}
        submitLabel={editId ? t('saveChanges') || 'Save' : t('addAdmin')}
      >
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label={t('adminFieldsName')}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          {!editId ? (
            <Field label={t('adminFieldsEmail')}>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
          ) : null}
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          {!editId ? (
            <Field label={t('adminFieldsPassword')}>
              <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required={!editId} placeholder="Min 6 characters" />
            </Field>
          ) : (
            <Field label={t('adminFieldsPasswordKeep')}>
              <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep" />
            </Field>
          )}
        </div>
        <Field label={t('adminFieldsRoles')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ADMIN_ROLES.map(([scope, key, icon]) => (
              <button
                key={scope}
                type="button"
                className={`chip ${form.roles.includes(scope) ? 'on' : ''}`}
                onClick={() => toggleRole(scope)}
              >
                <I name={icon} size={14} style={{ marginRight: 6 }} />
                {t(key)}
              </button>
            ))}
          </div>
        </Field>
      </FormModal>
    </>
  )
}
