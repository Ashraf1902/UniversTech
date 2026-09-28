import { useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, I, Pager, Reveal, useToast } from '../../lib/ui'
import { Head } from './_shared'
export function StudentCatalog() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request(`/api/user/all-courses?page=${page}`), [page])
  const paged = normalizePage(data)

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const register = async () => {
    if (!selected.length) return toast.info(t('selectCourseFirst'))
    setBusy(true)
    try {
      const res = await request('/api/user/register-course', { method: 'POST', data: { course_ids: selected } })
      toast.success(res?.registered?.length ? t('registeredCount', { n: res.registered.length }) : t('registrationCompleted'))
      setSelected([])
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
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
          <Btn loading={busy} onClick={register} icon="check">
            {t('register')}{selected.length ? ` (${selected.length})` : ''}
          </Btn>
        }
      />

      {loading ? (
        <div className="grid grid-3">{[0, 1, 2, 3, 4, 5].map((i) => <div className="card" key={i}><div className="sk" style={{ height: 160 }} /></div>)}</div>
      ) : paged.items.length ? (
        <>
          <div className="grid grid-3">
            {paged.items.map((c, i) => {
              const on = selected.includes(c.id)
              return (
                <Reveal key={c.id} className="fcard" delay={i * 0.04} onClick={() => toggle(c.id)} style={{ cursor: 'pointer', borderColor: on ? 'var(--vio)' : undefined, boxShadow: on ? 'var(--glow-vio)' : undefined }}>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                    {c.no_of_hours ? <Badge tone="cy">{t('creditHrs', { n: c.no_of_hours })}</Badge> : null}
                  </div>
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
