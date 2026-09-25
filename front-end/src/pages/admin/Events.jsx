import { useState } from 'react'
import { request } from '../../lib/api'
import { Btn, Field, Pager, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, useFieldErrors, useList } from './_shared'
export function AdminEvents() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/event/get/all', page)
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
      toast.success('Event saved and shared with students.')
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
    if (!window.confirm(`Delete event "${row.title}"?`)) return
    try {
      await request(`/api/event/delete/${row.id}`, { method: 'DELETE' })
      toast.success('Event deleted.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker="Campus life" title="Events" sub="Publish events that are broadcast to every student instantly." actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm({ title: '', content: '', image: null }); setOpen(true) }}>New event</Btn>} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'title', label: 'Event', main: true },
          { key: 'content', label: 'Details', render: (r) => <span style={{ display: 'inline-block', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</span> },
          { key: 'created_by', label: 'Published by', render: (r) => r.created_by || 'â€”' },
          { key: 'created_at', label: 'Date', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'â€”') },
        ]}
        onEdit={(row) => { setEditId(row.id); setForm({ title: row.title || '', content: row.content || '', image: null }); setOpen(true) }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit event' : 'New event'} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <Field label="Title" error={errors?.title?.[0]}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Content" error={errors?.content?.[0]}><textarea className="textarea" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        <Field label={editId ? 'Replace image (optional)' : 'Image'} error={errors?.image?.[0]}>
          <input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
        </Field>
      </FormModal>
    </>
  )
}
