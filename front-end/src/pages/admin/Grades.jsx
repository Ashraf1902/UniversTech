import { useMemo, useState } from 'react'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Pager, Prog, RateBadge, Reveal, Spinner, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useOptions } from './_shared'
function SemesterCardExplorer({ students, sems }) {
  const { t } = useI18n()
  const [studentId, setStudentId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const card = useAsync(() => (studentId ? request(buildQuery('/api/semester-card', { student_id: studentId, semester_id: semesterId })) : Promise.resolve(null)), [studentId, semesterId])
  const d = card.data

  return (
    <>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="grid grid-2">
          <Field label={t('student')}>
            <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">{t('selectStudent')}</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={t('semesterOptionalActive')}>
            <select className="select" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">{t('activeSemester')}</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {!studentId ? (
        <Empty icon="award" title={t('pickStudent')} sub={t('pickStudentSub')} />
      ) : card.loading ? (
        <Spinner size={24} />
      ) : d ? (
        <Reveal className="card">
          <div className="card-head">
            <div>
              <h3 style={{ marginBottom: 4 }}>{d.student?.name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{d.student?.level || '—'} · {d.student?.department || t('general')} · {d.semester?.name} ({d.semester?.academic_year})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                {d.semester?.grading_system === 'fixed_term' ? `${d.summary?.percentage ?? '—'}%` : d.summary?.gpa ?? '—'}
              </div>
              <RateBadge rate={d.summary?.grade} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <Badge tone="grn">{t('gradedCount', { n: d.summary?.graded_courses })}</Badge>
            <Badge tone="amb">{t('totalCount', { n: d.summary?.total_courses })}</Badge>
            <Badge tone="cy">{t('creditHoursCount', { n: d.summary?.total_credit_hours })}</Badge>
          </div>
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table" style={{ minWidth: 0 }}>
              <thead><tr><th>{t('course')}</th><th>{t('code')}</th><th>{t('hours')}</th><th>{t('marks')}</th><th>{t('percent')}</th><th style={{ textAlign: 'right' }}>{t('status')}</th></tr></thead>
              <tbody>
                {(d.courses || []).map((c) => (
                  <tr key={c.course_id}>
                    <td className="cell-main">{c.course_name}</td>
                    <td>{c.course_code}</td>
                    <td>{c.credit_hours}</td>
                    <td>{c.marks != null ? `${c.marks}/${c.max_marks}` : '—'}</td>
                    <td>{c.percentage != null ? `${c.percentage}%` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.status === 'graded' ? <Badge tone="grn" dot>{t('graded')}</Badge> : <Badge tone="amb" dot>{t('pending')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      ) : (
        <Empty icon="award" title={t('noCardAvailable')} />
      )}
    </>
  )
}

export function AdminGrades() {
  const { t } = useI18n()
  const [tab, setTab] = useState('grades')
  const [page, setPage] = useState(1)
  const [archived, setArchived] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const isSuper = Boolean(user?.is_super_admin)

  const students = useOptions('/api/student/get/all', (s) => ({ value: s.id, label: s.name }))
  const courses = useOptions('/api/course/get/all', (c) => ({ value: c.id, label: c.course_name }))
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))

  const [filter, setFilter] = useState({ student_id: '', course_id: '', semester_id: '' })
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const query = useMemo(() => buildQuery({ ...filter, search, deleted: archived ? 1 : undefined, page }), [filter, search, archived, page])
  const list = useAsync(() => request(`/api/grade/get/all${query}`), [query])
  const paged = normalizePage(list.data)

const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ student_id: '', course_id: '', semester_id: '', marks: '', max_marks: '100' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

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
      toast.success(t('gradeSaved'))
      setOpen(false)
      clearErrors()
      list.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

const remove = async (row) => {
    if (!window.confirm(t('confirmArchiveGrade'))) return
    try {
      await request(`/api/grade/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('gradeArchived'))
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (row) => {
    if (!window.confirm(t('confirmRestoreGrade'))) return
    try {
      await request(`/api/grade/restore/${row.id}`, { method: 'POST' })
      toast.success(t('gradeRestored'))
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const purge = async (row) => {
    if (!window.confirm(t('confirmPurgeGrade'))) return
    try {
      await request(`/api/grade/purge/${row.id}`, { method: 'DELETE' })
      toast.success(t('gradeDeleted'))
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker={t('results')} title={t('gradesTitle')} sub={t('gradesSub')} actions={tab === 'grades' && !archived ? <Btn icon="plus" onClick={() => setOpen(true)}>{t('addGrade')}</Btn> : null} />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 380 }}>
        <button className={tab === 'grades' ? 'on' : ''} onClick={() => setTab('grades')}>{t('gradeRecords')}</button>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>{t('semesterCards')}</button>
      </div>

{tab === 'grades' ? (
        <>
          <div className="seg" style={{ marginBottom: 22, maxWidth: 300 }}>
            <button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setPage(1) }}>{t('active')}</button>
            <button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setPage(1) }}>{t('archived')}</button>
          </div>
          <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchGradesPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="grid grid-3">
              <Field label={t('student')}>
                <select className="select" value={filter.student_id} onChange={(e) => { setFilter({ ...filter, student_id: e.target.value }); setPage(1) }}>
                  <option value="">{t('allStudents')}</option>
                  {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label={t('course')}>
                <select className="select" value={filter.course_id} onChange={(e) => { setFilter({ ...filter, course_id: e.target.value }); setPage(1) }}>
                  <option value="">{t('allCourses')}</option>
                  {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label={t('semester')}>
                <select className="select" value={filter.semester_id} onChange={(e) => { setFilter({ ...filter, semester_id: e.target.value }); setPage(1) }}>
                  <option value="">{t('allSemesters')}</option>
                  {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
<DataTable
            loading={list.loading}
            rows={paged.items}
            columns={[
              { key: 'student', label: t('student'), main: true },
              { key: 'course', label: t('course') },
              { key: 'semester', label: t('semester'), render: (r) => r.semester || '—' },
              { key: 'marks', label: t('marks'), render: (r) => `${r.marks}/${r.max_marks}` },
              { key: 'percentage', label: t('percent'), render: (r) => (<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 130 }}><Prog value={r.percentage} sm /><span style={{ fontSize: '0.78rem' }}>{r.percentage}%</span></div>) },
              { key: 'letter_grade', label: t('rate'), render: (r) => <RateBadge rate={r.letter_grade} /> },
              ...(archived ? [{ key: 'deleted_at', label: t('archivedOn'), render: (r) => (r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—') }] : []),
            ]}
            onDelete={archived ? undefined : remove}
            onRestore={archived ? restore : undefined}
            onPurge={archived && isSuper ? purge : undefined}
          />
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <SemesterCardExplorer students={students} sems={sems} />
      )}

<FormModal open={open} onClose={() => setOpen(false)} title={t('addUpdateGrade')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('student')} error={errors?.student_id?.[0]}>
            <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={t('course')} error={errors?.course_id?.[0]}>
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('marks')} error={errors?.marks?.[0]}><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
          <Field label={t('maxMarks')} error={errors?.max_marks?.[0]}><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
        </div>
        <Field label={t('semesterOptionalActive')} error={errors?.semester_id?.[0]}>
          <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
            <option value="">{t('activeSemester')}</option>
            {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </FormModal>
    </>
  )
}
