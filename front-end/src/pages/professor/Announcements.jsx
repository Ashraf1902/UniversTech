import { useState } from 'react'
import { assetUrl, buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { CourseSelect, Head, useFieldErrors, useMyCourses } from './_shared'

export function ProfessorAnnouncements() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const { courses, loading: cLoading } = useMyCourses()
  const [courseId, setCourseId] = useState('')
  const [page, setPage] = useState(1)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const list = useAsync(
    () => request('/api/professor/announcement/get/all' + buildQuery({ course_id: courseId || undefined, page })),
    [courseId, page],
  )
  const paged = normalizePage(list.data)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ course_id: '', title: '', body: '', attachment: null })
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setEditId(null)
    setForm({ course_id: courseId || '', title: '', body: '', attachment: null })
    clearErrors()
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditId(row.id)
    setForm({ course_id: row.course_id || '', title: row.title || '', body: row.body || '', attachment: null })
    clearErrors()
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (editId) fd.append('announcement_id', editId)
      else fd.append('course_id', form.course_id)
      fd.append('title', form.title)
      fd.append('body', form.body)
      if (form.attachment) fd.append('attachment', form.attachment)
      await request(editId ? '/api/professor/announcement/update' : '/api/professor/announcement/store', {
        method: 'POST',
        formData: fd,
      })
      toast.success(editId ? t('announcementUpdated') : t('announcementPosted'))
      setOpen(false)
      clearErrors()
      list.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteAnnouncement', { title: row.title }))) return
    try {
      await request(`/api/professor/announcement/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('announcementDeleted'))
      list.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker={t('course')}
        title={t('announcements')}
        sub={t('pAnnouncementsSub')}
        actions={<Btn icon="plus" onClick={openCreate}>{t('newAnnouncement')}</Btn>}
      />

      <div className="card" style={{ marginBottom: 22, maxWidth: 760 }}>
        <div className="grid grid-2">
          <CourseSelect
            courses={courses}
            value={courseId}
            onChange={(id) => { setCourseId(id || ''); setPage(1) }}
            loading={cLoading}
          />
        </div>
      </div>

      {list.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="std-dispatch">
            {paged.items.map((row, index) => (
              <Reveal key={row.id} className="std-dispatch-item" delay={index * 0.04}>
                <span className="std-dispatch-icon">
                  <I name="info" size={18} />
                </span>
                <div className="std-dispatch-body">
                  <div className="std-dispatch-head">
                    <h3>{row.title}</h3>
                    <span>
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>

                  <div className="std-chips">
                    {row.course_name ? (
                      <Badge tone="cy">{row.course_name}</Badge>
                    ) : null}
                    {row.course_code ? (
                      <Badge>{row.course_code}</Badge>
                    ) : null}
                    {row.attachment ? (
                      <a href={assetUrl(row.attachment)} target="_blank" rel="noreferrer">
                        <Badge tone="amb"><I name="file" size={12} /> {t('openAttachment')}</Badge>
                      </a>
                    ) : (
                      <Badge>{t('none')}</Badge>
                    )}
                  </div>

                  <p>{row.body}</p>

                  <div className="prof-dispatch-actions">
                    <Btn size="sm" variant="soft" icon="edit" title={t('edit')} onClick={() => openEdit(row)} />
                    <Btn size="sm" variant="danger" icon="trash" title={t('delete')} onClick={() => remove(row)} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="info" title={t('noAnnouncements')} sub={t('noAnnouncementsSub')} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? t('editAnnouncement') : t('newAnnouncement')}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn>
            <Btn loading={busy} onClick={submit} icon="check" disabled={!form.title || !form.body || (!editId && !form.course_id)}>{t('publish')}</Btn>
          </>
        }
      >
        {editId ? (
          <div className="prof-appeal-context">
            <strong>{form.title}</strong>
          </div>
        ) : (
          <CourseSelect courses={courses} value={form.course_id} onChange={(id) => setForm({ ...form, course_id: id })} loading={cLoading} />
        )}
        <Field label={t('title')} error={errors?.title?.[0]}>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label={t('body')} error={errors?.body?.[0]}>
          <textarea className="textarea" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label={editId ? t('replaceAttachmentOptional') : t('attachment')} error={errors?.attachment?.[0]}>
          <input
            className="input"
            type="file"
            onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] || null })}
          />
        </Field>
      </Modal>
    </>
  )
}
