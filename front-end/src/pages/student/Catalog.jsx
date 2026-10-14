import { useMemo, useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Pager, Reveal, useToast } from '../../lib/ui'
import { Head } from './_shared'

function SeatBadge({ course, t }) {
  if (course.capacity == null) return <Badge tone="grn">{t('seatsOpen')}</Badge>
  if (course.seats_remaining <= 0) return <Badge tone="red">{t('courseFull')}</Badge>
  return <Badge tone="grn">{t('seatsLeft', { n: course.seats_remaining })}</Badge>
}

export function StudentCatalog() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
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

  const creditUsed = useMemo(
    () => items.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + (Number(c.no_of_hours) || 0), 0),
    [items, selected]
  )
  const overLimit = creditLimit != null && creditUsed > creditLimit

  const isBlocked = (c) => !registrationOpen || c.already_registered || (c.seats_remaining != null && c.seats_remaining <= 0)

  const toggle = (c) => {
    if (isBlocked(c)) return
    setFailures([])
    setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
  }

  const register = async () => {
    if (!selected.length) return toast.info(t('selectCourseFirst'))
    if (overLimit) return toast.info(t('creditLimitExceededShort'))
    setBusy(true)
    setFailures([])
    try {
      await request('/api/user/register-course', { method: 'POST', data: { course_ids: selected } })
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
          })
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head
        kicker={t('catalog')}
        title={t('registerForCourses')}
        sub={t('registerForCoursesSub')}
        actions={
          <Btn loading={busy} disabled={!registrationOpen} onClick={register} icon="check">
            {t('register')}{selected.length ? ` (${selected.length})` : ''}
          </Btn>
        }
      />

      {!loading && !registrationOpen ? (
        <Reveal className="card" style={{ marginBottom: 18, borderColor: 'var(--amb, #d69e2e)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span className="fic" style={{ marginBottom: 0, width: 42, height: 42 }}>
              <I name="lock" size={20} />
            </span>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('registrationClosedTitle')}</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{t('registrationClosedSub')}</p>
            </div>
          </div>
        </Reveal>
      ) : null}

      {creditLimit != null && (selected.length > 0 || dropWindowDays != null) ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <Badge tone={overLimit ? 'red' : 'vio'}>{t('creditsSelected', { used: creditUsed, limit: creditLimit })}</Badge>
          {overLimit ? <Badge tone="red">{t('creditLimitExceededShort')}</Badge> : null}
        </div>
      ) : null}

      {failures.length ? (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--red, #e53e3e)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{t('registrationFailed')}</h3>
          <ul style={{ margin: 0, paddingInlineStart: 18, color: 'var(--muted)', fontSize: '0.86rem' }}>
            {failures.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-3">{[0, 1, 2, 3, 4, 5].map((i) => <div className="card" key={i}><div className="sk" style={{ height: 160 }} /></div>)}</div>
      ) : items.length ? (
        <>
          <div className="grid grid-3">
            {items.map((c, i) => {
              const on = selected.includes(c.id)
              const blocked = isBlocked(c)
              const prereqs = c.prerequisites || []
              return (
                <Reveal
                  key={c.id}
                  className="fcard"
                  delay={i * 0.04}
                  onClick={() => toggle(c)}
                  style={{ cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.68 : 1, borderColor: on ? 'var(--vio)' : undefined, boxShadow: on ? 'var(--glow-vio)' : undefined }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <span className="fic" style={{ marginBottom: 0, width: 44, height: 44 }}>
                      <I name="book" size={20} />
                    </span>
                    <span className={`rate ${on ? 'r-a' : ''}`} style={{ minWidth: 30, height: 30, background: on ? undefined : 'var(--card)', border: on ? undefined : '1px solid var(--line)' }}>
                      {on ? <I name="check" size={16} /> : ''}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem' }}>{c.course_name}</h3>
                  <p style={{ fontSize: '0.85rem' }}>{c.professor || t('noProfessorAssigned')}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                    {c.no_of_hours ? <Badge tone="cy">{t('creditHrs', { n: c.no_of_hours })}</Badge> : null}
                    <SeatBadge course={c} t={t} />
                    {c.already_registered ? <Badge tone="grn">{t('alreadyRegistered')}</Badge> : null}
                  </div>
                  {prereqs.length ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t('prerequisites')}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {prereqs.map((p) => <Badge key={p.id} tone="amb">{p.course_code || p.course_name}</Badge>)}
                      </div>
                    </div>
                  ) : null}
                </Reveal>
              )
            })}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="layers" title={t('noCoursesAvailable')} sub={t('noCoursesAvailableSub')} />
      )}
    </>
  )
}
