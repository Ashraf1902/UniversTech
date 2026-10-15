import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'
export function ProfessorQuizzes() {
  const { t } = useI18n()
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
        <Empty icon="award" title={t('selectCourse')} />
      ) : quizzes.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.items.map((q, i) => (
              <Reveal key={q.id} className="card" delay={i * 0.04} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6' }}><I name="award" size={18} /></span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{q.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                    {q.due_at ? t('due', { date: new Date(q.due_at).toLocaleDateString() }) : t('noDueDate')} · {t('maxScoreLabel', { n: q.max_score })}
                  </div>
                </div>
                <Badge tone="cy">{t('submissions')}: {q.submissions_count ?? 0}</Badge>
                <Btn size="sm" variant="soft" icon="users" onClick={() => openSubmissions(q)}>{t('submissions')}</Btn>
                <a href={q.content} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn></a>
                <Btn size="sm" variant="danger" icon="trash" onClick={() => remove(q.id)} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {subPaged.items.map((s) => {
              const values = gradeForm[s.id] || { score: s.score ?? '', feedback: s.feedback ?? '' }
              return (
                <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="av" style={{ width: 36, height: 36 }}><I name="user" size={16} /></span>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 600 }}>{s.student?.name || t('studentLabel')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--faint)' }}>
                        {t('submittedAtLabel')}: {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}
                      </div>
                    </div>
                    {s.graded_at ? <Badge tone="grn">{t('quizGraded')}</Badge> : <Badge tone="amb" dot>{t('quizNotSubmitted')}</Badge>}
                    {s.file ? <a href={s.file} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn></a> : null}
                  </div>
                  {s.answer_text ? <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{s.answer_text}</div> : null}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label={t('scoreOutOf', { n: subQuiz?.max_score })}>
                      <input className="input" type="number" min="0" max={subQuiz?.max_score} step="0.5" value={values.score}
                        onChange={(e) => setGradeForm({ ...gradeForm, [s.id]: { ...values, score: e.target.value } })} />
                    </Field>
                    <Field label={t('feedbackLabel')}>
                      <input className="input" value={values.feedback || ''} placeholder={t('feedbackPh')}
                        onChange={(e) => setGradeForm({ ...gradeForm, [s.id]: { ...values, feedback: e.target.value } })} />
                    </Field>
                    <Btn size="sm" icon="check" loading={gradeBusy === s.id} onClick={() => grade(s)}>{t('gradeAction')}</Btn>
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
