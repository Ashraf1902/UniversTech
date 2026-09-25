import { useMemo } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Btn, CourseLoader, Empty, Modal } from '../../lib/ui'
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

export function DataTable({ columns, rows, loading, onEdit, onDelete, onRestore, onPurge, empty }) {
  if (loading) return <CourseLoader label="Loading records…" />
  if (!rows.length) return empty || <Empty icon="info" title="No records yet" />
  const hasActions = onEdit || onDelete || onRestore || onPurge
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>
            ))}
            {hasActions ? <th style={{ textAlign: 'right' }}>Actions</th> : null}
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
                    {onRestore ? <Btn size="sm" variant="soft" icon="refresh" title="Restore" onClick={() => onRestore(row)} /> : null}
                    {onPurge ? <Btn size="sm" variant="danger" icon="x" title="Delete permanently" onClick={() => onPurge(row)} /> : null}
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

export function FormModal({ open, onClose, title, children, onSubmit, busy, submitLabel = 'Save' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={busy} onClick={onSubmit} icon="check">{submitLabel}</Btn>
        </>
      }
    >
      {children}
    </Modal>
  )
}
