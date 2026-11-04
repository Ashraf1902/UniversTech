import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { downloadErrorKey, downloadFile, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function ProfessorQuizzes() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const toast = useToast()
  const quizzes = useAsync(() => (courseId ? request(`/api/quiz/get/all/${courseId}?page=${page}`) : Promise.resolve(null)), [courseId, page])
  const paged = normalizePage(quizzes.data)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', due_at: '', max_score: '', pdf: null })
  const [busy, setBusy] = useState(false)
  const { errors, setErrors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const [subQuiz, setSubQuiz] = useState(null)
  const subs = useAsync(() => (subQuiz ? request(`/api/quiz/submissions/${subQuiz.id}`) : Promise.resolve(null)), [subQuiz?.id])
  const subPaged = normalizePage(subs.data?.submissions)
  const [gradeForm, setGradeForm] = useState({})
  const [gradeBusy, setGradeBusy] = useState(null)
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

  const submit = async () => {
    if (!form.name || !form.pdf) {
      setErrors({ name: !form.name ? [t('quizNameRequired')] : [], pdf: !form.pdf ? [t('choosePdf')] : [] })
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      if (form.due_at) fd.append('due_at', form.due_at)
      if (form.max_score !== '') fd.append('max_score', form.max_score)
      fd.append('pdf', form.pdf)
      await request('/api/quiz/store', { method: 'POST', formData: fd })
      toast.success(t('quizUploaded'))
      setOpen(false)
      clearErrors()
      setForm({ name: '', due_at: '', max_score: '', pdf: null })
      quizzes.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      await request(`/api/quiz/delete/${id}`, { method: 'DELETE' })
      toast.success(t('quizDeleted'))
      quizzes.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  const openSubmissions = (quiz) => {
    setSubQuiz(quiz)
    setGradeForm({})
  }

  const grade = async (submission) => {
    const values = gradeForm[submission.id] || { score: submission.score ?? '', feedback: submission.feedback ?? '' }
    const max = subQuiz?.max_score || subs.data?.quiz?.max_score || 0
    if (values.score === '' || Number(values.score) < 0 || Number(values.score) > Number(max)) {
      toast.error(t('gradeBounded', { n: max }))
      return
    }
    setGradeBusy(submission.id)
    try {
      await request('/api/quiz/submission/grade', {
        method: 'POST',
        data: { submission_id: submission.id, score: Number(values.score), feedback: values.feedback || null },
      })
      toast.success(t('gradedOk'))
      subs.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGradeBusy(null)
    }
  }

  return (
    <>
      <Head
        kicker={t('assessment')}
        title={t('quizzes')}
        sub={t('quizzesSub')}
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>{t('uploadQuiz')}</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="award" title={t('selectCourse')} sub={t('chooseCourseSub')} />
      ) : quizzes.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="std-quiz-list">
            {paged.items.map((quiz, index) => (
              <Reveal key={quiz.id} className="card std-quiz" delay={index * 0.04}>
                <div className="std-quiz-main">
                  <span className="std-quiz-icon tone-cy">
                    <I name="award" size={20} />
                  </span>
                  <div className="std-quiz-id">
                    <h3>{quiz.name}</h3>
                    <div className="std-quiz-meta">
                      <span><I name="book" size={13} />{quiz.course_name || '—'}</span>
                      {quiz.course_code ? <Badge>{quiz.course_code}</Badge> : null}
                      <span>
                        <I name="clock" size={13} />
                        {quiz.due_at
                          ? t('due', { date: new Date(quiz.due_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' }) })
                          : t('noDueDate')}
                      </span>
                      <span><I name="award" size={13} />{t('maxScoreLabel', { n: quiz.max_score })}</span>
                    </div>
                  </div>
                  <div className="std-quiz-side">
                    <Badge tone="vio">{t('submissions')}: {quiz.submissions_count ?? 0}</Badge>
                  </div>
                </div>

                <div className="std-quiz-actions">
                  <Btn size="sm" variant="soft" icon="users" onClick={() => openSubmissions(quiz)}>{t('submissions')}</Btn>
                  <a href={quiz.content} target="_blank" rel="noreferrer">
                    <Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn>
                  </a>
                  <Btn size="sm" variant="danger" icon="trash" onClick={() => remove(quiz.id)} />
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="award" title={t('noQuizzes')} sub={t('uploadFirstQuiz')} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('uploadQuiz')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="upload">{t('upload')}</Btn></>}
      >
        <Field label={t('quizName')} error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('quizNamePh')} /></Field>
        <Field label={t('dueDateOptional')} error={errors?.due_at?.[0]}><input className="input" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field>
        <Field label={t('maxScoreField')} error={errors?.max_score?.[0]}><input className="input" type="number" min="0" step="0.5" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></Field>
        <Field label={t('pdfFile')} error={errors?.pdf?.[0]}><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>

      <Modal
        open={!!subQuiz}
        onClose={() => setSubQuiz(null)}
        title={subQuiz ? t('submissionsFor', { name: subQuiz.name }) : ''}
        size="lg"
        footer={<Btn variant="ghost" onClick={() => setSubQuiz(null)}>{t('close')}</Btn>}
      >
        {subs.loading ? (
          <Spinner size={22} />
        ) : subPaged.items.length ? (
          <div className="prof-sub-list">
            {subPaged.items.map((submission) => {
              const values = gradeForm[submission.id] || { score: submission.score ?? '', feedback: submission.feedback ?? '' }
              return (
                <div key={submission.id} className="prof-sub-card">
                  <div className="prof-sub-head">
                    <span className="prof-roster-avatar is-sm">
                      {String(submission.student?.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="prof-roster-id">
                      <strong>{submission.student?.name || t('studentLabel')}</strong>
                      <span>
                        {t('submittedAtLabel')}:{' '}
                        {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString(lang) : '—'}
                      </span>
                    </div>
                    {submission.graded_at ? <Badge tone="grn">{t('quizGraded')}</Badge> : <Badge tone="amb" dot>{t('notGraded')}</Badge>}
                    {submission.download_url ? (
                      <Btn
                        size="sm"
                        variant="soft"
                        icon="download"
                        loading={downloading === submission.id}
                        onClick={() => downloadSubmission(submission)}
                      >
                        {downloading === submission.id ? t('downloading') : t('downloadSubmission')}
                      </Btn>
                    ) : null}
                  </div>
                  {submission.answer_text ? <p className="prof-sub-answer">{submission.answer_text}</p> : null}
                  <div className="prof-sub-grade">
                    <Field label={t('scoreOutOf', { n: subQuiz?.max_score })}>
                      <input className="input" type="number" min="0" max={subQuiz?.max_score} step="0.5" value={values.score}
                        onChange={(e) => setGradeForm({ ...gradeForm, [submission.id]: { ...values, score: e.target.value } })} />
                    </Field>
                    <Field label={t('feedbackLabel')}>
                      <input className="input" value={values.feedback || ''} placeholder={t('feedbackPh')}
                        onChange={(e) => setGradeForm({ ...gradeForm, [submission.id]: { ...values, feedback: e.target.value } })} />
                    </Field>
                    <Btn size="sm" icon="check" loading={gradeBusy === submission.id} onClick={() => grade(submission)}>{t('gradeAction')}</Btn>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty icon="users" title={t('noSubmissions')} />
        )}
      </Modal>
    </>
  )
}
