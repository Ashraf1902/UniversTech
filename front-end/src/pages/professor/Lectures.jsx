import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function ProfessorLectures() {
  const { t, lang } = useI18n()
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
  const activeCourse = courses.find((course) => course.id === courseId)

  const submit = async () => {
    if (!form.name || !form.pdf) {
      setErrors({ name: !form.name ? [t('lectureNameRequired')] : [], pdf: !form.pdf ? [t('choosePdf')] : [] })
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('course_id', courseId)
      fd.append('name', form.name)
      fd.append('pdf', form.pdf)
      await request('/api/lecture/store', { method: 'POST', formData: fd })
      toast.success(t('lectureUploaded'))
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
        kicker={t('content')}
        title={t('lectures')}
        sub={t('lecturesSub')}
        actions={<Btn icon="upload" onClick={() => setOpen(true)} disabled={!courseId}>{t('uploadLecture')}</Btn>}
      />
      <div className="card" style={{ marginBottom: 22, maxWidth: 520 }}>
        <CourseSelect courses={courses} value={courseId} onChange={(id) => setParams(id ? { course: String(id) } : {})} loading={cLoading} />
      </div>

      {!courseId ? (
        <Empty icon="file" title={t('selectCourse')} sub={t('chooseCourseSub')} />
      ) : lectures.loading ? (
        <Spinner size={24} />
      ) : list.length ? (
        <Reveal className="card">
          <div className="card-head">
            <div>
              <h3>{activeCourse?.course_name || t('lectures')}</h3>
              <span className="home-card-sub">{t('lecturesCount', { n: list.length })}</span>
            </div>
            {activeCourse?.course_code ? <Badge tone="cy">{activeCourse.course_code}</Badge> : null}
          </div>

          <ol className="std-lectures">
            {list.map((lecture, index) => (
              <li key={lecture.id} className="std-lecture">
                <span className="std-lecture-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="std-lecture-body">
                  <strong>{lecture.name}</strong>
                  <span>
                    <I name="clock" size={12} />{' '}
                    {lecture.created_at
                      ? new Date(lecture.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                </div>
                <a href={lecture.path} target="_blank" rel="noreferrer">
                  <Btn size="sm" variant="soft" icon="play">{t('openAction')}</Btn>
                </a>
              </li>
            ))}
          </ol>
        </Reveal>
      ) : (
        <Empty icon="file" title={t('noLectures')} sub={t('uploadFirstLecture')} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('uploadLecture')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="upload">{t('upload')}</Btn></>}
      >
        <Field label={t('lectureName')} error={errors?.name?.[0]}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('lectureNamePh')} /></Field>
        <Field label={t('pdfFile')} error={errors?.pdf?.[0]}><input className="input" type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })} /></Field>
      </Modal>
    </>
  )
}
