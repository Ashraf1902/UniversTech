import { useEffect, useState } from 'react'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Pager, Spinner, useToast } from '../../lib/ui'
import { Head, SearchBar, useDebounced, useFieldErrors } from './_shared'

const STATUS_META = {
  ok: { tone: 'grn', key: 'status_ok' },
  warning: { tone: 'amb', key: 'status_warning' },
  barred: { tone: 'red', key: 'status_barred' },
}

export function AttendanceStatusBadge({ status }) {
  const { t } = useI18n()
  const meta = STATUS_META[status] || STATUS_META.ok
  return <Badge tone={meta.tone} dot>{t(meta.key)}</Badge>
}

const today = () => new Date().toISOString().slice(0, 10)

export function AdminAttendance() {
  const { t } = useI18n()
  const toast = useToast()

  const [courseId, setCourseId] = useState('')
  const [lectureId, setLectureId] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ date: today(), status: true, reason: '' })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const coursesRes = useAsync(() => request('/api/attendance/courses'))
  const courses = normalizePage(coursesRes.data).items

  const lecturesRes = useAsync(
    () => (courseId ? request(`/api/attendance/lectures${buildQuery({ course_id: courseId })}`) : Promise.resolve(null)),
    [courseId],
  )
  const lectures = normalizePage(lecturesRes.data).items

  const rosterRes = useAsync(
    () =>
      courseId && lectureId
        ? request(`/api/attendance/roster${buildQuery({ course_id: courseId, lecture_id: lectureId })}`)
        : Promise.resolve(null),
    [courseId, lectureId],
  )
  const roster = normalizePage(rosterRes.data).items

  useEffect(() => {
    setPage(1)
  }, [courseId, lectureId, statusFilter, debouncedSearch, showArchived])

  const listQuery = buildQuery({
    page,
    course_id: courseId,
    lecture_id: lectureId,
    status: statusFilter,
    search: debouncedSearch,
    deleted: showArchived ? 1 : undefined,
  })
  const listRes = useAsync(() => request(`/api/attendance/get/all${listQuery}`), [listQuery])
  const paged = normalizePage(listRes.data)

  const pickCourse = (id) => {
    setCourseId(id)
    setLectureId('')
  }

  const openForStudent = (student) => {
    clearErrors()
    setTarget({ student_id: student.id, student_name: student.name, attendance_id: student.attendance_id })
    setForm({ date: today(), status: student.present ?? true, reason: student.reason || '' })
  }

  const openForRecord = (record) => {
    clearErrors()
    setTarget({ student_id: record.student_id, student_name: record.student, attendance_id: record.id })
    setForm({ date: record.date || today(), status: record.present, reason: record.reason || '' })
  }

  const closeModal = () => {
    setTarget(null)
    clearErrors()
  }

  const refresh = () => {
    rosterRes.run?.().catch(() => {})
    listRes.run?.().catch(() => {})
  }

  const submit = async () => {
    setBusy(true)
    clearErrors()
    try {
      if (target.attendance_id) {
        await request('/api/attendance/update', {
          method: 'POST',
          data: {
            attendance_id: target.attendance_id,
            student_id: target.student_id,
            lecture_id: Number(lectureId) || undefined,
            date: form.date,
            status: form.status,
            reason: form.reason || null,
          },
        })
        toast.success(t('attendanceUpdatedMsg'))
      } else {
        await request('/api/attendance/store', {
          method: 'POST',
          data: {
            student_id: target.student_id,
            lecture_id: Number(lectureId),
            date: form.date,
            status: form.status,
            reason: form.reason || null,
          },
        })
        toast.success(t('attendanceCreated'))
      }
      closeModal()
      refresh()
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const archive = async (record) => {
    try {
      await request(`/api/attendance/delete/${record.id}`, { method: 'DELETE' })
      toast.success(t('attendanceArchived'))
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const restore = async (record) => {
    try {
      await request(`/api/attendance/restore/${record.id}`, { method: 'POST' })
      toast.success(t('attendanceRestored'))
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker={t('attendance')} title={t('studentsAttendanceTitle')} sub={t('attendanceAdminSub')} />

      <div className="card attendance-filters" style={{ marginBottom: 22 }}>
        <div className="grid grid-3" style={{ gap: 16 }}>
          <Field label={t('course')}>
            <select className="select" value={courseId} onChange={(e) => pickCourse(e.target.value)} disabled={coursesRes.loading}>
              <option value="">{coursesRes.loading ? t('loadingCourses') : t('chooseCourseOption')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_name} {c.course_code ? `(${c.course_code})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('lecture')}>
            <select className="select" value={lectureId} onChange={(e) => setLectureId(e.target.value)} disabled={!courseId || lecturesRes.loading}>
              <option value="">{t('selectLecture')}</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('status')}>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('allStatuses')}</option>
              <option value="present">{t('present')}</option>
              <option value="absent">{t('absent')}</option>
            </select>
          </Field>
        </div>
      </div>

      {courseId && lectureId ? (
        rosterRes.loading ? (
          <Spinner size={24} />
        ) : roster.length ? (
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('email')}</th>
                  <th>{t('attendance')}</th>
                  <th>{t('absenceRate')}</th>
                  <th>{t('status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-main">{s.name}</td>
                    <td>{s.email}</td>
                    <td>
                      <Badge tone="grn">{t('presentCount', { n: s.present_count })}</Badge>{' '}
                      <Badge tone={s.absent_count ? 'red' : ''}>{t('absentCount', { n: s.absent_count })}</Badge>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{s.absence_percentage}%</span>
                    </td>
                    <td><AttendanceStatusBadge status={s.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn size="sm" variant="soft" icon="check" onClick={() => openForStudent(s)}>
                        {s.attendance_id ? t('editAttendance') : t('markAttendance')}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="users" title={t('noStudentsEnrolled')} />
        )
      ) : (
        <Empty icon="calendar" title={t('selectLectureFirst')} />
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h3>{t('attendanceRecords')}</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchBar value={search} onChange={setSearch} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {t('showArchivedAttendance')}
            </label>
          </div>
        </div>

        {listRes.loading ? (
          <Spinner size={24} />
        ) : paged.items.length ? (
          <>
            <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('student')}</th>
                    <th>{t('course')}</th>
                    <th>{t('lecture')}</th>
                    <th>{t('date')}</th>
                    <th>{t('status')}</th>
                    <th>{t('reason')}</th>
                    <th>{t('recordedBy')}</th>
                    <th style={{ textAlign: 'right' }}>{t('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((r) => (
                    <tr key={r.id}>
                      <td className="cell-main">
                        {r.student}
                        <div style={{ fontSize: '0.74rem', color: 'var(--faint)', fontWeight: 400 }}>{r.student_email}</div>
                      </td>
                      <td>{r.course}{r.course_code ? ` · ${r.course_code}` : ''}</td>
                      <td>{r.lecture || '—'}</td>
                      <td>{r.date || '—'}</td>
                      <td>{r.present ? <Badge tone="grn">{t('present')}</Badge> : <Badge tone="red">{t('absent')}</Badge>}</td>
                      <td style={{ maxWidth: 220 }}>{r.reason || '—'}</td>
                      <td>
                        {r.recorded_by || '—'}
                        {r.created_at ? <div style={{ fontSize: '0.74rem', color: 'var(--faint)' }}>{new Date(r.created_at).toLocaleDateString()}</div> : null}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions">
                          {showArchived ? (
                            <Btn size="sm" variant="soft" icon="refresh" title={t('restore')} onClick={() => restore(r)} />
                          ) : (
                            <>
                              <Btn size="sm" variant="soft" icon="edit" onClick={() => openForRecord(r)} />
                              <Btn size="sm" variant="danger" icon="trash" onClick={() => archive(r)} />
                            </>
                          )}
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
          <Empty icon="calendar" title={t('noAttendanceRecords')} sub={t('noAttendanceRecordsSub')} />
        )}
      </div>

      <Modal
        open={Boolean(target)}
        onClose={closeModal}
        title={target?.attendance_id ? t('editAttendance') : t('markAttendance')}
        footer={
          <>
            <Btn variant="ghost" onClick={closeModal}>{t('cancel')}</Btn>
            <Btn loading={busy} onClick={submit} icon="check">{t('save')}</Btn>
          </>
        }
      >
        {target ? (
          <>
            <div className="card" style={{ marginBottom: 16, padding: 14 }}>
              <div style={{ fontWeight: 600 }}>{target.student_name}</div>
            </div>
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
        ) : null}
      </Modal>
    </>
  )
}
