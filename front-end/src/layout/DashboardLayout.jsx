import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { APP_ROOTS, CHANGE_PASSWORD_PATHS, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Brand, BrandMark } from '../lib/Brand'
import { useTheme } from '../lib/theme'
import { Avatar, Btn, Field, I, Modal, useToast } from '../lib/ui'

export const NAV = {
  student: [
    { to: '/app/student', end: true, icon: 'grid', key: 'overview' },
    { to: '/app/student/courses', icon: 'book', key: 'myCourses' },
    { to: '/app/student/catalog', icon: 'layers', key: 'courseCatalog' },
    { to: '/app/student/schedule', icon: 'calendar', key: 'schedule' },
    { to: '/app/student/attendance', icon: 'check', key: 'myAttendance' },
    { to: '/app/student/quizzes', icon: 'award', key: 'myQuizzes' },
    { to: '/app/student/payments', icon: 'wallet', key: 'myPayments' },
    { to: '/app/student/reports', icon: 'chart', key: 'reportsGpa' },
    { to: '/app/student/notifications', icon: 'bell', key: 'notifications', notify: true },
  ],
  professor: [
    { to: '/app/professor', end: true, icon: 'grid', key: 'overview' },
    { to: '/app/professor/courses', icon: 'book', key: 'myCourses' },
    { to: '/app/professor/timetable', icon: 'calendar', key: 'myTimetable' },
    { to: '/app/professor/students', icon: 'users', key: 'studentsAttendance' },
    { to: '/app/professor/lectures', icon: 'file', key: 'lectures' },
    { to: '/app/professor/quizzes', icon: 'award', key: 'quizzes' },
    { to: '/app/professor/grades', icon: 'chart', key: 'grades' },
    { to: '/app/professor/appeals', icon: 'mail', key: 'gradeAppeals' },
    { to: '/app/professor/announcements', icon: 'info', key: 'announcements' },
    { to: '/app/professor/notifications', icon: 'bell', key: 'notifications', notify: true },
  ],
  admin: [
    { to: '/app/admin', end: true, icon: 'grid', key: 'controlCenter' },
    { to: '/app/admin/accounts', icon: 'users', key: 'accounts', scope: 'accounts' },
    { to: '/app/admin/access-requests', icon: 'mail', key: 'accessRequests', scope: 'access_requests' },
    { to: '/app/admin/departments', icon: 'building', key: 'departments', scope: 'departments' },
    { to: '/app/admin/courses', icon: 'book', key: 'courses', scope: 'courses' },
    { to: '/app/admin/attendance', icon: 'check', key: 'roleAttendances', scope: 'attendances' },
    { to: '/app/admin/semesters', icon: 'calendar', key: 'semesters', scope: 'semesters' },
    { to: '/app/admin/rollover', icon: 'refresh', key: 'rollover', scope: 'semesters' },
    { to: '/app/admin/schedules', icon: 'clock', key: 'schedules', scope: 'schedules' },
    { to: '/app/admin/events', icon: 'spark', key: 'events', scope: 'events' },
    { to: '/app/admin/announcements', icon: 'info', key: 'announcements', scope: 'courses' },
    { to: '/app/admin/grades', icon: 'award', key: 'gradesCards', scope: 'grades' },
    { to: '/app/admin/payments', icon: 'wallet', key: 'rolePayments', scope: 'payments' },
    { to: '/app/admin/appeals', icon: 'mail', key: 'gradeAppeals', scope: 'grades' },
    { to: '/app/admin/activity', icon: 'file', key: 'activityLog', scope: 'activity' },
    { to: '/app/admin/import', icon: 'upload', key: 'bulkImport', scope: ['accounts', 'courses'] },
    { to: '/app/admin/reports', icon: 'chart', key: 'reports', scope: 'reports' },
    { to: '/app/admin/settings', icon: 'lock', key: 'settings', scope: 'settings' },
    { to: '/app/admin/admins', icon: 'shield', key: 'adminsRoles', super: true },
  ],
}

/* Four destinations that stay pinned to the mobile tab bar; everything else
   lives behind "More". */
const MOBILE_PINS = {
  student: ['/app/student', '/app/student/courses', '/app/student/schedule', '/app/student/notifications'],
  professor: ['/app/professor', '/app/professor/courses', '/app/professor/timetable', '/app/professor/notifications'],
  admin: ['/app/admin', '/app/admin/accounts', '/app/admin/semesters', '/app/admin/settings'],
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

function ChangePasswordModal({ open, onClose, role }) {
  const { t } = useI18n()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setCurrent('')
      setPassword('')
      setConfirm('')
      setShow(false)
      setBusy(false)
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error(t('passwordsDoNotMatch'))
      return
    }
    setBusy(true)
    try {
      await request(CHANGE_PASSWORD_PATHS[role], {
        method: 'POST',
        data: { current_password: current, password, password_confirmation: confirm },
      })
      toast.success(t('passwordChangedToast'))
      onClose()
    } catch (err) {
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('changePasswordTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
          <Btn type="submit" form="ut-change-password" loading={busy} iconRight={busy ? undefined : 'check'}>
            {t('saveChanges')}
          </Btn>
        </>
      }
    >
      <p className="subt" style={{ marginBottom: 18 }}>{t('changePasswordSub')}</p>
      <form id="ut-change-password" onSubmit={submit}>
        <Field label={t('currentPassword')}>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label={t('newPassword')} hint={t('passwordMinChars')}>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t('confirmPassword')}>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          {t('showPasswords')}
        </label>
      </form>
    </Modal>
  )
}

export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { theme, toggle: toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  const [more, setMore] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const menuRef = useRef(null)
  const moreRef = useRef(null)

  const nav = useMemo(() => {
    const all = NAV[role] || []
    if (role !== 'admin') return all
    const isSuper = user?.is_super_admin
    const roles = user?.roles || []
    return all.filter(
      (n) =>
        (n.super ? Boolean(isSuper) : true) &&
        (!n.scope ||
          isSuper ||
          (Array.isArray(n.scope) ? n.scope.some((s) => roles.includes(s)) : roles.includes(n.scope))),
    )
  }, [role, user?.is_super_admin, user?.roles])

  const current = useMemo(() => {
    const exact = nav.find((n) => n.end && location.pathname === n.to)
    if (exact) return exact
    const partial = [...nav].reverse().find((n) => !n.end && location.pathname.startsWith(n.to))
    return partial || nav[0]
  }, [nav, location.pathname])

  const pins = useMemo(() => {
    const wanted = MOBILE_PINS[role] || []
    const picked = wanted.map((to) => nav.find((n) => n.to === to)).filter(Boolean)
    return picked.length ? picked : nav.slice(0, 4)
  }, [nav, role])

  const overflow = useMemo(() => nav.filter((n) => !pins.some((p) => p.to === n.to)), [nav, pins])

  /* The top bar shows the role's pinned destinations plus the next few, so the
     full admin list never turns into a horizontal scroller. */
  const inline = useMemo(() => {
    if (nav.length <= 5) return nav
    const keep = new Set(pins.map((p) => p.to))
    for (const item of nav) {
      if (keep.size >= 5) break
      keep.add(item.to)
    }
    return nav.filter((n) => keep.has(n.to))
  }, [nav, pins])

  const inlineSet = useMemo(() => new Set(inline.map((n) => n.to)), [inline])
  const moreItems = useMemo(() => nav.filter((n) => !inlineSet.has(n.to)), [nav, inlineSet])

  const isActive = (item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)

  useEffect(() => {
    setSheet(false)
    setMenu(false)
    setMore(false)
  }, [location.pathname])

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

  useEffect(() => {
    if (!menu && !more) return
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false)
      if (!moreRef.current?.contains(e.target)) setMore(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu, more])

  useEffect(() => {
    if (!sheet && !menu && !more) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setSheet(false)
      setMenu(false)
      setMore(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, menu, more])

  const doLogout = async () => {
    await logout()
    navigate('/login')
  }

  const notifPath = NOTIF_PATH[role] ? `${APP_ROOTS[role]}/notifications` : null
  const pageLabel = t(current?.key) || current?.label || t('dashboard')

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to={APP_ROOTS[role]} className="brand" aria-label="UniversTech">
          <Brand size="md" className="brand-wide" />
          <BrandMark size={30} className="brand-narrow" />
        </NavLink>

        <span className="page-now">{pageLabel}</span>

        <nav className="topnav" aria-label={t('menu')}>
          {inline.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive: on }) => `nav-item ${on ? 'active' : ''}`}
            >
              <I name={item.icon} size={17} />
              <span>{t(item.key)}</span>
              {item.notify && unread ? <span className="cnt">{unread > 9 ? '9+' : unread}</span> : null}
            </NavLink>
          ))}
        </nav>

        {moreItems.length ? (
          <div className="nav-more-wrap" ref={moreRef}>
            <button
              type="button"
              className={`nav-item nav-more-btn ${moreItems.some(isActive) ? 'active' : ''}`}
              onClick={() => setMore((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={more}
            >
              <I name="more" size={17} />
              <span>{t('more')}</span>
              <I name="chevronDown" size={14} />
            </button>

            {more ? (
              <div className="moremenu" role="menu">
                {moreItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    role="menuitem"
                    className={({ isActive: on }) => `nav-item ${on ? 'active' : ''}`}
                    onClick={() => setMore(false)}
                  >
                    <I name={item.icon} size={17} />
                    <span>{t(item.key)}</span>
                    {item.notify && unread ? <span className="cnt">{unread > 9 ? '9+' : unread}</span> : null}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            <I name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          <button
            className="lang-toggle"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title={t('langLabel')}
            aria-label={t('langLabel')}
          >
            <I name="globe" size={16} />
            <span>{lang === 'ar' ? t('switchToEn') : t('switchToAr')}</span>
          </button>

          {notifPath ? (
            <NavLink to={notifPath} className="icon-btn" aria-label={t('notifications')} title={t('notifications')}>
              <I name="bell" size={19} />
              {unread ? <span className="badge-dot" /> : null}
            </NavLink>
          ) : null}

          <div className="usermenu-wrap" ref={menuRef}>
            <button
              type="button"
              className="user-chip"
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
            >
              <Avatar name={user?.name || 'User'} size={34} />
              <span className="u-meta">
                <span className="u-name">{user?.name || 'User'}</span>
                <span className="u-role">{t(role)}</span>
              </span>
              <I name="chevronDown" size={15} />
            </button>

            {menu ? (
              <div className="usermenu" role="menu">
                <div className="um-head">
                  <div className="um-name">{user?.name || 'User'}</div>
                  <div className="um-mail">{user?.email || t(role)}</div>
                </div>
                <button
                  type="button"
                  className="nav-item"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    setPwdOpen(true)
                  }}
                >
                  <I name="lock" size={17} />
                  <span>{t('changePassword')}</span>
                </button>
                <button type="button" className="nav-item danger" role="menuitem" onClick={doLogout}>
                  <I name="logout" size={17} />
                  <span>{t('signOut')}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="main">
        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label={t('menu')}>
        <div className="tabbar-in">
          {pins.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <I name={item.icon} size={21} />
              <span>{t(item.key)}</span>
              {item.notify && unread ? <span className="tb-cnt">{unread > 9 ? '9+' : unread}</span> : null}
            </NavLink>
          ))}
          <button type="button" className={sheet ? 'on' : ''} onClick={() => setSheet((s) => !s)}>
            <I name="more" size={21} />
            <span>{t('more')}</span>
          </button>
        </div>
      </nav>

      {sheet ? (
        <>
          <div className="dimmer" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('menu')}>
            <div className="sheet-head">
              <h3>{t('menu')}</h3>
              <button type="button" className="icon-btn" onClick={() => setSheet(false)} aria-label={t('close')}>
                <I name="x" size={18} />
              </button>
            </div>
            <div className="sheet-grid">
              {overflow.map((item) => (
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
            </div>
            <div className="sheet-actions">
              <button type="button" className="nav-item" onClick={() => { setSheet(false); setPwdOpen(true) }}>
                <I name="lock" size={18} />
                <span>{t('changePassword')}</span>
              </button>
              <button type="button" className="nav-item danger" onClick={doLogout}>
                <I name="logout" size={18} />
                <span>{t('signOut')}</span>
              </button>
            </div>
          </div>
        </>
      ) : null}

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} role={role} />
    </div>
  )
}
