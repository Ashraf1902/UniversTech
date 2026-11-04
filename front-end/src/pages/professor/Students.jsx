import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

const STATUS_META = {
  ok: { tone: 'grn', key: 'status_ok' },
  warning: { tone: 'amb', key: 'status_warning' },
  barred: { tone: 'red', key: 'status_barred' },
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function ProfessorStudents() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()

  const students = useAsync(() => (courseId ? request('/api/professors/course/student' + buildQuery({ course_id: courseId })) : Promise.resolve(null)), [courseId])
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ lecture_id: '', date: new Date().toISOString().slice(0, 10), status: true, reason: '' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const list = Array.isArray(students.data) ? students.data : []
  const lectureList = Array.isArray(lectures.data) ? lectures.data : []

  const sessions = list.reduce((max, s) => {
    const summary = s.attendance_summary
    const total = summary?.total ?? (s.attendances || []).length
    return Math.max(max, total)
  }, 0)
  const presentTotal = list.reduce((sum, s) => sum + (s.attendance_summary?.present ?? (s.attendances || []).filter((a) => a.status).length), 0)
  const attendanceRate = sessions && list.length ? Math.round((presentTotal / (sessions * list.length)) * 100) : 0

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
      students.run().catch(() => {})
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
        <>
          <div className="course-stats">
            <div>
              <span>{t('students')}</span>
              <strong>{list.length}</strong>
            </div>
            <div>
              <span>{t('sessions')}</span>
              <strong>{sessions}</strong>
            </div>
            <div>
              <span>{t('attendanceRate')}</span>
              <strong>{attendanceRate}%</strong>
            </div>
            <div>
              <span>{t('present')}</span>
              <strong>{presentTotal}</strong>
            </div>
            <div>
              <span>{t('absent')}</span>
              <strong>{sessions * list.length - presentTotal}</strong>
            </div>
          </div>

          <div className="prof-roster">
            {list.map((s) => {
              const att = s.attendances || []
              const present = s.attendance_summary?.present ?? att.filter((a) => a.status).length
              const total = s.attendance_summary?.total ?? att.length
              const absent = s.attendance_summary?.absent ?? total - present
              const statusMeta = STATUS_META[s.attendance_summary?.status] || null
              const presentPct = total ? Math.round((present / total) * 100) : 0
              const warn = s.attendance_summary?.warn_threshold
              const bar = s.attendance_summary?.bar_threshold
              return (
                <article className="card prof-roster-card" key={s.id}>
                  <div className="prof-roster-head">
                    <span className="prof-roster-avatar">{initials(s.name)}</span>
                    <div className="prof-roster-id">
                      <strong>{s.name}</strong>
                      <span>{s.email || '—'}</span>
                    </div>
                    {statusMeta ? <Badge tone={statusMeta.tone} dot>{t(statusMeta.key)}</Badge> : null}
                  </div>

                  <div className="std-chips">
                    <Badge>{s.gender === 'Female' ? t('female') : s.gender === 'Male' ? t('male') : (s.gender || '—')}</Badge>
                    <Badge tone="grn">{t('presentCount', { n: present })}</Badge>
                    <Badge tone={absent ? 'red' : ''}>{t('absentCount', { n: absent })}</Badge>
                    {total ? <Badge tone="vio">{t('attendanceRate')}: {presentPct}%</Badge> : null}
                  </div>

                  <div className="std-scale">
                    <div className="std-scale-track">
                      <span
                        className={`std-scale-fill ${statusMeta?.tone === 'grn' ? 'is-ok' : statusMeta?.tone === 'red' ? 'is-barred' : ''}`}
                        style={{ width: `${presentPct}%` }}
                      />
                      {warn != null ? <span className="std-scale-mark" style={{ insetInlineStart: `${Math.min(warn, 100)}%` }} /> : null}
                      {bar != null ? <span className="std-scale-mark is-bar" style={{ insetInlineStart: `${Math.min(bar, 100)}%` }} /> : null}
                    </div>
                    <div className="std-scale-legend">
                      <span>{total ? t('lecturesCount', { n: total }) : t('noLecturesYet')}</span>
                      <span>{t('absent')}: {total - present}</span>
                    </div>
                  </div>

                  <Btn
                    size="sm"
                    icon="check"
                    onClick={() => {
                      clearErrors()
                      setTarget(s)
                      setForm((f) => ({ ...f, lecture_id: lectureList[0]?.id || '' }))
                    }}
                  >
                    {t('attendance')}
                  </Btn>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <Empty icon="users" title={t('noStudentsEnrolled')} sub={t('noStudentsEnrolledSub')} />
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
