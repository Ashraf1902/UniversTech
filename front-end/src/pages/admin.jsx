import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useAsync } from '../lib/hooks'
import { Badge, Btn, CourseLoader, Empty, Field, I, Modal, Pager, Prog, RateBadge, Reveal, Spinner, StatCard, useToast } from '../lib/ui'

function Head({ kicker, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {sub ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

function useList(path, page = 1, deps = []) {
  const a = useAsync(() => request(`${path}${path.includes('?') ? '&' : '?'}page=${page}`), [path, page, ...deps])
  return { ...a, paged: normalizePage(a.data) }
}

function useOptions(path, map) {
  const { data } = useAsync(() => request(path))
  const items = normalizePage(data).items
  return useMemo(() => items.map(map), [data]) // eslint-disable-line react-hooks/exhaustive-deps
}

function DataTable({ columns, rows, loading, onEdit, onDelete, empty }) {
  if (loading) return <CourseLoader label="Loading records…" />
  if (!rows.length) return empty || <Empty icon="info" title="No records yet" />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>
            ))}
            {onEdit || onDelete ? <th style={{ textAlign: 'right' }}>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id ?? ri}>
              {columns.map((c) => (
                <td key={c.key} style={c.align ? { textAlign: c.align } : undefined} className={c.main ? 'cell-main' : undefined}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              {onEdit || onDelete ? (
                <td>
                  <div className="row-actions">
                    {onEdit ? <Btn size="sm" variant="soft" icon="edit" onClick={() => onEdit(row)} /> : null}
                    {onDelete ? <Btn size="sm" variant="danger" icon="trash" onClick={() => onDelete(row)} /> : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormModal({ open, onClose, title, children, onSubmit, busy, submitLabel = 'Save' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={onSubmit} icon="check">{submitLabel}</Btn>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/* ============ HOME / CONTROL CENTER ============ */
export function AdminHome() {
  const { user } = useAuth()
  const { t } = useI18n()
  const isSuper = Boolean(user?.is_super_admin)
  const roles = user?.roles || []
  const can = (s) => isSuper || roles.includes(s)

  const fetch =
    (enabled, path) =>
    () =>
      enabled ? request(path) : Promise.resolve({ data: { data: [], total: 0 } })

  const students = useAsync(fetch(can('accounts'), '/api/student/get/all'), [can('accounts')])
  const doctors = useAsync(fetch(can('accounts'), '/api/doctor/get/all'), [can('accounts')])
  const courses = useAsync(fetch(can('courses'), '/api/course/get/all'), [can('courses')])
  const departments = useAsync(fetch(can('departments'), '/api/department/get/all'), [can('departments')])
  const semesters = useAsync(fetch(can('semesters'), '/api/semester/get/all'), [can('semesters')])
  const schedules = useAsync(fetch(can('schedules'), '/api/schedule/get/all'), [can('schedules')])
  const events = useAsync(fetch(can('events'), '/api/event/get/all'), [can('events')])

  const t2 = (a) => normalizePage(a.data).total

  const cards = [
    can('accounts') ? { icon: 'users', label: t('students'), value: t2(students), to: '/app/admin/accounts', tone: 'vio' } : null,
    can('accounts') ? { icon: 'cap', label: t('professors'), value: t2(doctors), to: '/app/admin/accounts', tone: 'cy' } : null,
    can('courses') ? { icon: 'book', label: t('courses'), value: t2(courses), to: '/app/admin/courses', tone: 'grn' } : null,
    can('departments') ? { icon: 'building', label: t('departments'), value: t2(departments), to: '/app/admin/departments', tone: 'pnk' } : null,
    can('semesters') ? { icon: 'calendar', label: t('semesters'), value: t2(semesters), to: '/app/admin/semesters', tone: 'amb' } : null,
    can('schedules') ? { icon: 'clock', label: t('schedules'), value: t2(schedules), to: '/app/admin/schedules', tone: 'cy' } : null,
    can('events') ? { icon: 'spark', label: t('events'), value: t2(events), to: '/app/admin/events', tone: 'pnk' } : null,
  ].filter(Boolean)

  return (
    <>
      <Reveal className="cta-band" style={{ padding: '44px 38px', marginBottom: 28, textAlign: 'left' }}>
        <span className="badge vio" style={{ marginBottom: 14 }}>
          <span className="gd" /> {t('administrator')}
        </span>
        <h1 style={{ fontSize: 'clamp(1.7rem,3vw,2.5rem)', marginBottom: 10 }}>
          {t('homeHeroPre')} <span className="grad-text">{t('homeHero')}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 640 }}>{t('homeHeroSub')}</p>
      </Reveal>

      {cards.length ? (
        <div className="grid grid-4">
          {cards.map((c, i) => (
            <Link to={c.to} key={c.label}>
              <StatCard icon={c.icon} label={c.label} value={c.value} tone={c.tone} delay={i * 0.05} sub={t('openSection')} />
            </Link>
          ))}
        </div>
      ) : (
        <Insight />
      )}
    </>
  )
}

function Insight() {
  const { t } = useI18n()
  return (
    <div className="card" style={{ padding: 26 }}>
      <h3 style={{ margin: '0 0 8px' }}>{t('homeEmptyTitle')}</h3>
      <p style={{ margin: 0, color: 'var(--muted)' }}>{t('homeEmptySub')}</p>
    </div>
  )
}

/* ============ ACCOUNTS ============ */
const emptyAccount = { name: '', email: '', password: '', gender: 0, nationalid: '', phone: '', credit_points: '', semester: '', type: 0, department_id: '', level_id: '', job_title: '' }

export function AdminAccounts() {
  const [tab, setTab] = useState('students')
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList(tab === 'students' ? '/api/student/get/all' : '/api/doctor/get/all', page, [tab])
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
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return
    try {
      await request(`/api/user/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Account deleted.')
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
        actions={<Btn icon="plus" onClick={openCreate}>New {tab === 'students' ? 'student' : 'professor'}</Btn>}
      />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 340 }}>
        <button className={tab === 'students' ? 'on' : ''} onClick={() => { setTab('students'); setPage(1) }}>Students</button>
        <button className={tab === 'doctors' ? 'on' : ''} onClick={() => { setTab('doctors'); setPage(1) }}>Professors</button>
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
        onEdit={openEdit}
        onDelete={remove}
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

/* ============ DEPARTMENTS ============ */
export function AdminDepartments() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/department/get/all', page)
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
    if (!window.confirm(`Delete department "${row.name}"?`)) return
    try {
      await request(`/api/department/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Department deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Academics" title="Departments" sub="Faculties and departments students and courses belong to." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ name: '', abbrevation: '' }); setOpen(true) }}>New department</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'name', label: 'Name', main: true },
          { key: 'abbreviation', label: 'Abbreviation', render: (r) => <Badge tone="vio">{r.abbreviation || 'â€”'}</Badge> },
          { key: 'created_by', label: 'Created by', render: (r) => r.created_by || 'â€”' },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ name: row.name || '', abbrevation: row.abbreviation || '' }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit department' : 'New department'} onSubmit={submit} busy={busy}>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Abbreviation"><input className="input" value={form.abbrevation} onChange={(e) => setForm({ ...form, abbrevation: e.target.value })} /></Field>
      </FormModal>
    </>
  )
}

/* ============ COURSES ============ */
export function AdminCourses() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/course/get/all', page)
  const depts = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))
  const profs = useOptions('/api/doctor/get/all', (u) => ({ value: u.id, label: u.name }))
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ course_name: '', no_of_hours: '', course_code: '', department_id: '', professor_id: '', semester_id: '', cover_image: null })
  const [busy, setBusy] = useState(false)

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
      toast.success('Course saved.')
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete course "${row.course_name}"?`)) return
    try {
      await request(`/api/course/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Course deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Academics" title="Courses" sub="Every course, its professor, department, semester, and cover." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ course_name: '', no_of_hours: '', course_code: '', department_id: '', professor_id: '', semester_id: '', cover_image: null }); setOpen(true) }}>New course</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'course_name', label: 'Course', main: true, render: (r) => (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="av" style={{ width: 36, height: 36, borderRadius: 10, background: r.cover_image && !r.cover_image.endsWith('default.jpg') ? `center/cover url(${r.cover_image})` : 'var(--grad)', fontSize: '0.7rem' }} />{r.course_name}</div>) },
          { key: 'course_code', label: 'Code', render: (r) => <Badge tone="vio">{r.course_code}</Badge> },
          { key: 'professor', label: 'Professor', render: (r) => r.professor || 'â€”' },
          { key: 'department', label: 'Department', render: (r) => r.department || 'General' },
          { key: 'semester', label: 'Semester', render: (r) => r.semester || 'â€”' },
          { key: 'no_of_hours', label: 'Hours' },
          { key: 'lecture_count', label: 'Lectures' },
        ]}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit course' : 'New course'} onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Course name"><input className="input" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} /></Field>
          <Field label="Course code"><input className="input" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Credit hours"><input className="input" type="number" min="1" value={form.no_of_hours} onChange={(e) => setForm({ ...form, no_of_hours: e.target.value })} /></Field>
          <Field label="Professor">
            <select className="select" value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })}>
              <option value="">â€” Select professor â€”</option>
              {profs.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Department (optional)">
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">â€” General (all) â€”</option>
              {depts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Semester (optional)">
            <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">â€” Any â€”</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Cover image"><input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, cover_image: e.target.files?.[0] || null })} /></Field>
      </FormModal>
    </>
  )
}

/* ============ SEMESTERS ============ */
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

/* ============ SCHEDULES ============ */
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

/* ============ EVENTS ============ */
export function AdminEvents() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/event/get/all', page)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (editId) fd.append('event_id', editId)
      fd.append('title', form.title)
      fd.append('content', form.content)
      if (form.image) fd.append('image', form.image)
      await request(editId ? '/api/event/update' : '/api/event/store', { method: 'POST', formData: fd })
      toast.success('Event saved and shared with students.')
      setOpen(false)
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete event "${row.title}"?`)) return
    try {
      await request(`/api/event/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Event deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Campus life" title="Events" sub="Publish events that are broadcast to every student instantly." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ title: '', content: '', image: null }); setOpen(true) }}>New event</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'title', label: 'Event', main: true },
          { key: 'content', label: 'Details', render: (r) => <span style={{ display: 'inline-block', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</span> },
          { key: 'created_by', label: 'Published by', render: (r) => r.created_by || 'â€”' },
          { key: 'created_at', label: 'Date', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'â€”') },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ title: row.title || '', content: row.content || '', image: null }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit event' : 'New event'} onSubmit={submit} busy={busy}>
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Content"><textarea className="textarea" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        <Field label={editId ? 'Replace image (optional)' : 'Image'}>
          <input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
        </Field>
      </FormModal>
    </>
  )
}

/* ============ GRADES & SEMESTER CARDS ============ */
export function AdminGrades() {
  const [tab, setTab] = useState('grades')
  const [page, setPage] = useState(1)
  const toast = useToast()

  const students = useOptions('/api/student/get/all', (s) => ({ value: s.id, label: s.name }))
  const courses = useOptions('/api/course/get/all', (c) => ({ value: c.id, label: c.course_name }))
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))

  const [filter, setFilter] = useState({ student_id: '', course_id: '', semester_id: '' })
  const query = useMemo(() => buildQuery({ ...filter, page }), [filter, page])
  const list = useAsync(() => request(`/api/grade/get/all${query}`), [query])
  const paged = normalizePage(list.data)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ student_id: '', course_id: '', semester_id: '', marks: '', max_marks: '100' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/grade/store', {
        method: 'POST',
        data: {
          student_id: Number(form.student_id), course_id: Number(form.course_id),
          semester_id: form.semester_id ? Number(form.semester_id) : null,
          marks: Number(form.marks), max_marks: Number(form.max_marks),
        },
      })
      toast.success('Grade saved.')
      setOpen(false)
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm('Delete this grade?')) return
    try {
      await request(`/api/grade/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Grade deleted.')
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Results" title="Grades & semester cards" sub="Record marks for any subject, and view a student's full semester card with final score and rate." actions={tab === 'grades' ? <Btn icon="plus" onClick={() => setOpen(true)}>Add grade</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 380 }}>
        <button className={tab === 'grades' ? 'on' : ''} onClick={() => setTab('grades')}>Grade records</button>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>Semester cards</button>
      </div>

      {tab === 'grades' ? (
        <>
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="grid grid-3">
              <Field label="Student">
                <select className="select" value={filter.student_id} onChange={(e) => { setFilter({ ...filter, student_id: e.target.value }); setPage(1) }}>
                  <option value="">All students</option>
                  {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Course">
                <select className="select" value={filter.course_id} onChange={(e) => { setFilter({ ...filter, course_id: e.target.value }); setPage(1) }}>
                  <option value="">All courses</option>
                  {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Semester">
                <select className="select" value={filter.semester_id} onChange={(e) => { setFilter({ ...filter, semester_id: e.target.value }); setPage(1) }}>
                  <option value="">All semesters</option>
                  {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <DataTable
            loading={list.loading}
            rows={paged.items}
            columns={[
              { key: 'student', label: 'Student', main: true },
              { key: 'course', label: 'Course' },
              { key: 'semester', label: 'Semester', render: (r) => r.semester || 'â€”' },
              { key: 'marks', label: 'Marks', render: (r) => `${r.marks}/${r.max_marks}` },
              { key: 'percentage', label: '%', render: (r) => (<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 130 }}><Prog value={r.percentage} sm /><span style={{ fontSize: '0.78rem' }}>{r.percentage}%</span></div>) },
              { key: 'letter_grade', label: 'Rate', render: (r) => <RateBadge rate={r.letter_grade} /> },
            ]}
            onDelete={remove}
          />
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <SemesterCardExplorer students={students} sems={sems} />
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title="Add / update grade" onSubmit={submit} busy={busy}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Student">
            <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Course">
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">â€” Select â€”</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Marks"><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
          <Field label="Max marks"><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
        </div>
        <Field label="Semester (optional â€” defaults to active)">
          <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
            <option value="">â€” Active semester â€”</option>
            {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </FormModal>
    </>
  )
}

function SemesterCardExplorer({ students, sems }) {
  const [studentId, setStudentId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const card = useAsync(() => (studentId ? request(buildQuery('/api/semester-card', { student_id: studentId, semester_id: semesterId })) : Promise.resolve(null)), [studentId, semesterId])
  const d = card.data

  return (
    <>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="grid grid-2">
          <Field label="Student">
            <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">â€” Select student â€”</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Semester (optional â€” defaults to active)">
            <select className="select" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">â€” Active semester â€”</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {!studentId ? (
        <Empty icon="award" title="Pick a student" sub="Select a student to view their semester card." />
      ) : card.loading ? (
        <Spinner size={24} />
      ) : d ? (
        <Reveal className="card">
          <div className="card-head">
            <div>
              <h3 style={{ marginBottom: 4 }}>{d.student?.name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{d.student?.level || 'â€”'} Â· {d.student?.department || 'General'} Â· {d.semester?.name} ({d.semester?.academic_year})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                {d.semester?.grading_system === 'fixed_term' ? `${d.summary?.percentage ?? 'â€”'}%` : d.summary?.gpa ?? 'â€”'}
              </div>
              <RateBadge rate={d.summary?.grade} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <Badge tone="grn">{d.summary?.graded_courses} graded</Badge>
            <Badge tone="amb">{d.summary?.total_courses} total</Badge>
            <Badge tone="cy">{d.summary?.total_credit_hours} credit hours</Badge>
          </div>
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table" style={{ minWidth: 0 }}>
              <thead><tr><th>Course</th><th>Code</th><th>Hours</th><th>Marks</th><th>%</th><th style={{ textAlign: 'right' }}>Status</th></tr></thead>
              <tbody>
                {(d.courses || []).map((c) => (
                  <tr key={c.course_id}>
                    <td className="cell-main">{c.course_name}</td>
                    <td>{c.course_code}</td>
                    <td>{c.credit_hours}</td>
                    <td>{c.marks != null ? `${c.marks}/${c.max_marks}` : 'â€”'}</td>
                    <td>{c.percentage != null ? `${c.percentage}%` : 'â€”'}</td>
                    <td style={{ textAlign: 'right' }}>{c.status === 'graded' ? <Badge tone="grn" dot>Graded</Badge> : <Badge tone="amb" dot>Pending</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      ) : (
        <Empty icon="award" title="No card available" />
      )}
    </>
  )
}
/* ============ ADMINS & ROLES ============ */
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

/* ============ ACCESS REQUESTS ============ */
export function AdminAccessRequests() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const toast = useToast()
  const path = `/api/access-request/get/all${buildQuery({ status })}`
  const { paged, loading, run } = useList(path, page, [status])
  const [busyId, setBusyId] = useState(null)

  const respond = async (row, action) => {
    if (!window.confirm(action === 'accept' ? `Accept ${row.name}'s request and create their account?` : `Refuse ${row.name}'s request?`)) return
    setBusyId(action === 'accept' ? `a-${row.id}` : `r-${row.id}`)
    try {
      await request('/api/access-request/respond', { method: 'POST', data: { id: row.id, action } })
      toast.success(action === 'accept' ? 'Request accepted. Account created.' : 'Request refused.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const tone = { pending: 'amb', accepted: 'grn', refused: 'red' }

  return (
    <>
      <Head
        kicker="Onboarding"
        title="Access Requests"
        sub="Students who applied for access. Accepting creates their account — refusing closes the request."
      />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 460 }}>
        {[['pending', 'Pending'], ['accepted', 'Accepted'], ['refused', 'Refused']].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1) }}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner size={24} /> : !paged.items.length ? (
        <Empty icon="mail" title="Nothing here" sub="No requests in this list yet." />
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          {paged.items.map((row) => (
            <Reveal key={row.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span className="av" style={{ width: 48, height: 48, borderRadius: 15, background: 'var(--grad)', fontSize: '0.85rem' }}>
                  {String(row.name || '?').split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('') || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{row.email}</div>
                </div>
                <Badge tone={tone[row.status] || ''} dot>{row.status}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0 16px' }}>
                <Badge tone="vio">{row.level || '—'}</Badge>
                <Badge tone="cy">{row.department || 'General'}</Badge>
                <Badge>{row.gender || '—'}</Badge>
                {row.national_id ? <Badge>{row.national_id}</Badge> : null}
                {row.phone ? <Badge>{row.phone}</Badge> : null}
              </div>
              {row.decided_by
                ? <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>Decided by {row.decided_by}</div>
                : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn size="sm" variant="ghost" loading={busyId === `a-${row.id}`} onClick={() => respond(row, 'accept')}><I name="check" size={16} /> Accept</Btn>
                    <Btn size="sm" variant="danger" loading={busyId === `r-${row.id}`} onClick={() => respond(row, 'refuse')}><I name="x" size={16} /> Refuse</Btn>
                  </div>
                )}
            </Reveal>
          ))}
        </div>
      )}
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
    </>
  )
}
