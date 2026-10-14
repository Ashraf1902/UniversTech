import { useEffect, useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { Badge, Btn, Empty, Field, Modal, useToast } from '../../lib/ui'
import { useOptions } from './_shared'

export function CourseEnrollmentModal({ course, open, onClose }) {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [studentId, setStudentId] = useState('')
  const [override, setOverride] = useState(false)
  const [note, setNote] = useState('')
  const students = useOptions('/api/student/get/all', (s) => ({ value: s.id, label: `${s.name} — ${s.email}` }))

  const load = async () => {
    if (!course) return
    setLoading(true)
    try {
      const data = await request(`/api/course/enrollment/get/all?course_id=${course.id}`)
      setRows(normalizePage(data).items)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setStudentId('')
      setOverride(false)
      setNote('')
      load()
    }
  }, [open, course?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const enroll = async () => {
    if (!studentId) return toast.info(t('selectStudentRequired'))
    if (override && !note.trim()) return toast.info(t('noteRequiredForOverride'))
    setBusy(true)
    try {
      await request('/api/course/enrollment/enroll', {
        method: 'POST',
        data: { course_id: course.id, student_id: studentId, override, note: note.trim() || undefined },
      })
      toast.success(t('studentEnrolled'))
      setStudentId('')
      setOverride(false)
      setNote('')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const unenroll = async (row) => {
    if (!window.confirm(t('confirmUnenroll', { name: row.name }))) return
    setBusyId(row.id)
    try {
      await request('/api/course/enrollment/unenroll', {
        method: 'POST',
        data: { course_id: course.id, student_id: row.student_id },
      })
      toast.success(t('studentUnenrolled'))
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('enrollmentTitle')}${course?.course_name ? ` — ${course.course_name}` : ''}`}
      size="lg"
      footer={<Btn variant="ghost" onClick={onClose}>{t('close')}</Btn>}
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.86rem', marginBottom: 16 }}>{t('enrollmentSub')}</p>

      <div className="grid grid-2" style={{ gap: 14, alignItems: 'start' }}>
        <Field label={t('enrollStudent')}>
          <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">{t('selectStudent')}</option>
            {students.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label={t('overrideRules')}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            <span>{t('overrideRules')}</span>
          </label>
          {override
            ? <input className="input" placeholder={t('noteLabel')} value={note} onChange={(e) => setNote(e.target.value)} />
            : <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{t('overrideHint')}</span>}
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 20px' }}>
        <Btn loading={busy} icon="plus" onClick={enroll}>{t('enroll')}</Btn>
      </div>

      {loading ? (
        <div className="sk" style={{ height: 140 }} />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ textAlign: 'start' }}>{t('student')}</th>
                <th style={{ textAlign: 'start' }}>{t('email')}</th>
                <th style={{ textAlign: 'start' }}>{t('status')}</th>
                <th style={{ textAlign: 'end' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-main" style={{ textAlign: 'start' }}>{r.name}</td>
                  <td style={{ textAlign: 'start' }}>{r.email}</td>
                  <td style={{ textAlign: 'start' }}><Badge tone="grn">{t('status_registered')}</Badge></td>
                  <td style={{ textAlign: 'end' }}>
                    <Btn size="sm" variant="danger" icon="trash" loading={busyId === r.id} onClick={() => unenroll(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="users" title={t('noStudentsEnrolledAdmin')} />
      )}
    </Modal>
  )
}
