import { useState } from 'react'
import { request } from '../../lib/api'
import { Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, withSearch } from './_shared'
export function AdminEvents() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { paged, loading, run } = useList(withSearch('/api/event/get/all', search), page, [search])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const submit = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (editId) fd.append('event_id', editId)
      fd.append('title', form.title)
      fd.append('content', form.content)
      if (form.image) fd.append('image', form.image)
      await request(editId ? '/api/event/update' : '/api/event/store', { method: 'POST', formData: fd })
      toast.success(t('eventSaved'))
      setOpen(false)
      clearErrors()
      run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteEvent', { title: row.title }))) return
    try {
      await request(`/api/event/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('eventDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
<Head kicker={t('campusLife')} title={t('events')} sub={t('eventsSub')} actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ title: '', content: '', image: null }); setOpen(true) }}>{t('newEvent')}</Btn>} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchEventsPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'title', label: t('event'), main: true },
          { key: 'content', label: t('details'), render: (r) => <span style={{ display: 'inline-block', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</span> },
          { key: 'created_by', label: t('publishedBy'), render: (r) => r.created_by || '—' },
          { key: 'created_at', label: t('date'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ title: row.title || '', content: row.content || '', image: null }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editEvent') : t('newEvent')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <Field label={t('title')} error={errors?.title?.[0]}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label={t('content')} error={errors?.content?.[0]}><textarea className="textarea" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        <Field label={editId ? t('replaceImageOptional') : t('image')} error={errors?.image?.[0]}>
          <input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
        </Field>
      </FormModal>
    </>
  )
}
