import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function AppealStatus({ status }) {
  const { t } = useI18n()
  const tone = { pending: 'amb', accepted: 'grn', rejected: 'red' }[status] || ''
  const label = { pending: t('status_pending'), accepted: t('status_accepted'), rejected: t('status_refused') }[status] || status
  return <Badge tone={tone} dot>{label}</Badge>
}

export function ProfessorAppeals() {
  const { t, lang } = useI18n()
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
          <Reveal className="card">
            <div className="card-head">
              <div>
                <h3>{t('gradeAppeals')}</h3>
                <span className="home-card-sub">{t('total')}: {paged.total ?? paged.items.length}</span>
              </div>
            </div>

            <div className="std-appeal-list">
              {paged.items.map((appeal) => (
                <article className="std-appeal" key={appeal.id}>
                  <div className="std-appeal-head">
                    <div>
                      <strong>{appeal.student || '—'}</strong>
                      <span className="std-appeal-date">
                        {appeal.course || '—'}
                        {appeal.marks != null ? ` · ${appeal.marks}/${appeal.max_marks}` : ''}
                      </span>
                    </div>
                    <div>
                      <AppealStatus status={appeal.status} />
                      <span className="std-appeal-date">
                        {appeal.created_at
                          ? new Date(appeal.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <p className="std-appeal-reason">{appeal.reason}</p>

                  {appeal.response_note ? (
                    <div className="std-appeal-response">
                      <span>{t('responseNote')}</span>
                      {appeal.response_note}
                    </div>
                  ) : null}

                  {appeal.status === 'pending' ? (
                    <div className="prof-appeal-action">
                      <Btn size="sm" variant="soft" icon="mail" onClick={() => openRespond(appeal)}>{t('respond')}</Btn>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Reveal>
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
          <div className="prof-appeal-context">
            <strong>{target.student} · {target.course || '—'}</strong>
            {target.marks != null ? <span>{target.marks}/{target.max_marks}</span> : null}
            <p>{target.reason}</p>
          </div>
        ) : null}
        <Field label={t('decision')}>
          <div className="radio-row">
            <button type="button" className={`chip ${form.action === 'accept' ? 'on' : ''}`} onClick={() => setForm({ ...form, action: 'accept' })}>
              {t('acceptAppeal')}
            </button>
            <button type="button" className={`chip ${form.action === 'reject' ? 'on' : ''}`} onClick={() => setForm({ ...form, action: 'reject' })}>
              {t('rejectAppeal')}
            </button>
          </div>
        </Field>
        <Field label={t('appealNote')} hint={t('appealNoteHint')} error={errors?.note?.[0]}>
          <textarea className="input" rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </Modal>
    </>
  )
}
