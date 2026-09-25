import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Btn, Empty, Field, I, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useMyCourses } from './_shared'
export function ProfessorQuizzes() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const [page, setPage] = useState(1)
  const toast = useToast()
  const quizzes = useAsync(() => (courseId ? request(`/api/quiz/get/all/${courseId}?page=${page}`) : Promise.resolve(null)), [courseId, page])
  const paged = normalizePage(quizzes.data)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', due_at: '', pdf: null })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.name || !form.pdf) return toast.error('Name and PDF are required.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      if (form.due_at) fd.append('due_at', form.due_at)
      fd.append('pdf', form.pdf)
      await request('/api/quiz/store', { method: 'POST', formData: fd })
      toast.success('Quiz uploaded.')
      setOpen(false)
      setForm({ name: '', due_at: '', pdf: null })
      quizzes.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      await request(`/api/quiz/delete/${id}`, { method: 'DELETE' })
      toast.success('Quiz deleted.')
      quizzes.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker="Assessment"
        title="Quizzes"
        sub="Publish quizzes with due dates and manage existing ones."
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>Upload quiz</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => { setParams(id ? { course: String(id) } : {}); setPage(1) }} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="award" title="Select a course" />
      ) : quizzes.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.items.map((q, i) => (
              <Reveal key={q.id} className="card" delay={i * 0.04} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6' }}><I name="award" size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{q.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{q.due_at ? `Due ${new Date(q.due_at).toLocaleDateString()}` : 'No due date'}</div>
                </div>
                <a href={q.content} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="file">Open</Btn></a>
                <Btn size="sm" variant="danger" icon="trash" onClick={() => remove(q.id)} />
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="award" title="No quizzes yet" sub="Upload the first quiz for this course." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload quiz"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={submit} icon="upload">Upload</Btn></>}
      >
        <Field label="Quiz name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Midterm Quiz" /></Field>
        <Field label="Due date (optional)"><input className="input" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field>
        <Field label="PDF file"><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>
    </>
  )
}
