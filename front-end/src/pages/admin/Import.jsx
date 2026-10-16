import { useState } from 'react'
import { downloadFile, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Badge, Btn, Empty, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, Head } from './_shared'

const TYPES = ['students', 'courses']
const SCOPE = { students: 'accounts', courses: 'courses' }

function saveCsv(rows, filename) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const content = '\uFEFF' + rows.map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function AdminImport() {
  const { t } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const roles = user?.roles || []
  const isSuper = Boolean(user?.is_super_admin)
  const tabs = TYPES.filter((type) => isSuper || roles.includes(SCOPE[type]))
  const available = tabs.length ? tabs : TYPES
  const [tab, setTab] = useState(available[0])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(null)

  const reset = (next) => {
    setTab(next)
    setFile(null)
    setPreview(null)
    setResult(null)
    setBusy(null)
  }

  const doPreview = async () => {
    if (!file) {
      toast.error(t('selectFileFirst'))
      return
    }
    setBusy('preview')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await request(`/api/import/${tab}/preview`, { method: 'POST', formData: fd })
      setPreview(res)
      setResult(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const doApply = async () => {
    if (!file) {
      toast.error(t('selectFileFirst'))
      return
    }
    setBusy('apply')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await request(`/api/import/${tab}/apply`, { method: 'POST', formData: fd })
      setResult(res)
      toast.success(t('importComplete'))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const downloadErrors = () => {
    if (!result?.errors?.length) return
    const rows = [[t('rowNumber'), t('errors')], ...result.errors.map((e) => [e.row, (e.errors || []).join(' | ')])]
    saveCsv(rows, `import-${tab}-errors.csv`)
  }

  const columns = [
    { key: 'row', label: t('rowNumber') },
    {
      key: 'valid',
      label: t('status'),
      render: (r) => (r.valid ? <Badge tone="grn" dot>{t('rowValid')}</Badge> : <Badge tone="red" dot>{t('rowInvalid')}</Badge>),
    },
    {
      key: 'data',
      label: t('details'),
      main: true,
      render: (r) =>
        tab === 'students'
          ? `${r.data?.name ?? ''} · ${r.data?.email ?? ''}`
          : `${r.data?.course_name ?? ''} · ${r.data?.course_code ?? ''}`,
    },
    {
      key: 'errors',
      label: t('errors'),
      render: (r) => (r.errors?.length ? <span style={{ color: 'var(--red, #ff5d7a)' }}>{r.errors.join('; ')}</span> : '—'),
    },
  ]

  return (
    <>
      <Head
        kicker={t('academics')}
        title={t('bulkImport')}
        sub={t('bulkImportSub')}
        actions={
          <Btn variant="soft" icon="download" onClick={() => downloadFile(`/api/import/${tab}/template`, `import-${tab}-template.csv`)}>
            {t('downloadTemplate')}
          </Btn>
        }
      />

      <div className="seg" style={{ marginBottom: 22, maxWidth: 340 }}>
        {available.map((type) => (
          <button key={type} className={tab === type ? 'on' : ''} onClick={() => reset(type)}>
            {type === 'students' ? t('importStudents') : t('importCourses')}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <p style={{ color: 'var(--muted)', marginBottom: 14 }}>
          {tab === 'students' ? t('importStudentsHint') : t('importCoursesHint')}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setPreview(null)
              setResult(null)
            }}
          />
          <Btn variant="soft" icon="search" loading={busy === 'preview'} onClick={doPreview}>
            {t('previewImport')}
          </Btn>
          <Btn icon="upload" loading={busy === 'apply'} disabled={!preview} onClick={doApply}>
            {t('confirmImport')}
          </Btn>
        </div>
      </div>

      {preview ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-head">
            <h3>{t('importPreview')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge>{t('totalRows')}: {preview.summary?.total ?? 0}</Badge>
              <Badge tone="grn">{t('validRows')}: {preview.summary?.valid ?? 0}</Badge>
              <Badge tone="red">{t('invalidRows')}: {preview.summary?.invalid ?? 0}</Badge>
            </div>
          </div>
          <DataTable rows={preview.rows || []} columns={columns} />
        </div>
      ) : null}

      {result ? (
        <div className="card">
          <div className="card-head">
            <h3>{t('importResult')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="grn">{t('importedCount')}: {result.imported}</Badge>
              <Badge tone="amb">{t('skippedCount')}: {result.skipped}</Badge>
              {result.errors?.length ? (
                <Btn size="sm" variant="soft" icon="download" onClick={downloadErrors}>
                  {t('downloadErrors')}
                </Btn>
              ) : null}
            </div>
          </div>
          {result.errors?.length ? (
            <DataTable
              rows={result.errors.map((e, i) => ({ id: i, row: e.row, errors: (e.errors || []).join('; ') }))}
              columns={[
                { key: 'row', label: t('rowNumber') },
                { key: 'errors', label: t('errors'), render: (r) => <span style={{ color: 'var(--red, #ff5d7a)' }}>{r.errors}</span> },
              ]}
            />
          ) : (
            <Empty icon="check" title={t('importAllRows')} />
          )}
        </div>
      ) : null}
    </>
  )
}
