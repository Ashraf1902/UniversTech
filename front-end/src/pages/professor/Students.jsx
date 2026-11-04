import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useMyCourses } from './_shared'

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

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function attendanceFor(student, lectureId) {
  return (student.attendances || []).find((entry) => Number(entry.lec_id) === Number(lectureId))
}

export function ProfessorStudents() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()

  const students = useAsync(() => (courseId ? request('/api/professors/course/student' + buildQuery({ course_id: courseId })) : Promise.resolve(null)), [courseId])
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])

  const [lectureId, setLectureId] = useState('')
  const [sheetDate, setSheetDate] = useState(todayISO)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)

  const list = Array.isArray(students.data) ? students.data : []
  const lectureList = Array.isArray(lectures.data) ? lectures.data : []

  const sessions = list.reduce((max, s) => {
    const summary = s.attendance_summary
    const total = summary?.total ?? (s.attendances || []).length
    return Math.max(max, total)
  }, 0)
  const presentTotal = list.reduce((sum, s) => sum + (s.attendance_summary?.present ?? (s.attendances || []).filter((a) => a.status).length), 0)
  const attendanceRate = sessions && list.length ? Math.round((presentTotal / (sessions * list.length)) * 100) : 0

  const existingCount = Object.values(draft).filter((row) => row?.existing).length

  // The selected lecture is derived so switching courses can never leave a
  // stale lecture id (and therefore a stale roster sheet) behind.
  const activeLectureId = lectureList.some((lecture) => String(lecture.id) === String(lectureId))
    ? String(lectureId)
    : lectureList.length ? String(lectureList[0].id) : ''

  const setCourse = (id) => {
    setLectureId('')
    setDraft({})
    setParams(id ? { course: String(id) } : {})
  }

  useEffect(() => {
    if (!activeLectureId) {
      setDraft({})
      return
    }

    const next = {}
    let existingDate = ''

    list.forEach((student) => {
      const match = attendanceFor(student, activeLectureId)
      if (match?.date && !existingDate) existingDate = String(match.date).slice(0, 10)
      next[student.id] = {
        status: match ? Boolean(match.status) : true,
        reason: match?.reason || '',
        existing: Boolean(match),
      }
    })

    setDraft(next)
    setSheetDate(existingDate || todayISO())
  }, [activeLectureId, students.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (studentId, patch) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { status: true, reason: '', existing: false, ...prev[studentId], ...patch },
    }))
  }

  const saveAttendance = async () => {
    if (!activeLectureId || !list.length) return

    setBusy(true)
    try {
      const attendances = list.map((student) => {
        const row = draft[student.id] || { status: true, reason: '' }
        return {
          student_id: student.id,
          status: Boolean(row.status),
          reason: row.status ? null : (String(row.reason || '').trim() || null),
        }
      })

      const result = await request('/api/professors/attendance/bulk', {
        method: 'POST',
        data: { lecture_id: Number(activeLectureId), date: sheetDate, attendances },
      })

      toast.success(t('attendanceSaved', { n: result?.total ?? attendances.length }))
      await students.run()
    } catch (e) {
      toast.error(e.message)
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
          <section className="card prof-sheet">
            <div className="card-head">
              <div>
                <h3>{t('attendanceSheet')}</h3>
                <span className="home-card-sub">{t('attendanceSheetSub')}</span>
              </div>
              {existingCount ? <Badge tone="amb">{t('existingRecords', { n: existingCount })}</Badge> : null}
            </div>

            {lectureList.length ? (
              <>
                <div className="prof-sheet-grid">
                  <Field label={t('lecture')}>
                    <select className="select" value={activeLectureId} onChange={(e) => setLectureId(e.target.value)}>
                      {lectureList.map((lecture) => (
                        <option key={lecture.id} value={lecture.id}>{lecture.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('date')}>
                    <input className="input" type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />
                  </Field>
                </div>

                <div className="prof-sheet-rows">
                  {list.map((student) => {
                    const row = draft[student.id] || { status: true, reason: '', existing: false }
                    return (
                      <div className="prof-sheet-row" key={student.id}>
                        <div className="prof-sheet-student">
                          <span className="prof-roster-avatar is-sm">{initials(student.name)}</span>
                          <div className="prof-roster-id">
                            <strong>{student.name}</strong>
                            <span>{student.email || '—'}</span>
                          </div>
                          {row.existing ? <Badge tone="amb">{t('editingRecord')}</Badge> : null}
                        </div>
                        <div className="radio-row">
                          <button type="button" className={`chip ${row.status ? 'on' : ''}`} onClick={() => updateRow(student.id, { status: true })}>
                            {t('present')}
                          </button>
                          <button type="button" className={`chip ${!row.status ? 'on' : ''}`} onClick={() => updateRow(student.id, { status: false })}>
                            {t('absent')}
                          </button>
                        </div>
                        {row.status ? (
                          <span className="prof-sheet-blank" aria-hidden="true" />
                        ) : (
                          <input
                            className="input"
                            value={row.reason}
                            placeholder={t('reasonPh')}
                            onChange={(e) => updateRow(student.id, { reason: e.target.value })}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="prof-sheet-actions">
                  <Btn loading={busy} onClick={saveAttendance} icon="check" disabled={!sheetDate}>
                    {t('saveAttendance')}
                  </Btn>
                </div>
              </>
            ) : (
              <Empty icon="file" title={t('noLecturesYet')} sub={t('uploadLectureFirst')} />
            )}
          </section>

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
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <Empty icon="users" title={t('noStudentsEnrolled')} sub={t('noStudentsEnrolledSub')} />
      )}
    </>
  )
}
