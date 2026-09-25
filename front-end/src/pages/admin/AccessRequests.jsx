import { useState } from 'react'
import { buildQuery, request } from '../../lib/api'
import { Badge, Btn, Empty, I, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { Head, useList } from './_shared'
export function AdminAccessRequests() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const toast = useToast()
  const path = `/api/access-request/get/all${buildQuery({ status })}`
  const { paged, loading, run } = useList(path, page, [status])
  const [busyId, setBusyId] = useState(null)

  const respond = async (row, action) => {
    if (!window.confirm(action === 'accept' ? `Accept ${row.name}'s request and create their account?` : `Refuse ${row.name}'s request?`)) return
    setBusyId(action === 'accept' ? `a-${row.id}` : `r-${row.id}`)
    try {
      await request('/api/access-request/respond', { method: 'POST', data: { id: row.id, action } })
      toast.success(action === 'accept' ? 'Request accepted. Account created.' : 'Request refused.')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const tone = { pending: 'amb', accepted: 'grn', refused: 'red' }

  return (
    <>
      <Head
        kicker="Onboarding"
        title="Access Requests"
        sub="Students who applied for access. Accepting creates their account — refusing closes the request."
      />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 460 }}>
        {[['pending', 'Pending'], ['accepted', 'Accepted'], ['refused', 'Refused']].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1) }}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner size={24} /> : !paged.items.length ? (
        <Empty icon="mail" title="Nothing here" sub="No requests in this list yet." />
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          {paged.items.map((row) => (
            <Reveal key={row.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span className="av" style={{ width: 48, height: 48, borderRadius: 15, background: 'var(--grad)', fontSize: '0.85rem' }}>
                  {String(row.name || '?').split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('') || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{row.email}</div>
                </div>
                <Badge tone={tone[row.status] || ''} dot>{row.status}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0 16px' }}>
                <Badge tone="vio">{row.level || '—'}</Badge>
                <Badge tone="cy">{row.department || 'General'}</Badge>
                <Badge>{row.gender || '—'}</Badge>
                {row.national_id ? <Badge>{row.national_id}</Badge> : null}
                {row.phone ? <Badge>{row.phone}</Badge> : null}
              </div>
              {row.decided_by
                ? <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>Decided by {row.decided_by}</div>
                : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn size="sm" variant="ghost" loading={busyId === `a-${row.id}`} onClick={() => respond(row, 'accept')}><I name="check" size={16} /> Accept</Btn>
                    <Btn size="sm" variant="danger" loading={busyId === `r-${row.id}`} onClick={() => respond(row, 'refuse')}><I name="x" size={16} /> Refuse</Btn>
                  </div>
                )}
            </Reveal>
          ))}
        </div>
      )}
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
    </>
  )
}
