import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'
export function ProfessorStudents() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()

  const students = useAsync(() => (courseId ? request(buildQuery('/api/professors/course/student', { course_id: courseId })) : Promise.resolve(null)), [courseId])
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ lecture_id: '', date: new Date().toISOString().slice(0, 10), status: true, reason: '' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const list = Array.isArray(students.data) ? students.data : []
  const lectureList = Array.isArray(lectures.data) ? lectures.data : []

  const setCourse = (id) => setParams(id ? { course: String(id) } : {})

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/professors/make/attendance', {
        method: 'POST',
        data: { student_id: target.id, lecture_id: Number(form.lecture_id), date: form.date, status: form.status, reason: form.reason || null },
      })
      toast.success(t('attendanceRecorded', { name: target.name }))
      setTarget(null)
      clearErrors()
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
<Head kicker={t('classroom')} title={t('studentsAttendanceTitle')} sub={t('studentsAttendanceSub')} />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={setCourse} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="users" title={t('selectCourse')} sub={t('chooseCourseSub')} />
      ) : students.loading ? (
        <Spinner size={24} />
      ) : list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t('student')}</th><th>{t('email')}</th><th>{t('gender')}</th><th>{t('attendance')}</th><th style={{ textAlign: 'right' }}>{t('action')}</th></tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const att = s.attendances || []
                const present = att.filter((a) => a.status).length
                return (
                  <tr key={s.id}>
                    <td className="cell-main">{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.gender === 'Female' ? t('female') : s.gender === 'Male' ? t('male') : (s.gender || '—')}</td>
                    <td>
                      <Badge tone="grn">{t('presentCount', { n: present })}</Badge>{' '}
                      <Badge tone={att.length - present ? 'red' : ''}>{t('absentCount', { n: att.length - present })}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn size="sm" icon="check" onClick={() => { clearErrors(); setTarget(s); setForm((f) => ({ ...f, lecture_id: lectureList[0]?.id || '' })) }}>{t('attendance')}</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="users" title={t('noStudentsEnrolled')} />
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={t('attendanceTitle', { name: target?.name || '' })}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setTarget(null)}>{t('cancel')}</Btn>
            <Btn loading={busy} onClick={submit} icon="check" disabled={!form.lecture_id}>{t('save')}</Btn>
          </>
        }
      >
        {lectureList.length ? (
          <>
<Field label={t('lecture')} error={errors?.lecture_id?.[0]}>
              <select className="select" value={form.lecture_id} onChange={(e) => setForm({ ...form, lecture_id: e.target.value })}>
                <option value="">{t('selectLecture')}</option>
                {lectureList.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label={t('date')} error={errors?.date?.[0]}>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label={t('status')}>
              <div className="radio-row">
                <button type="button" className={`chip ${form.status ? 'on' : ''}`} onClick={() => setForm({ ...form, status: true })}>{t('present')}</button>
                <button type="button" className={`chip ${!form.status ? 'on' : ''}`} onClick={() => setForm({ ...form, status: false })}>{t('absent')}</button>
              </div>
            </Field>
            {!form.status ? (
              <Field label={t('reasonOptional')} error={errors?.reason?.[0]}>
                <textarea className="textarea" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t('reasonPh')} />
              </Field>
            ) : null}
          </>
        ) : (
          <Empty icon="file" title={t('noLecturesYet')} sub={t('uploadLectureFirst')} />
        )}
      </Modal>
    </>
  )
}
