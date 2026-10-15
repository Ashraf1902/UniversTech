import { useState } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { Badge, useToast } from '../../lib/ui'
import { DataTable, FormModal, Head, SearchBar, useDebounced, useFieldErrors, useList, withSearch } from './_shared'

export function AdminAnnouncements() {
  const { t } = useI18n()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const { paged, loading, run } = useList(withSearch('/api/announcement/get/all', search), page, [search])
  const [preview, setPreview] = useState(null)
  const { clear: clearErrors } = useFieldErrors()

  const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteAnnouncement', { title: row.title }))) return
    try {
      await request(`/api/announcement/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('announcementDeleted'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head kicker={t('course')} title={t('announcements')} sub={t('aAnnouncementsSub')} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('searchAnnouncementsPh')} style={{ marginBottom: 22, maxWidth: 420 }} />

      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'title', label: t('title'), main: true },
          { key: 'course_name', label: t('course'), render: (r) => r.course_name || '—' },
          { key: 'author', label: t('author'), render: (r) => (r.author ? <Badge tone="cy">{r.author_type === 'admin' ? t('roleAdmin') : t('profPrefix')} {r.author}</Badge> : '—') },
          { key: 'body', label: t('body'), render: (r) => <span style={{ display: 'inline-block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</span> },
          { key: 'created_at', label: t('date'), render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
        ]}
        onEdit={(row) => { clearErrors(); setPreview(row) }}
        onDelete={remove}
      />

      <FormModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title || ''}
        onSubmit={() => setPreview(null)}
        submitLabel={t('close')}
        errors={{}}
        onFormClose={clearErrors}
      >
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--faint)', marginBottom: 8 }}>
            {preview?.course_name} {preview?.course_code ? `· ${preview.course_code}` : ''} · {preview?.author || '—'}
          </div>
          <p style={{ whiteSpace: 'pre-line', color: 'var(--muted)', fontSize: '0.9rem' }}>{preview?.body}</p>
        </div>
        {preview?.attachment ? (
          <a href={preview.attachment} target="_blank" rel="noreferrer" className="badge amb">{t('openAttachment')}</a>
        ) : null}
      </FormModal>
    </>
  )
}
