import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROOTS, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Btn, Field, I, Reveal, useToast } from '../lib/ui'

const ROLES = [
  { key: 'student', labelKey: 'student', icon: 'cap' },
  { key: 'professor', labelKey: 'professor', icon: 'users' },
  { key: 'admin', labelKey: 'admin', icon: 'shield' },
]

export default function Login() {
  const [params] = useSearchParams()
  const roleParam = ROLES.some((r) => r.key === params.get('role')) ? params.get('role') : 'student'
  const [tab, setTab] = useState('login')
  const [role, setRole] = useState(roleParam)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const [events, setEvents] = useState([])
  const [slide, setSlide] = useState(0)
  const [levels, setLevels] = useState([])
  const [departments, setDepartments] = useState([])

  const [form, setForm] = useState({
    name: '', regEmail: '', regPassword: '', gender: 1, level_id: '', department_id: '', phone: '', national_id: '',
  })
  const [regShow, setRegShow] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [sent, setSent] = useState(false)

  const { login, isAuthed, session } = useAuth()
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthed && session?.role) navigate(APP_ROOTS[session.role], { replace: true })
  }, [isAuthed, session, navigate])

  useEffect(() => {
    let alive = true
    request('/api/public/events')
      .then((data) => {
        if (alive) {
          const items = Array.isArray(data) ? data : []
          setEvents(items)
          if (items.length > 1) {
            const t = setInterval(() => setSlide((s) => (s + 1) % items.length), 4500)
            return () => clearInterval(t)
          }
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    request('/api/public/meta')
      .then((data) => {
        setLevels(data?.levels || [])
        setDepartments(data?.departments || [])
      })
      .catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const next = await login(role, email.trim(), password)
      toast.success(t('welcomeBackToast', { name: next.user?.name || t('there') }))
      navigate(APP_ROOTS[next.role] || '/', { replace: true })
    } catch (err) {
      toast.error(err.message || t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const register = async (e) => {
    e.preventDefault()
    setRegistering(true)
    try {
      const payload = {
        name: form.name,
        email: form.regEmail,
        password: form.regPassword,
        gender: Number(form.gender),
      }
      if (form.phone) payload.phone = form.phone
      if (form.national_id) payload.national_id = form.national_id
      if (form.level_id) payload.level_id = Number(form.level_id)
      if (form.department_id) payload.department_id = Number(form.department_id)
      await request('/api/public/access-request', { method: 'POST', data: payload })
      setSent(true)
      toast.success(t('requestSubmitted'))
    } catch (err) {
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setRegistering(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const current = slide % Math.max(events.length, 1)

  return (
    <div className={`auth login-flip ${sent ? 'has-sent' : ''}`}>
      <button
        type="button"
        className="lang-toggle lang-toggle-float"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        title={t('langLabel')}
      >
        <I name="globe" size={17} />
        <span>{lang === 'ar' ? t('switchToEn') : t('switchToAr')}</span>
      </button>

      <aside className="auth-visual">
        <span className="orb orb-v" style={{ position: 'absolute', width: 380, height: 380, top: '-80px', left: '-60px', opacity: 0.4 }} />
        <span className="orb orb-c" style={{ position: 'absolute', width: 340, height: 340, bottom: '-90px', right: '-50px', opacity: 0.3 }} />
        <div className="hero-grid" style={{ position: 'absolute', inset: 0 }} />

        <Reveal className="plank">
          <span className="logo" style={{ justifyContent: 'center' }}>
            <span className="logo-mark">
              <I name="cap" size={20} />
            </span>
            Univers<span className="grad-text">Tech</span>
          </span>

          {events.length ? (
            <div className="events-rail">
              <div className="events-head">
                <span className="kicker">{t('campusToday')}</span>
              </div>
              {events.map((ev, i) => (
                <div key={ev.id} className={`event-slide ${i === current ? 'in' : ''}`}>
                  {ev.image ? <img className="event-img" src={ev.image} alt="" /> : <div className="event-img event-img-fallback" />}
                  <h1>{ev.title}</h1>
                  <p>{ev.content}</p>
                  <div className="event-date">
                    <I name="calendar" size={14} />
                    {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
              <div className="event-dots">
                {events.map((_, i) => (
                  <button
                    key={i}
                    className={`dot ${i === current ? 'on' : ''}`}
                    onClick={() => setSlide(i)}
                    aria-label={t('eventDotLabel', { n: i + 1 })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <h1>
                {t('heroTitle')} <span className="grad-text">{t('heroSpot')}</span>
              </h1>
              <p>{t('heroLead')}</p>
            </>
          )}
        </Reveal>
      </aside>

      <main className="auth-form">
        <Reveal className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`atab ${tab === 'login' ? 'on' : ''}`}
              onClick={() => setTab('login')}
            >
              <I name="shield" size={16} /> {t('tabSignIn')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`atab ${tab === 'register' ? 'on' : ''}`}
              onClick={() => setTab('register')}
            >
              <I name="plus" size={16} /> {t('tabCreateAccount')}
            </button>
          </div>

          {sent ? (
            <div className="auth-panel">
              <div className="sent-icon">
                <I name="check" size={28} />
              </div>
              <h2 className="title">{t('requestSent')}</h2>
              <p className="subt">{t('requestSentSub')}</p>
              <Btn className="btn-block" size="lg" icon="arrow" onClick={() => { setSent(false); setTab('login'); setForm({ ...form, regEmail: form.regEmail, regPassword: '' }) }}>
                {t('backToSignIn')}
              </Btn>
            </div>
          ) : tab === 'login' ? (
            <div className="auth-panel">
              <h2 className="title">{t('welcomeBackTitle')}</h2>
              <p className="subt">{t('chooseRole')}</p>

              <div className="role-tabs">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`role-tab ${role === r.key ? 'on' : ''}`}
                    onClick={() => setRole(r.key)}
                  >
                    <I name={r.icon} size={18} />
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>

              <form onSubmit={submit}>
                <Field label={t('email')}>
                  <div style={{ position: 'relative' }}>
                    <I name="mail" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                    <input
                      className="input"
                      type="email"
                      required
                      placeholder={t('emailPh')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ paddingLeft: 42 }}
                      autoComplete="email"
                    />
                  </div>
                </Field>

                <Field label={t('password')}>
                  <div style={{ position: 'relative' }}>
                    <I name="lock" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                    <input
                      className="input"
                      type={show ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: 42, paddingRight: 44 }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }}
                      aria-label={t('togglePassword')}
                    >
                      <I name={show ? 'eyeOff' : 'eye'} size={17} />
                    </button>
                  </div>
                </Field>

                <Btn type="submit" className="btn-block" size="lg" loading={loading} iconRight={loading ? undefined : 'arrow'}>
                  {loading ? t('signingIn') : t('signInAs', { role: t(ROLES.find((r) => r.key === role)?.labelKey) })}
                </Btn>
              </form>

              <p className="auth-foot">
                {t('firstTime')} <button type="button" className="linkish" onClick={() => setTab('register')}>{t('requestAccess')}</button>
                <br />
                {t('accessProvisioned')}
              </p>
            </div>
          ) : (
            <div className="auth-panel">
              <h2 className="title">{t('requestAccessTitle')}</h2>
              <p className="subt">{t('requestAccessSub')}</p>

              <form onSubmit={register}>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <Field label={t('fullName')}>
                    <input className="input" value={form.name} onChange={set('name')} placeholder={t('fullNamePh')} required />
                  </Field>
                  <Field label={t('email')}>
                    <input className="input" type="email" value={form.regEmail} onChange={set('regEmail')} placeholder="you@mail.com" required />
                  </Field>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <Field label={t('password')}>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={regShow ? 'text' : 'password'}
                        value={form.regPassword}
                        onChange={set('regPassword')}
                        placeholder={t('passwordPh')}
                        minLength={6}
                        style={{ paddingRight: 44 }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setRegShow((s) => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }}
                        aria-label={t('togglePassword')}
                      >
                        <I name={regShow ? 'eyeOff' : 'eye'} size={17} />
                      </button>
                    </div>
                  </Field>
                  <Field label={t('gender')}>
                    <div className="radio-row">
                      <button type="button" className={`chip ${form.gender === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 1 })}>{t('female')}</button>
                      <button type="button" className={`chip ${form.gender === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 0 })}>{t('male')}</button>
                    </div>
                  </Field>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <Field label={t('level')}>
                    <select className="select" value={form.level_id} onChange={set('level_id')}>
                      <option value="">{t('select')}</option>
                      {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  <Field label={t('department')}>
                    <select className="select" value={form.department_id} onChange={set('department_id')}>
                      <option value="">{t('select')}</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <Field label={t('phoneOptional')}>
                    <input className="input" value={form.phone} onChange={set('phone')} maxLength={11} placeholder={t('phonePh')} />
                  </Field>
                  <Field label={t('nationalIdOptional')}>
                    <input className="input" value={form.national_id} onChange={set('national_id')} maxLength={14} placeholder={t('nationalIdPh')} />
                  </Field>
                </div>

                <Btn type="submit" className="btn-block" size="lg" loading={registering} iconRight={registering ? undefined : 'arrow'}>
                  {registering ? t('submitting') : t('submitRequest')}
                </Btn>
              </form>

              <p className="auth-foot">
                {t('alreadyHaveAccount')} <button type="button" className="linkish" onClick={() => setTab('login')}>{t('signIn')}</button>
              </p>
            </div>
          )}
        </Reveal>
      </main>
    </div>
  )
}