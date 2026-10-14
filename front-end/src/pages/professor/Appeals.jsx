import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Pager, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function AppealStatus({ status }) {
  const { t } = useI18n()
  const tone = { pending: 'amb', accepted: 'grn', rejected: 'red' }[status] || ''
  const label = { pending: t('status_pending'), accepted: t('status_accepted'), rejected: t('status_refused') }[status] || status
  return <Badge tone={tone} dot>{label}</Badge>
}

export function ProfessorAppeals() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const toast = useToast()
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const appeals = useAsync(() => request('/api/professor/appeal/get/all' + buildQuery({ course_id: courseId || undefined, status: statusFilter || undefined, page })), [courseId, statusFilter, page])
  const paged = normalizePage(appeals.data)

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ action: 'accept', note: '' })
  const [busy, setBusy] = useState(false)

  const openRespond = (appeal) => {
    setTarget(appeal)
    setForm({ action: 'accept', note: '' })
    clearErrors()
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/professor/appeal/respond', {
        method: 'POST',
        data: { appeal_id: target.id, action: form.action, note: form.note },
      })
      toast.success(t('appealAnswered'))
      setOpen(false)
      appeals.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker={t('results')} title={t('gradeAppeals')} sub={t('pAppealsSub')} />
      <div className="card" style={{ marginBottom: 22, maxWidth: 760 }}>
        <div className="grid grid-2">
          <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
          <Field label={t('status')}>
            <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">{t('allStatuses')}</option>
              <option value="pending">{t('status_pending')}</option>
              <option value="accepted">{t('status_accepted')}</option>
              <option value="rejected">{t('status_refused')}</option>
            </select>
          </Field>
        </div>
      </div>

      {appeals.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('course')}</th>
                  <th>{t('marks')}</th>
                  <th>{t('appealReason')}</th>
                  <th>{t('status')}</th>
                  <th>{t('submittedOn')}</th>
                  <th style={{ textAlign: 'right' }}>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-main">{a.student}</td>
                    <td>{a.course || '—'}</td>
                    <td>{a.marks != null ? `${a.marks}/${a.max_marks}` : '—'}</td>
                    <td style={{ maxWidth: 320 }}>{a.reason}</td>
                    <td><AppealStatus status={a.status} /></td>
                    <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        {a.status === 'pending' ? <Btn size="sm" variant="soft" icon="mail" title={t('respond')} onClick={() => openRespond(a)} /> : null}
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
        <Empty icon="mail" title={t('noAppeals')} sub={t('noAppealsSub')} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('respondToAppeal')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="check" disabled={!form.note}>{t('sendResponse')}</Btn></>}
      >
        {target ? (
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ fontWeight: 600 }}>{target.student} · {target.course || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 6 }}>{target.reason}</div>
          </div>
        ) : null}
        <Field label={t('decision')}>
          <div style={{ display: 'flex', gap: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="appeal-action" checked={form.action === 'accept'} onChange={() => setForm({ ...form, action: 'accept' })} />
              {t('acceptAppeal')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="appeal-action" checked={form.action === 'reject'} onChange={() => setForm({ ...form, action: 'reject' })} />
              {t('rejectAppeal')}
            </label>
          </div>
        </Field>
        <Field label={t('appealNote')} hint={t('appealNoteHint')} error={errors?.note?.[0]}>
          <textarea className="input" rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </Modal>
    </>
  )
}
