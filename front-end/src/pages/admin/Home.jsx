import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, I, Reveal, StatCard } from '../../lib/ui'
import { AdminHero } from './_shared'

const QUICK_LINKS = [
  { to: '/app/admin/accounts', icon: 'users', key: 'accounts', scope: 'accounts' },
  { to: '/app/admin/courses', icon: 'book', key: 'courses', scope: 'courses' },
  { to: '/app/admin/semesters', icon: 'calendar', key: 'semesters', scope: 'semesters' },
  { to: '/app/admin/reports', icon: 'chart', key: 'reports', scope: 'reports' },
  { to: '/app/admin/settings', icon: 'lock', key: 'settings', scope: 'settings' },
]

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
  const pendingRequests = useAsync(
    fetch(can('access_requests'), '/api/access-request/get/all?status=pending'),
    [can('access_requests')],
  )
  const pendingAppeals = useAsync(
    fetch(can('grades'), '/api/grade/appeal/get/all?status=pending'),
    [can('grades')],
  )
  const pendingPayments = useAsync(
    fetch(can('payments'), '/api/payment/get/all?status=pending'),
    [can('payments')],
  )

  const total = (state) => normalizePage(state.data).total
  const value = (state) => (state.loading ? '—' : total(state))

  const cards = [
    can('accounts') ? { icon: 'users', label: t('students'), value: value(students), to: '/app/admin/accounts', tone: 'vio' } : null,
    can('accounts') ? { icon: 'cap', label: t('professors'), value: value(doctors), to: '/app/admin/accounts', tone: 'cy' } : null,
    can('courses') ? { icon: 'book', label: t('courses'), value: value(courses), to: '/app/admin/courses', tone: 'grn' } : null,
    can('departments') ? { icon: 'building', label: t('departments'), value: value(departments), to: '/app/admin/departments', tone: 'pnk' } : null,
    can('semesters') ? { icon: 'calendar', label: t('semesters'), value: value(semesters), to: '/app/admin/semesters', tone: 'amb' } : null,
    can('schedules') ? { icon: 'clock', label: t('schedules'), value: value(schedules), to: '/app/admin/schedules', tone: 'cy' } : null,
    can('events') ? { icon: 'spark', label: t('events'), value: value(events), to: '/app/admin/events', tone: 'pnk' } : null,
  ].filter(Boolean)

  const heroStats = [
    can('accounts') ? { label: t('students'), value: value(students) } : null,
    can('accounts') ? { label: t('professors'), value: value(doctors) } : null,
    can('courses') ? { label: t('courses'), value: value(courses) } : null,
    can('departments') ? { label: t('departments'), value: value(departments) } : null,
  ].filter(Boolean)

  const attention = [
    can('access_requests')
      ? { to: '/app/admin/access-requests', icon: 'mail', label: t('accessRequests'), total: total(pendingRequests), loading: pendingRequests.loading }
      : null,
    can('grades')
      ? { to: '/app/admin/appeals', icon: 'award', label: t('gradeAppeals'), total: total(pendingAppeals), loading: pendingAppeals.loading }
      : null,
    can('payments')
      ? { to: '/app/admin/payments', icon: 'wallet', label: t('rolePayments'), total: total(pendingPayments), loading: pendingPayments.loading }
      : null,
  ].filter(Boolean)

  const outstanding = attention.reduce((sum, item) => sum + (item.loading ? 0 : item.total), 0)
  const quickLinks = QUICK_LINKS.filter((link) => can(link.scope))

  return (
    <>
      <AdminHero
        eyebrow={t('administrator')}
        title={`${t('homeHeroPre')} ${t('homeHero')}`}
        sub={t('homeHeroSub')}
        stats={heroStats}
      >
        {quickLinks.length ? (
          <div className="admin-quick">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="admin-quick-link">
                <span className="admin-quick-icon">
                  <I name={link.icon} size={16} />
                </span>
                {t(link.key)}
              </Link>
            ))}
          </div>
        ) : null}
      </AdminHero>

      {attention.length ? (
        <section className="card admin-attention">
          <div className="card-head">
            <div>
              <h3>{t('adminAttention')}</h3>
              <span className="home-card-sub">{t('adminAttentionSub')}</span>
            </div>
            {!outstanding && !attention.some((item) => item.loading) ? (
              <Badge tone="grn" dot>{t('adminAllClear')}</Badge>
            ) : null}
          </div>
          <div className="admin-attention-grid">
            {attention.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`admin-attention-tile ${item.total ? 'is-open' : ''}`}
              >
                <span className="admin-attention-icon">
                  <I name={item.icon} size={18} />
                </span>
                <div>
                  <strong>{item.loading ? '—' : item.total}</strong>
                  <span>{item.label}</span>
                </div>
                <I name="arrow" size={16} className="admin-attention-arrow" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {cards.length ? (
        <>
          <div className="admin-section-head">
            <div>
              <span className="kicker">{t('overview')}</span>
              <h2>{t('controlCenter')}</h2>
            </div>
            <span className="home-card-sub">{t('openSection')}</span>
          </div>
          <div className="grid grid-4 admin-card-grid">
            {cards.map((c, i) => (
              <Link to={c.to} key={c.label}>
                <StatCard icon={c.icon} label={c.label} value={c.value} tone={c.tone} delay={i * 0.05} sub={t('openSection')} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Insight />
      )}
    </>
  )
}
