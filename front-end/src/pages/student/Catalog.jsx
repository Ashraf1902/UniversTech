import { useMemo, useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Pager, Reveal, useToast } from '../../lib/ui'
import { Head } from './_shared'

const TONES = ['a', 'b', 'c', 'd']

function toneFor(code) {
  const sum = [...String(code || '')].reduce((total, ch) => total + ch.charCodeAt(0), 0)
  return TONES[sum % TONES.length]
}

function SeatBadge({ course, t }) {
  if (course.capacity == null) return <Badge tone="grn">{t('seatsOpen')}</Badge>
  if (course.seats_remaining <= 0) return <Badge tone="red">{t('courseFull')}</Badge>
  return <Badge tone="grn">{t('seatsLeft', { n: course.seats_remaining })}</Badge>
}

export function StudentCatalog() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [failures, setFailures] = useState([])
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request(`/api/user/all-courses?page=${page}`), [page])
  const paged = normalizePage(data)
  const items = paged.items

  const first = items[0]
  const registrationOpen = first ? first.registration_open !== false : true
  const creditLimit = first?.credit_limit ?? null
  const dropWindowDays = first?.drop_window_days ?? null

  const selectedIds = useMemo(() => selected.map((c) => c.id), [selected])
  const creditUsed = useMemo(
    () => selected.reduce((sum, c) => sum + (Number(c.no_of_hours) || 0), 0),
    [selected],
  )
  const overLimit = creditLimit != null && creditUsed > creditLimit

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) =>
      `${c.course_name || ''} ${c.course_code || ''}`.toLowerCase().includes(q),
    )
  }, [items, query])

  const isBlocked = (c) =>
    !registrationOpen || c.already_registered || (c.seats_remaining != null && c.seats_remaining <= 0)

  const toggle = (c) => {
    if (isBlocked(c)) return
    setFailures([])
    setSelected((list) => (list.some((x) => x.id === c.id) ? list.filter((x) => x.id !== c.id) : [...list, c]))
  }

  const register = async () => {
    if (!selected.length) return toast.info(t('selectCourseFirst'))
    if (overLimit) return toast.info(t('creditLimitExceededShort'))
    setBusy(true)
    setFailures([])
    try {
      await request('/api/user/register-course', {
        method: 'POST',
        data: { course_ids: selected.map((c) => c.id) },
      })
      toast.success(t('registeredCount', { n: selected.length }))
      setSelected([])
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
      const errs = e?.payload?.data?.errors
      if (Array.isArray(errs)) {
        setFailures(
          errs.map((x) => {
            const name = items.find((c) => c.id === x.course_id)?.course_name || `#${x.course_id}`
            return `${name}: ${x.reason}`
          }),
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker={t('catalog')} title={t('registerForCourses')} sub={t('registerForCoursesSub')} />

      {!loading && !registrationOpen ? (
        <Reveal className="card cat-notice">
          <span className="cat-notice-icon">
            <I name="lock" size={20} />
          </span>
          <div>
            <h3>{t('registrationClosedTitle')}</h3>
            <p>{t('registrationClosedSub')}</p>
          </div>
        </Reveal>
      ) : null}

      {failures.length ? (
        <div className="card cat-failures" role="alert">
          <h3>{t('registrationFailed')}</h3>
          <ul>
            {failures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Reveal className="cat-toolbar">
        <label className="cat-search">
          <I name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('courseSearchPh')}
            aria-label={t('courseSearch')}
          />
          {query ? (
            <button type="button" className="cat-search-clear" onClick={() => setQuery('')} aria-label={t('clearSearch')}>
              <I name="x" size={15} />
            </button>
          ) : null}
        </label>

        <div className="cat-toolbar-meta">
          {creditLimit != null ? (
            <span className={`cat-credit ${overLimit ? 'is-over' : ''}`}>
              {t('creditsSelected', { used: creditUsed, limit: creditLimit })}
            </span>
          ) : (
            <span className="cat-credit">{t('creditsEnrolled', { n: creditUsed })}</span>
          )}
          {dropWindowDays != null ? (
            <span className="cat-window">
              <I name="info" size={13} /> {t('dropWindowHint', { n: dropWindowDays })}
            </span>
          ) : null}
        </div>

        <Btn loading={busy} disabled={!registrationOpen || !selected.length} onClick={register} icon="check">
          {t('register')}
          {selected.length ? ` (${selected.length})` : ''}
        </Btn>
      </Reveal>

      {loading ? (
        <div className="grid grid-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="card" key={i}>
              <div className="sk" style={{ height: 160 }} />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <>
          {visible.length ? (
          <div className="grid grid-3">
            {visible.map((c, i) => {
              const on = selectedIds.includes(c.id)
              const blocked = isBlocked(c)
              const prereqs = c.prerequisites || []
              return (
                <Reveal
                  key={c.id}
                  className={`cat-card tone-${toneFor(c.course_code)} ${on ? 'is-on' : ''} ${blocked ? 'is-blocked' : ''}`}
                  delay={i * 0.04}
                  onClick={() => toggle(c)}
                >
                  <button
                    type="button"
                    className="cat-pick"
                    aria-pressed={on}
                    aria-label={c.course_name}
                    disabled={blocked}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(c)
                    }}
                  >
                    {on ? <I name="check" size={16} /> : null}
                  </button>

                  <div className="cat-card-top">
                    {c.course_code ? <span className="cat-code">{c.course_code}</span> : null}
                    {c.already_registered ? <Badge tone="grn">{t('alreadyRegistered')}</Badge> : <SeatBadge course={c} t={t} />}
                  </div>

                  <h3>{c.course_name}</h3>
                  <p className="cat-prof">
                    <I name="user" size={14} />
                    {c.professor || t('noProfessorAssigned')}
                  </p>

                  <div className="cat-meta">
                    {c.no_of_hours ? (
                      <span>
                        <I name="clock" size={13} /> {t('creditHrs', { n: c.no_of_hours })}
                      </span>
                    ) : null}
                    {c.section_type ? (
                      <span>
                        <I name="layers" size={13} /> {t('type_' + String(c.section_type).toLowerCase())}
                      </span>
                    ) : null}
                  </div>

                  {prereqs.length ? (
                    <div className="cat-prereqs">
                      <small>{t('prerequisites')}</small>
                      <div>
                        {prereqs.map((p) => (
                          <Badge key={p.id} tone="amb">
                            {p.course_code || p.course_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Reveal>
              )
            })}
          </div>
          ) : (
            <Empty
              icon="search"
              title={t('noSearchResults')}
              sub={t('courseSearchPh')}
              action={
                <Btn variant="soft" onClick={() => setQuery('')}>
                  {t('clearSearch')}
                </Btn>
              }
            />
          )}

          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="layers" title={t('noCoursesAvailable')} sub={t('noCoursesAvailableSub')} />
      )}
    </>
  )
}
