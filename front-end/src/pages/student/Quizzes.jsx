import { useState } from 'react'
import { Link } from 'react-router-dom'
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

      <Reveal className="card std-note">
        <span className="std-note-icon">
          <I name="lock" size={18} />
        </span>
        <div>
          <strong>{t('myQuizzes')}</strong>
          <p>{t('quizzesNote')}</p>
        </div>
      </Reveal>

      {quizzes.loading ? (
        <Spinner size={24} />
      ) : quizzes.error?.status === 403 ? (
        <Reveal className="card">
          <Empty
            icon="wallet"
            title={t('unlockCourses')}
            sub={t('courseLockedSub')}
            action={
              <Link to="/app/student/payments">
                <Btn variant="soft" icon="wallet">{t('viewPayments')}</Btn>
              </Link>
            }
          />
        </Reveal>
      ) : paged.items.length ? (
        <>
          <div className="std-quiz-list">
            {paged.items.map((q, i) => {
              const meta = STATUS[q.status] || STATUS.not_submitted
              const score = q.submission?.score
              return (
                <Reveal key={q.id} className="card std-quiz" delay={i * 0.04}>
                  <div className="std-quiz-main">
                    <span className={`std-quiz-icon tone-${meta.tone}`}>
                      <I name="award" size={20} />
                    </span>
                    <div className="std-quiz-id">
                      <h3>{q.name}</h3>
                      <div className="std-quiz-meta">
                        <span><I name="book" size={13} />{q.course?.course_name || '—'}</span>
                        <span><I name="clock" size={13} />{q.due_at ? t('due', { date: new Date(q.due_at).toLocaleDateString() }) : t('noDueDate')}</span>
                        <span><I name="award" size={13} />{t('maxScoreLabel', { n: q.max_score })}</span>
                      </div>
                    </div>
                    <div className="std-quiz-side">
                      <Badge tone={meta.tone} dot>{t(meta.key)}</Badge>
                      {score != null ? <Badge tone="grn">{score}/{q.max_score}</Badge> : null}
                    </div>
                  </div>

                  <div className="std-quiz-actions">
                    <a href={q.content} target="_blank" rel="noreferrer">
                      <Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn>
                    </a>
                    {q.can_submit ? (
                      <Btn size="sm" icon="upload" onClick={() => openSubmit(q)}>
                        {q.submission ? t('resubmit') : t('submitQuiz')}
                      </Btn>
                    ) : null}
                  </div>

                  {q.blocked_reason === 'deadline_passed' ? (
                    <div className="form-alert" role="status">{t('quizDeadlinePassed')}</div>
                  ) : null}
                  {q.blocked_reason === 'already_submitted' ? (
                    <div className="std-card-sub">{t('quizAlreadySubmitted')}</div>
                  ) : null}

                  {q.submission ? (
                    <div className="std-submission">
                      <div>
                        <strong>{t('yourSubmission')}:</strong>{' '}
                        {q.submission.submitted_at ? new Date(q.submission.submitted_at).toLocaleString() : '—'}
                      </div>
                      {q.submission.answer_text ? <p>{q.submission.answer_text}</p> : null}
                      {q.submission.download_url ? (
                        <div className="std-submission-file">
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
                            <span className="std-card-sub">{q.submission.original_name}</span>
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
        footer={
          <>
            <Btn variant="ghost" onClick={() => setActive(null)}>{t('cancel')}</Btn>
            <Btn loading={busy} onClick={submit} icon="upload">{t('submitQuiz')}</Btn>
          </>
        }
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
