import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Empty, I, Pager, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'
export function StudentNotifications() {
  const [tab, setTab] = useState('notifications')
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/user/notifications/${tab === 'notifications' ? '' : tab}?page=${page}`.replace('/?', '?')), [tab, page])
  const paged = normalizePage(data)

  const tabs = [
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'events', label: 'Events', icon: 'spark' },
    { key: 'announcments', label: 'Announcements', icon: 'info' },
  ]

  return (
    <>
      <Head kicker="Inbox" title="Notifications" sub="Course updates, events, and announcements — all in one place." />
      <div className="seg" style={{ marginBottom: 22, maxWidth: 520 }}>
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => { setTab(t.key); setPage(1) }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paged.items.map((n, i) => (
              <Reveal key={n.id} className="card" delay={i * 0.04} style={{ display: 'flex', gap: 16 }}>
                <span className="av" style={{ width: 46, height: 46, background: n.type === 'event' ? 'linear-gradient(135deg,#ffce66,#f563b0)' : 'var(--grad)' }}>
                  <I name={n.type === 'event' ? 'spark' : 'bell'} size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{n.title}</h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>{n.created_at}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 8, whiteSpace: 'pre-line' }}>{n.content}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {n.professor ? <Badge tone="cy">Prof. {n.professor}</Badge> : null}
                    {n.admin ? <Badge tone="vio">{n.admin}</Badge> : null}
                    {n.image_path ? <a href={n.image_path} target="_blank" rel="noreferrer" className="badge amb">Attachment</a> : null}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="bell" title="Nothing here" sub="You have no items in this inbox yet." />
      )}
    </>
  )
}
