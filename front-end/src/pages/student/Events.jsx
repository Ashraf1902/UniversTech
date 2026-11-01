import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { CoverImage } from '../../lib/media'
import { Badge, Empty, I, Pager, Reveal, Spinner } from '../../lib/ui'
import { Head } from './_shared'

export function StudentEvents() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => request(`/api/user/notifications/events?page=${page}`), [page])
  const paged = normalizePage(data)
  const [featured, ...rest] = paged.items

  return (
    <>
      <Head kicker={t('campusLife')} title={t('events')} sub={t('eventsPageSub')} />

      <Reveal className="card std-note">
        <span className="std-note-icon">
          <I name="info" size={18} />
        </span>
        <div>
          <strong>{t('events')}</strong>
          <p>{t('eventsNote')}</p>
        </div>
      </Reveal>

      {loading ? (
        <Spinner size={24} />
      ) : !paged.items.length ? (
        <Reveal className="card">
          <Empty icon="spark" title={t('noEvents')} sub={t('noEventsSub')} />
        </Reveal>
      ) : (
        <>
          <Reveal className="std-feature">
            <CoverImage
              className="std-feature-cover"
              src={featured.image_path}
              alt={featured.title}
              icon="spark"
              mark={t('eventsFeatured')}
            >
              <span className="std-feature-veil" />
              <div className="std-feature-body">
                <Badge tone="amb" dot>{t('eventsFeatured')}</Badge>
                <h2>{featured.title}</h2>
                <p>{featured.content}</p>
                <div className="std-feature-meta">
                  <span><I name="clock" size={14} />{featured.created_at}</span>
                  {featured.admin ? <span><I name="shield" size={14} />{featured.admin}</span> : null}
                </div>
              </div>
            </CoverImage>
          </Reveal>

          {rest.length ? (
            <div className="std-event-grid">
              {rest.map((event, index) => (
                <Reveal className="std-event-card" key={event.id} delay={index * 0.04}>
                  <CoverImage
                    className="std-event-thumb"
                    src={event.image_path}
                    alt={event.title}
                    icon="spark"
                  />
                  <div className="std-event-body">
                    <span className="std-relative">{event.created_at}</span>
                    <h3>{event.title}</h3>
                    <p>{event.content}</p>
                    {event.admin ? <Badge tone="vio">{event.admin}</Badge> : null}
                  </div>
                </Reveal>
              ))}
            </div>
          ) : null}

          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      )}
    </>
  )
}
