import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Btn, Empty, Field, I, Modal, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'
export function ProfessorLectures() {
  const [params, setParams] = useSearchParams()
  const { courses, loading: cLoading } = useMyCourses()
  const courseId = Number(params.get('course')) || ''
  const toast = useToast()
  const lectures = useAsync(() => (courseId ? request(`/api/lecture/get/all/${courseId}`) : Promise.resolve(null)), [courseId])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', pdf: null })
  const [busy, setBusy] = useState(false)
  const { errors, setErrors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const list = Array.isArray(lectures.data) ? lectures.data : []

  const submit = async () => {
    if (!form.name || !form.pdf) {
      setErrors({ name: !form.name ? ['Lecture name is required.'] : [], pdf: !form.pdf ? ['Please choose a PDF file.'] : [] })
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      fd.append('pdf', form.pdf)
      await request('/api/lecture/store', { method: 'POST', formData: fd })
      toast.success('Lecture uploaded.')
      setOpen(false)
      clearErrors()
      setForm({ name: '', pdf: null })
      lectures.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head
        kicker="Content"
        title="Lectures"
        sub="Upload lecture material and review what students can access."
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>Upload lecture</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => setParams(id ? { course: String(id) } : {})} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="file" title="Select a course" />
      ) : lectures.loading ? (
        <Spinner size={24} />
      ) : list.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((l, i) => (
            <Reveal key={l.id} className="card" delay={i * 0.04} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="av" style={{ background: 'var(--grad)' }}><I name="file" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{new Date(l.created_at).toLocaleDateString()}</div>
              </div>
              <a href={l.path} target="_blank" rel="noreferrer"><Btn size="sm" variant="soft" icon="play">Open</Btn></a>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="file" title="No lectures uploaded" sub="Upload the first lecture for this course." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload lecture"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={submit} icon="upload">Upload</Btn></>}
      >
<Field label="Lecture name" error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Introduction to Algorithms" /></Field>
        <Field label="PDF file" error={errors?.pdf?.[0]}><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>
    </>
  )
}
