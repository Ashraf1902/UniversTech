import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Pager, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'

const TABS = [
  { key: 'notifications', label: 'notifications', icon: 'bell' },
  { key: 'events', label: 'events', icon: 'spark' },
  { key: 'announcments', label: 'announcements', icon: 'info' },
]

export function StudentNotifications() {
  const { t } = useI18n()
  const [tab, setTab] = useState('notifications')
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(
    () => request(`/api/user/notifications/${tab === 'notifications' ? '' : tab}?page=${page}`.replace('/?', '?')),
    [tab, page],
  )
  const paged = normalizePage(data)

  const actions = tab === 'events' ? (
    <Link to="/app/student/events">
      <Btn variant="soft" icon="spark">{t('notificationsOpenEvents')}</Btn>
    </Link>
  ) : null

  return (
    <>
      <Head kicker={t('inbox')} title={t('notifications')} sub={t('notificationsSub2')} actions={actions} />

      <div className="seg" style={{ marginBottom: 22, maxWidth: 520 }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? 'on' : ''}
            onClick={() => { setTab(item.key); setPage(1) }}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="std-dispatch">
            {paged.items.map((n, i) => (
              <Reveal
                key={n.id}
                className={`std-dispatch-item ${n.type === 'event' ? 'is-event' : ''}`}
                delay={i * 0.04}
              >
                <span className="std-dispatch-icon">
                  <I name={n.type === 'event' ? 'spark' : 'bell'} size={19} />
                </span>
                <div className="std-dispatch-body">
                  <div className="std-dispatch-head">
                    <h3>{n.title}</h3>
                    <span>{n.created_at}</span>
                  </div>
                  <p>{n.content}</p>
                  <div className="std-chips">
                    {n.category === 'announcement' && n.course_name ? (
                      <Badge tone="grn"><I name="book" size={12} /> {n.course_name}</Badge>
                    ) : null}
                    {n.professor ? <Badge tone="cy">{t('profPrefix')} {n.professor}</Badge> : null}
                    {n.admin ? <Badge tone="vio">{n.admin}</Badge> : null}
                    {n.image_path ? (
                      <a href={n.image_path} target="_blank" rel="noreferrer" className="badge amb">
                        <I name="file" size={12} /> {t('attachment')}
                      </a>
                    ) : null}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Reveal className="card">
          <Empty
            icon={tab === 'events' ? 'spark' : tab === 'announcments' ? 'info' : 'bell'}
            title={tab === 'events' ? t('noEvents') : t('nothingHere')}
            sub={tab === 'events' ? t('noEventsSub') : t('noItemsSub')}
          />
        </Reveal>
      )}
    </>
  )
}
