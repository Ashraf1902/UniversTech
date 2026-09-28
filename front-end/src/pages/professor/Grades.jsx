import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, Empty, Field, Modal, Pager, Prog, RateBadge, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'
export function ProfessorGrades() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const toast = useToast()
  const grades = useAsync(() => (courseId ? request(buildQuery('/api/professor/grade/get/all', { course_id: courseId, page })) : Promise.resolve(null)), [courseId, page])
  const paged = normalizePage(grades.data)
  const students = useAsync(() => (courseId ? request(buildQuery('/api/professors/course/student', { course_id: courseId })) : Promise.resolve(null)), [courseId])
const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ student_id: '', marks: '', max_marks: '100' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const studentList = Array.isArray(students.data) ? students.data : []

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/professor/grade/store', {
        method: 'POST',
        data: {
          student_id: Number(form.student_id),
          course_id: courseId,
          marks: Number(form.marks),
          max_marks: Number(form.max_marks),
        },
      })
      toast.success(t('gradeSaved'))
      setOpen(false)
      clearErrors()
      setForm({ student_id: '', marks: '', max_marks: '100' })
      grades.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
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
        actions={<Btn icon="plus" onClick={() => setOpen(true)} disabled={!courseId}>{t('addGrade')}</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="chart" title={t('selectCourse')} />
      ) : grades.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('student')}</th><th>{t('semester')}</th><th>{t('marks')}</th><th>{t('percent')}</th><th>{t('rate')}</th><th style={{ textAlign: 'right' }}>{t('action')}</th></tr></thead>
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
                    <td style={{ textAlign: 'right' }}><Btn size="sm" variant="danger" icon="trash" onClick={() => remove(g.id)} /></td>
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
        title={t('addUpdateGrade')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="check" disabled={!form.student_id}>{t('saveGrade')}</Btn></>}
      >
        <Field label={t('student')} error={errors?.student_id?.[0]}>
          <select className="select" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
            <option value="">{t('selectStudent')}</option>
            {studentList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('marks')} error={errors?.marks?.[0]}><input className="input" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
          <Field label={t('maxMarks')} error={errors?.max_marks?.[0]}><input className="input" type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}
