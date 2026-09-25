import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { APP_ROOTS } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Avatar, I } from '../lib/ui'
import { request } from '../lib/api'

export const NAV = {
  student: [
    { to: '/app/student', end: true, icon: 'grid', key: 'overview' },
    { to: '/app/student/courses', icon: 'book', key: 'myCourses' },
    { to: '/app/student/catalog', icon: 'layers', key: 'courseCatalog' },
    { to: '/app/student/schedule', icon: 'calendar', key: 'schedule' },
    { to: '/app/student/reports', icon: 'chart', key: 'reportsGpa' },
    { to: '/app/student/notifications', icon: 'bell', key: 'notifications', notify: true },
  ],
  professor: [
    { to: '/app/professor', end: true, icon: 'grid', key: 'overview' },
    { to: '/app/professor/courses', icon: 'book', key: 'myCourses' },
    { to: '/app/professor/students', icon: 'users', key: 'studentsAttendance' },
    { to: '/app/professor/lectures', icon: 'file', key: 'lectures' },
    { to: '/app/professor/quizzes', icon: 'award', key: 'quizzes' },
    { to: '/app/professor/grades', icon: 'chart', key: 'grades' },
    { to: '/app/professor/notifications', icon: 'bell', key: 'notifications', notify: true },
  ],
  admin: [
    { to: '/app/admin', end: true, icon: 'grid', key: 'controlCenter' },
    { to: '/app/admin/accounts', icon: 'users', key: 'accounts', scope: 'accounts' },
    { to: '/app/admin/access-requests', icon: 'mail', key: 'accessRequests', scope: 'access_requests' },
    { to: '/app/admin/departments', icon: 'building', key: 'departments', scope: 'departments' },
    { to: '/app/admin/courses', icon: 'book', key: 'courses', scope: 'courses' },
    { to: '/app/admin/semesters', icon: 'calendar', key: 'semesters', scope: 'semesters' },
    { to: '/app/admin/schedules', icon: 'clock', key: 'schedules', scope: 'schedules' },
    { to: '/app/admin/events', icon: 'spark', key: 'events', scope: 'events' },
    { to: '/app/admin/grades', icon: 'award', key: 'gradesCards', scope: 'grades' },
    { to: '/app/admin/admins', icon: 'shield', key: 'adminsRoles', super: true },
  ],
}

const NOTIF_PATH = {
  student: '/api/user/notifications',
  professor: '/api/professor/notifications',
}

export function RoleGate({ role, children }) {
  const { isAuthed, role: current } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  if (current && current !== role) return <Navigate to={APP_ROOTS[current] || '/'} replace />
  return children
}

export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [unread, setUnread] = useState(0)

  const nav = useMemo(() => {
    const all = NAV[role] || []
    if (role !== 'admin') return all
    const isSuper = user?.is_super_admin
    const roles = user?.roles || []
    return all.filter(
      (n) =>
        (n.super ? Boolean(isSuper) : true) &&
        (!n.scope || isSuper || roles.includes(n.scope)),
    )
  }, [role, user?.is_super_admin, user?.roles])
  const current = useMemo(() => {
    const exact = nav.find((n) => n.end && location.pathname === n.to)
    if (exact) return exact
    const partial = [...nav].reverse().find((n) => !n.end && location.pathname.startsWith(n.to))
    return partial || nav[0]
  }, [nav, location.pathname])

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    const path = NOTIF_PATH[role]
    if (!path) return
    let alive = true
    request(path)
      .then((res) => {
        if (!alive) return
        const items = Array.isArray(res) ? res : res?.data || []
        setUnread(items.length)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [role, location.pathname])

  const doLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <NavLink to={APP_ROOTS[role]} className="logo">
          <span className="logo-mark">
            <I name="cap" size={20} />
          </span>
          Univers<span className="grad-text">Tech</span>
        </NavLink>

        <nav style={{ flex: 1 }}>
          <div className="nav-grp-lbl">{t('menu')}</div>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <I name={item.icon} size={19} />
              <span>{t(item.key)}</span>
              {item.notify && unread ? <span className="cnt">{unread > 9 ? '9+' : unread}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="side-foot">
          <button className="user-mini" onClick={() => setMenu((m) => !m)} style={{ width: '100%' }}>
            <Avatar name={user?.name || 'User'} size={38} />
            <span className="meta" style={{ textAlign: 'left' }}>
              <div className="nm">{user?.name || 'User'}</div>
              <div className="rl">{t(role)}</div>
            </span>
            <I name="chevron" size={16} style={{ marginLeft: 'auto', color: 'var(--faint)' }} />
          </button>
          {menu ? (
            <div className="card" style={{ padding: 8, marginTop: 8 }}>
              <button className="nav-item" style={{ width: '100%' }} onClick={doLogout}>
                <I name="logout" size={18} />
                <span>{t('signOut')}</span>
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {open ? <div className="dimmer" onClick={() => setOpen(false)} /> : null}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn topbar-burger" onClick={() => setOpen(true)} aria-label="Open menu">
            <I name="menu" size={20} />
          </button>
          <div>
            <div className="page-title">{t(current?.key) || current?.label || t('dashboard')}</div>
            <div className="page-sub">{t('welcomeBack', { name: user?.name?.split(' ')[0] || 'there' })}</div>
          </div>
          <div className="top-actions">
            {NOTIF_PATH[role] ? (
              <NavLink to={`${APP_ROOTS[role]}/notifications`} className="icon-btn" aria-label={t('notifications')}>
                <I name="bell" size={19} />
                {unread ? <span className="badge-dot" /> : null}
              </NavLink>
            ) : null}
            <button
              className="lang-toggle"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              title={t('langLabel')}
              aria-label={t('langLabel')}
            >
              <I name="globe" size={17} />
              <span>{lang === 'ar' ? t('switchToEn') : t('switchToAr')}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8 }}>
              <Avatar name={user?.name || 'User'} size={38} />
            </div>
          </div>
        </header>

        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}