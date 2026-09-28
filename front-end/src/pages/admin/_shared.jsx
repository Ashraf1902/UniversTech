import { useEffect, useMemo, useState } from 'react'
import { getFieldErrors, normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { useI18n } from '../../lib/i18n'
import { Btn, CourseLoader, Empty, I, Modal } from '../../lib/ui'
export function Head({ kicker, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {sub ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function useList(path, page = 1, deps = []) {
  const a = useAsync(() => request(`${path}${path.includes('?') ? '&' : '?'}page=${page}`), [path, page, ...deps])
  return { ...a, paged: normalizePage(a.data) }
}

export function useOptions(path, map) {
  const { data } = useAsync(() => request(path))
  const items = normalizePage(data).items
  return useMemo(() => items.map(map), [data]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useFieldErrors() {
  const [errors, setErrors] = useState({})
  const clear = () => setErrors({})
  const apply = (err) => {
    const fe = getFieldErrors(err)
    if (fe && Object.keys(fe).length) {
      setErrors(fe)
      return true
    }
    return false
  }
  return { errors, setErrors, clear, apply }
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function withSearch(path, search) {
  if (!search) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}search=${encodeURIComponent(search)}`
}

export function SearchBar({ value, onChange, placeholder, style }) {
  const { t } = useI18n()
  const ph = placeholder || t('search')
  return (
    <div className="search-bar" style={style}>
      <I name="search" size={16} className="search-bar-icon" />
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        aria-label={ph}
      />
      {value ? (
        <button type="button" className="search-bar-clear" onClick={() => onChange('')} aria-label={t('clearSearch')}>
          <I name="x" size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function DataTable({ columns, rows, loading, onEdit, onDelete, onRestore, onPurge, empty }) {
  const { t } = useI18n()
  if (loading) return <CourseLoader label={t('loadingRecords')} />
  if (!rows.length) return empty || <Empty icon="info" title={t('noRecordsYet')} />
  const hasActions = onEdit || onDelete || onRestore || onPurge
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>
            ))}
            {hasActions ? <th style={{ textAlign: 'right' }}>{t('actions')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id ?? ri}>
              {columns.map((c) => (
                <td key={c.key} style={c.align ? { textAlign: c.align } : undefined} className={c.main ? 'cell-main' : undefined}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              {hasActions ? (
                <td>
                  <div className="row-actions">
                    {onEdit ? <Btn size="sm" variant="soft" icon="edit" onClick={() => onEdit(row)} /> : null}
                    {onDelete ? <Btn size="sm" variant="danger" icon="trash" onClick={() => onDelete(row)} /> : null}
                    {onRestore ? <Btn size="sm" variant="soft" icon="refresh" title={t('restore')} onClick={() => onRestore(row)} /> : null}
                    {onPurge ? <Btn size="sm" variant="danger" icon="x" title={t('deletePermanently')} onClick={() => onPurge(row)} /> : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FormModal({ open, onClose, title, children, onSubmit, busy, submitLabel, errors, onFormClose }) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      onClose={() => {
        onFormClose?.()
        onClose()
      }}
      title={title}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
          <Btn loading={busy} onClick={onSubmit} icon="check">{submitLabel ?? t('save')}</Btn>
        </>
      }
    >
      {errors && Object.keys(errors).length ? (
        <div className="form-alert" role="alert">
          {t('fixFieldsBelow')}
        </div>
      ) : null}
      {children}
    </Modal>
  )
}
