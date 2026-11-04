import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Empty, I, Pager, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'

export function ProfessorNotifications() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/professor/notifications?page=${page}`), [page])
  const paged = normalizePage(data)

  return (
    <>
      <Head kicker={t('inbox')} title={t('notifications')} sub={t('notificationsSub')} />

      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="std-dispatch">
            {paged.items.map((note, index) => (
              <Reveal
                key={note.id}
                className={`std-dispatch-item ${note.type === 'event' ? 'is-event' : ''}`}
                delay={index * 0.04}
              >
                <span className="std-dispatch-icon">
                  <I name={note.type === 'event' ? 'spark' : 'bell'} size={18} />
                </span>
                <div className="std-dispatch-body">
                  <div className="std-dispatch-head">
                    <h3>{note.title}</h3>
                    <span>{note.created_at}</span>
                  </div>

                  <div className="std-chips">
                    {note.type === 'event' ? <Badge tone="cy">{t('events')}</Badge> : <Badge>{t('notifications')}</Badge>}
                    {note.course_name ? <Badge tone="vio">{note.course_name}</Badge> : null}
                    {note.professor ? <Badge>{note.professor}</Badge> : null}
                    {note.admin ? <Badge>{note.admin}</Badge> : null}
                  </div>

                  <p>{note.content}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="bell" title={t('noNotifications')} sub={t('noNotificationsSub')} />
      )}
    </>
  )
}
