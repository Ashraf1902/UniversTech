import { useState } from 'react'
import { downloadErrorKey, downloadFile, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { Head } from './_shared'

const STATUS = {
  not_submitted: { tone: 'amb', key: 'quizNotSubmitted' },
  submitted: { tone: 'cy', key: 'quizSubmitted' },
  graded: { tone: 'grn', key: 'quizGraded' },
}

export function StudentQuizzes() {
  const { t } = useI18n()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const quizzes = useAsync(() => request(`/api/user/quizzes?page=${page}`), [page])
  const paged = normalizePage(quizzes.data)

  const [active, setActive] = useState(null)
  const [form, setForm] = useState({ answer_text: '', file: null })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [downloading, setDownloading] = useState(null)

  const downloadSubmission = async (submission) => {
    if (!submission?.download_url) return
    setDownloading(submission.id)
    try {
      await downloadFile(submission.download_url, submission.original_name || undefined)
    } catch (e) {
      toast.error(t(downloadErrorKey(e)))
    } finally {
      setDownloading(null)
    }
  }

  const openSubmit = (quiz) => {
    setActive(quiz)
    setForm({ answer_text: quiz.submission?.answer_text || '', file: null })
    setErrors({})
  }

  const submit = async () => {
    if (!form.answer_text && !form.file) {
      setErrors({ answer_text: [t('answerOrFileRequired')] })
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      if (form.answer_text) fd.append('answer_text', form.answer_text)
      if (form.file) fd.append('file', form.file)
      await request(`/api/user/quiz/${active.id}/submit`, { method: 'POST', formData: fd })
      toast.success(t('quizSubmittedOk'))
      setActive(null)
      quizzes.run().catch(() => {})
    } catch (e) {
      const fe = e?.payload?.data
      if (fe && typeof fe === 'object' && !Array.isArray(fe)) setErrors(fe)
      else toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker={t('assessment')} title={t('myQuizzes')} sub={t('myQuizzesSub')} />

      {quizzes.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.items.map((q, i) => {
              const meta = STATUS[q.status] || STATUS.not_submitted
              return (
                <Reveal key={q.id} className="card" delay={i * 0.04}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6' }}><I name="award" size={18} /></span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600 }}>{q.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                        {q.course?.course_name || ''} · {q.due_at ? t('due', { date: new Date(q.due_at).toLocaleDateString() }) : t('noDueDate')} · {t('maxScoreLabel', { n: q.max_score })}
                      </div>
                    </div>
                    <Badge tone={meta.tone} dot>{t(meta.key)}</Badge>
                    {q.submission && q.submission.score != null ? <Badge tone="grn">{q.submission.score}/{q.max_score}</Badge> : null}
                    <a href={q.content} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn></a>
                    {q.can_submit ? (
                      <Btn size="sm" icon="upload" onClick={() => openSubmit(q)}>{q.submission ? t('resubmit') : t('submitQuiz')}</Btn>
                    ) : null}
                  </div>

                  {q.blocked_reason === 'deadline_passed' ? (
                    <div className="form-alert" role="status" style={{ marginTop: 12 }}>{t('quizDeadlinePassed')}</div>
                  ) : null}
                  {q.blocked_reason === 'already_submitted' ? (
                    <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--faint)' }}>{t('quizAlreadySubmitted')}</div>
                  ) : null}

                  {q.submission ? (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                      <div><strong>{t('yourSubmission')}:</strong> {q.submission.submitted_at ? new Date(q.submission.submitted_at).toLocaleString() : '—'}</div>
                      {q.submission.answer_text ? <div style={{ color: 'var(--muted)' }}>{q.submission.answer_text}</div> : null}
                      {q.submission.download_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <Btn
                            size="sm"
                            variant="soft"
                            icon="download"
                            loading={downloading === q.submission.id}
                            onClick={() => downloadSubmission(q.submission)}
                          >
                            {downloading === q.submission.id ? t('downloading') : t('downloadSubmission')}
                          </Btn>
                          {q.submission.original_name ? (
                            <span style={{ color: 'var(--faint)', fontSize: '0.78rem', wordBreak: 'break-all' }}>{q.submission.original_name}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {q.submission.graded_at ? (
                        <div>
                          <strong>{t('scoreLabel')}:</strong> {q.submission.score}/{q.max_score}
                          {q.submission.feedback ? <span> · {q.submission.feedback}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Reveal>
              )
            })}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Reveal className="card">
          <Empty icon="award" title={t('noQuizzes')} />
        </Reveal>
      )}

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${t('submitQuiz')}: ${active.name}` : ''}
        footer={<><Btn variant="ghost" onClick={() => setActive(null)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="upload">{t('submitQuiz')}</Btn></>}
      >
        <Field label={t('answerText')} error={errors?.answer_text?.[0]}>
          <textarea className="textarea" rows={5} value={form.answer_text} onChange={(e) => setForm({ ...form, answer_text: e.target.value })} placeholder={t('answerTextPh')} />
        </Field>
        <Field label={t('attachFile')} error={errors?.file?.[0]}>
          <input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
        </Field>
      </Modal>
    </>
  )
}
