import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Reveal, StatCard } from '../../lib/ui'
function Insight() {
  const { t } = useI18n()
  return (
    <div className="card" style={{ padding: 26 }}>
      <h3 style={{ margin: '0 0 8px' }}>{t('homeEmptyTitle')}</h3>
      <p style={{ margin: 0, color: 'var(--muted)' }}>{t('homeEmptySub')}</p>
    </div>
  )
}

export function AdminHome() {
  const { user } = useAuth()
  const { t } = useI18n()
  const isSuper = Boolean(user?.is_super_admin)
  const roles = user?.roles || []
  const can = (s) => isSuper || roles.includes(s)

  const fetch =
    (enabled, path) =>
    () =>
      enabled ? request(path) : Promise.resolve({ data: { data: [], total: 0 } })

  const students = useAsync(fetch(can('accounts'), '/api/student/get/all'), [can('accounts')])
  const doctors = useAsync(fetch(can('accounts'), '/api/doctor/get/all'), [can('accounts')])
  const courses = useAsync(fetch(can('courses'), '/api/course/get/all'), [can('courses')])
  const departments = useAsync(fetch(can('departments'), '/api/department/get/all'), [can('departments')])
  const semesters = useAsync(fetch(can('semesters'), '/api/semester/get/all'), [can('semesters')])
  const schedules = useAsync(fetch(can('schedules'), '/api/schedule/get/all'), [can('schedules')])
  const events = useAsync(fetch(can('events'), '/api/event/get/all'), [can('events')])

  const t2 = (a) => normalizePage(a.data).total

  const cards = [
    can('accounts') ? { icon: 'users', label: t('students'), value: t2(students), to: '/app/admin/accounts', tone: 'vio' } : null,
    can('accounts') ? { icon: 'cap', label: t('professors'), value: t2(doctors), to: '/app/admin/accounts', tone: 'cy' } : null,
    can('courses') ? { icon: 'book', label: t('courses'), value: t2(courses), to: '/app/admin/courses', tone: 'grn' } : null,
    can('departments') ? { icon: 'building', label: t('departments'), value: t2(departments), to: '/app/admin/departments', tone: 'pnk' } : null,
    can('semesters') ? { icon: 'calendar', label: t('semesters'), value: t2(semesters), to: '/app/admin/semesters', tone: 'amb' } : null,
    can('schedules') ? { icon: 'clock', label: t('schedules'), value: t2(schedules), to: '/app/admin/schedules', tone: 'cy' } : null,
    can('events') ? { icon: 'spark', label: t('events'), value: t2(events), to: '/app/admin/events', tone: 'pnk' } : null,
  ].filter(Boolean)

  return (
    <>
      <Reveal className="cta-band" style={{ padding: '44px 38px', marginBottom: 28, textAlign: 'left' }}>
        <span className="badge vio" style={{ marginBottom: 14 }}>
          <span className="gd" /> {t('administrator')}
        </span>
        <h1 style={{ fontSize: 'clamp(1.7rem,3vw,2.5rem)', marginBottom: 10 }}>
          {t('homeHeroPre')} <span className="grad-text">{t('homeHero')}</span>
        </h1>
        <p style={{ margin: 0, maxWidth: 640 }}>{t('homeHeroSub')}</p>
      </Reveal>

      {cards.length ? (
        <div className="grid grid-4">
          {cards.map((c, i) => (
            <Link to={c.to} key={c.label}>
              <StatCard icon={c.icon} label={c.label} value={c.value} tone={c.tone} delay={i * 0.05} sub={t('openSection')} />
            </Link>
          ))}
        </div>
      ) : (
        <Insight />
      )}
    </>
  )
}
