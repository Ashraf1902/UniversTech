import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Pager, Prog, RateBadge, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function GradeStatus({ status }) {
  const { t } = useI18n()
  const tone = { draft: 'amb', published: 'cy', locked: 'vio' }[status] || ''
  const label = { draft: t('statusDraft'), published: t('statusPublished'), locked: t('statusLocked') }[status] || status
  return <Badge tone={tone} dot>{label}</Badge>
}

function ComponentsModal({ open, onClose, courseId, onSaved }) {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const { data, loading } = useAsync(() => (open && courseId ? request('/api/professor/grade/component/get/all' + buildQuery({ course_id: courseId })) : Promise.resolve(null)), [open, courseId])

  useEffect(() => {
    if (data) setRows(data.map((c) => ({ name: c.name, weight: String(c.weight) })))
  }, [data])

  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0), [rows])

  const save = async () => {
    setBusy(true)
    try {
      await request('/api/professor/grade/component/sync', {
        method: 'POST',
        data: { course_id: courseId, components: rows.map((r, i) => ({ name: r.name, weight: Number(r.weight) || 0, position: i })) },
      })
      toast.success(t('componentsSaved'))
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manageComponents')}
      size="lg"
      footer={<><Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn><Btn loading={busy} icon="check" onClick={save}>{t('saveComponents')}</Btn></>}
    >
      <p className="subt" style={{ marginBottom: 14 }}>{t('componentsSub')}</p>
      {loading ? <Spinner size={22} /> : (
        <>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-2" style={{ gap: 14, alignItems: 'end', marginBottom: 10 }}>
              <Field label={t('componentName')}>
                <input className="input" value={row.name} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
              </Field>
              <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
                <Field label={t('weight')} className="grow">
                  <input className="input" type="number" min="0" max="100" value={row.weight} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, weight: e.target.value } : r)))} />
                </Field>
                <Btn size="sm" variant="danger" icon="trash" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
              </div>
            </div>
          ))}
          <Btn size="sm" variant="soft" icon="plus" onClick={() => setRows([...rows, { name: '', weight: '0' }])}>{t('addComponent')}</Btn>
          <p style={{ marginTop: 12, color: total === 100 ? 'var(--muted)' : '#ffc2cd', fontSize: '0.82rem' }}>
            {t('weightsTotal', { n: total })}
          </p>
        </>
      )}
    </Modal>
  )
}

export function ProfessorGrades() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const toast = useToast()
  const grades = useAsync(() => (courseId ? request('/api/professor/grade/get/all' + buildQuery({ course_id: courseId, page, status: statusFilter || undefined })) : Promise.resolve(null)), [courseId, page, statusFilter])
  const paged = normalizePage(grades.data)
  const students = useAsync(() => (courseId ? request('/api/professors/course/student' + buildQuery({ course_id: courseId })) : Promise.resolve(null)), [courseId])
  const components = useAsync(() => (courseId ? request('/api/professor/grade/component/get/all' + buildQuery({ course_id: courseId })) : Promise.resolve(null)), [courseId])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ student_id: '', marks: '', max_marks: '100', reason: '' })
  const [scores, setScores] = useState({})
  const [busy, setBusy] = useState(false)
  const [compOpen, setCompOpen] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const studentList = Array.isArray(students.data) ? students.data : []
  const componentList = Array.isArray(components.data) ? components.data : []
  const hasComponents = componentList.length > 0

  const openCreate = () => {
    setEditing(null)
    setForm({ student_id: '', marks: '', max_marks: '100', reason: '' })
    setScores({})
    clearErrors()
    setOpen(true)
  }

  const openEdit = (g) => {
    setEditing(g)
    setForm({ student_id: String(g.student_id), marks: String(g.marks), max_marks: String(g.max_marks), reason: '' })
    const map = {}
    ;(g.component_scores || []).forEach((s) => { map[s.grade_component_id] = { marks: String(s.marks), max_marks: String(s.max_marks) } })
    setScores(map)
    clearErrors()
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      const payload = {
        student_id: Number(form.student_id),
        course_id: courseId,
        max_marks: Number(form.max_marks),
      }
      if (hasComponents) {
        payload.component_scores = componentList.map((c) => ({
          grade_component_id: c.id,
          marks: Number(scores[c.id]?.marks) || 0,
          max_marks: Number(scores[c.id]?.max_marks) || 100,
        }))
      } else {
        payload.marks = Number(form.marks)
      }
      if (editing?.status === 'published') payload.reason = form.reason
      await request('/api/professor/grade/store', { method: 'POST', data: payload })
      toast.success(t('gradeSavedDraft'))
      setOpen(false)
      clearErrors()
      grades.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const publish = async (g) => {
    try {
      await request('/api/professor/grade/publish', { method: 'POST', data: { grade_id: g.id } })
      toast.success(t('gradePublished'))
      grades.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const publishAll = async () => {
    if (!window.confirm(t('confirmPublishAll'))) return
    try {
      const res = await request('/api/professor/grade/publish', { method: 'POST', data: { course_id: courseId } })
      toast.success(t('gradesPublishedToast', { n: res?.published ?? 0 }))
      grades.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (id) => {
    try {
      await request(`/api/professor/grade/delete/${id}`, { method: 'DELETE' })
      toast.success(t('gradeRemoved'))
      grades.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker={t('results')}
        title={t('grades')}
        sub={t('pGradesSub')}
        actions={
          <>
            <Btn variant="soft" icon="layers" onClick={() => setCompOpen(true)} disabled={!courseId}>{t('components')}</Btn>
            <Btn variant="soft" icon="upload" onClick={publishAll} disabled={!courseId}>{t('publishAll')}</Btn>
            <Btn icon="plus" onClick={openCreate} disabled={!courseId}>{t('addGrade')}</Btn>
          </>
        }
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 760 }}>
        <div className="grid grid-2">
          <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
          <Field label={t('status')}>
            <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">{t('allStatuses')}</option>
              <option value="draft">{t('statusDraft')}</option>
              <option value="published">{t('statusPublished')}</option>
              <option value="locked">{t('statusLocked')}</option>
            </select>
          </Field>
        </div>
      </div>

      {!courseId ? (
        <Empty icon="chart" title={t('selectCourse')} />
      ) : grades.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('student')}</th><th>{t('semester')}</th><th>{t('marks')}</th><th>{t('percent')}</th><th>{t('rate')}</th><th>{t('status')}</th><th style={{ textAlign: 'right' }}>{t('action')}</th></tr></thead>
              <tbody>
                {paged.items.map((g) => (
                  <tr key={g.id}>
                    <td className="cell-main">{g.student}</td>
                    <td>{g.semester || '—'}</td>
                    <td>{g.marks}/{g.max_marks}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Prog value={g.percentage} sm />
                        <span style={{ fontSize: '0.78rem' }}>{g.percentage}%</span>
                      </div>
                    </td>
                    <td><RateBadge rate={g.rate} /></td>
                    <td><GradeStatus status={g.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        {g.can_edit ? <Btn size="sm" variant="soft" icon="edit" onClick={() => openEdit(g)} /> : null}
                        {g.status === 'draft' ? <Btn size="sm" variant="primary" icon="upload" onClick={() => publish(g)} /> : null}
                        {g.can_delete ? <Btn size="sm" variant="danger" icon="trash" onClick={() => remove(g.id)} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="chart" title={t('noGradesRecorded')} sub={t('addFirstGrade')} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('editGrade') : t('addUpdateGrade')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="check" disabled={!form.student_id}>{t('saveGrade')}</Btn></>}
      >
        {editing?.status === 'published' ? (
          <p className="subt" style={{ marginBottom: 12 }}>{t('publishedEditNotice')}</p>
        ) : null}
        <Field label={t('student')} error={errors?.student_id?.[0]}>
          <select className="select" value={form.student_id} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
            <option value="">{t('selectStudent')}</option>
            {studentList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {hasComponents ? (
          <>
            {componentList.map((c) => (
              <div key={c.id} className="grid grid-2" style={{ gap: 14 }}>
                <Field label={`${c.name} · ${c.weight}%`}>
                  <input className="input" type="number" min="0" value={scores[c.id]?.marks ?? ''} onChange={(e) => setScores({ ...scores, [c.id]: { ...(scores[c.id] || {}), marks: e.target.value } })} />
                </Field>
                <Field label={t('maxMarks')}>
                  <input className="input" type="number" min="1" value={scores[c.id]?.max_marks ?? '100'} onChange={(e) => setScores({ ...scores, [c.id]: { ...(scores[c.id] || {}), max_marks: e.target.value } })} />
                </Field>
              </div>
            ))}
            <Field label={t('maxMarks')} error={errors?.max_marks?.[0]}><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
          </>
        ) : (
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('marks')} error={errors?.marks?.[0]}><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
            <Field label={t('maxMarks')} error={errors?.max_marks?.[0]}><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
          </div>
        )}
        {editing?.status === 'published' ? (
          <Field label={t('editReason')} hint={t('editReasonHint')} error={errors?.reason?.[0]}>
            <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        ) : null}
      </Modal>

      <ComponentsModal open={compOpen} onClose={() => setCompOpen(false)} courseId={courseId} onSaved={() => { components.run().catch(() => {}) }} />
    </>
  )
}
