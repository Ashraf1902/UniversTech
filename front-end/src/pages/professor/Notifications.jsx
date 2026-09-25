import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Empty, I, Pager, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'
export function ProfessorNotifications() {
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/professor/notifications?page=${page}`), [page])
  const paged = normalizePage(data)

  return (
    <>
      <Head kicker="Inbox" title="Notifications" sub="Everything the platform has sent your way." />
      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paged.items.map((n, i) => (
              <Reveal key={n.id} className="card" delay={i * 0.04} style={{ display: 'flex', gap: 16 }}>
                <span className="av" style={{ width: 46, height: 46, background: 'var(--grad)' }}><I name="bell" size={20} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{n.title}</h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{n.created_at}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 8, whiteSpace: 'pre-line' }}>{n.content}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="bell" title="No notifications" />
      )}
    </>
  )
}
