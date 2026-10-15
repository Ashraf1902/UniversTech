import { useState } from 'react'
import { request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Field, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, withSearch } from './_shared'

function MultiSelect({ options, value, onChange }) {
  const { t } = useI18n()
  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div
      style={{
        maxHeight: 168,
        overflowY: 'auto',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {options.length ? (
        options.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
            <span style={{ fontSize: '0.85rem' }}>{o.name}</span>
          </label>
        ))
      ) : (
        <span style={{ fontSize: '0.8rem', color: 'var(--faint)', padding: '6px 8px' }}>{t('noRecordsYet')}</span>
      )}
    </div>
  )
}

export function AdminEvents() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const toast = useToast()
  const { paged, loading, run } = useList(withSearch('/api/event/get/all', search), page, [search])
  const { data: meta } = useAsync(() => request('/api/public/meta'))
  const departments = meta?.departments || []
  const levels = meta?.levels || []
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', image: null, audience: 'all', departments: [], levels: [] })
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const emptyForm = { title: '', content: '', image: null, audience: 'all', departments: [], levels: [] }

  const submit = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (editId) fd.append('event_id', editId)
      fd.append('title', form.title)
      fd.append('content', form.content)
      fd.append('audience', form.audience)
      if (form.audience === 'targeted') {
        form.departments.forEach((id) => fd.append('departments[]', id))
        form.levels.forEach((id) => fd.append('levels[]', id))
      }
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
<Head kicker={t('campusLife')} title={t('events')} sub={t('eventsSub')} actions={<Btn icon="plus" onClick={() => { setEditId(null); setForm(emptyForm); clearErrors(); setOpen(true) }}>{t('newEvent')}</Btn>} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchEventsPh')} style={{ marginBottom: 22, maxWidth: 420 }} />
      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'title', label: t('eventItem'), main: true },
          { key: 'content', label: t('details'), render: (r) => <span style={{ display: 'inline-block', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</span> },
          { key: 'audience', label: t('audience'), render: (r) => (r.audience === 'targeted' ? (
            <Badge tone="amb" dot>
              {t('audienceTargeted')} · {t('targetCount', { n: (r.target_departments?.length || 0) + (r.target_levels?.length || 0) })}
            </Badge>
          ) : <Badge tone="grn" dot>{t('audienceAll')}</Badge>) },
          { key: 'created_by', label: t('publishedBy'), render: (r) => r.created_by || '—' },
          { key: 'created_at', label: t('date'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
        ]}
        onEdit={(row) => {
          setEditId(row.id)
          setForm({
            title: row.title || '',
            content: row.content || '',
            image: null,
            audience: row.audience || 'all',
            departments: (row.target_departments || []).map((d) => d.id),
            levels: (row.target_levels || []).map((l) => l.id),
          })
          clearErrors()
          setOpen(true)
        }}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
<FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editEvent') : t('newEvent')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        <Field label={t('title')} error={errors?.title?.[0]}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label={t('content')} error={errors?.content?.[0]}><textarea className="textarea" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        <Field label={t('audience')} hint={t('audienceHint')}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" name="event-audience" checked={form.audience === 'all'} onChange={() => setForm({ ...form, audience: 'all', departments: [], levels: [] })} />
              {t('audienceAll')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" name="event-audience" checked={form.audience === 'targeted'} onChange={() => setForm({ ...form, audience: 'targeted' })} />
              {t('audienceTargeted')}
            </label>
          </div>
        </Field>
        {form.audience === 'targeted' ? (
          <div className="grid grid-2">
            <Field label={t('departments')} error={errors?.departments?.[0]}>
              <MultiSelect options={departments} value={form.departments} onChange={(ids) => setForm({ ...form, departments: ids })} />
            </Field>
            <Field label={t('levels')} error={errors?.levels?.[0] || errors?.['levels.0']?.[0]}>
              <MultiSelect options={levels} value={form.levels} onChange={(ids) => setForm({ ...form, levels: ids })} />
            </Field>
          </div>
        ) : null}
        <Field label={editId ? t('replaceImageOptional') : t('image')} error={errors?.image?.[0]}>
          <input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
        </Field>
      </FormModal>
    </>
  )
}
