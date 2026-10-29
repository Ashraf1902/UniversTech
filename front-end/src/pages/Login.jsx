import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROOTS, FORGOT_PASSWORD_PATHS, request } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Btn, Field, I, Reveal, useToast } from '../lib/ui'
import { AuthAlert, AuthInput, AuthShell, errorFields } from './_auth'

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
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

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
  const [resetSent, setResetSent] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  const { login, isAuthed, session } = useAuth()
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthed && session?.role) navigate(APP_ROOTS[session.role], { replace: true })
  }, [isAuthed, session, navigate])

  useEffect(() => {
    let alive = true
    let timer
    request('/api/public/events')
      .then((data) => {
        if (!alive) return
        const items = Array.isArray(data) ? data : []
        setEvents(items)
        if (items.length > 1) {
          timer = setInterval(() => setSlide((s) => (s + 1) % items.length), 5000)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
      if (timer) clearInterval(timer)
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

  const resetFeedback = () => {
    setErrors({})
    setFormError('')
  }

  const changeTab = (next) => {
    setTab(next)
    resetFeedback()
  }

  const changeRole = (next) => {
    setRole(next)
    resetFeedback()
  }

  const submit = async (e) => {
    e.preventDefault()
    resetFeedback()
    setLoading(true)
    try {
      const next = await login(role, email.trim(), password)
      toast.success(t('welcomeBackToast', { name: next.user?.name || t('there') }))
      navigate(APP_ROOTS[next.role] || '/', { replace: true })
    } catch (err) {
      const fields = errorFields(err)
      if (fields && Object.keys(fields).length) setErrors(fields)
      setFormError(err.message || t('loginFailed'))
      toast.error(err.message || t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const register = async (e) => {
    e.preventDefault()
    resetFeedback()
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
      const fields = errorFields(err)
      if (fields && Object.keys(fields).length) setErrors(fields)
      setFormError(err.message || t('somethingWrong'))
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setRegistering(false)
    }
  }

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    const errorKey = k === 'regEmail' ? 'email' : k === 'regPassword' ? 'password' : k
    if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: undefined }))
  }

  const openForgot = () => {
    setResetSent(false)
    changeTab('forgot')
  }

  const sendReset = async (e) => {
    e.preventDefault()
    resetFeedback()
    setSendingReset(true)
    try {
      await request(FORGOT_PASSWORD_PATHS[role], { method: 'POST', data: { email: email.trim() } })
      setResetSent(true)
    } catch (err) {
      const fields = errorFields(err)
      if (fields && Object.keys(fields).length) setErrors(fields)
      setFormError(err.message || t('somethingWrong'))
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setSendingReset(false)
    }
  }

  const current = slide % Math.max(events.length, 1)
  const currentEvent = events[current]
  const roleLabel = t(ROLES.find((r) => r.key === role)?.labelKey)

  const roleTabs = (
    <div className="role-tabs" role="tablist" aria-label={t('chooseRole')}>
      {ROLES.map((r) => (
        <button
          key={r.key}
          type="button"
          role="tab"
          aria-selected={role === r.key}
          className={`role-tab ${role === r.key ? 'on' : ''}`}
          onClick={() => changeRole(r.key)}
        >
          <I name={r.icon} size={17} />
          {t(r.labelKey)}
        </button>
      ))}
    </div>
  )

  return (
    <AuthShell
      asideExtra={
        currentEvent ? (
          <div className="auth-event" key={currentEvent.id}>
            <span className="auth-event-icon">
              <I name="spark" size={15} />
            </span>
            <span className="auth-event-text">
              <small>{t('campusToday')}</small>
              <strong>{currentEvent.title}</strong>
            </span>
            <span className="auth-event-count">
              {current + 1}/{events.length}
            </span>
          </div>
        ) : null
      }
    >
      <button
        type="button"
        className="lang-toggle lang-toggle-float"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        title={t('langLabel')}
      >
        <I name="globe" size={17} />
        <span>{lang === 'ar' ? t('switchToEn') : t('switchToAr')}</span>
      </button>

      <Reveal className="auth-card">
        {sent ? (
          <div className="auth-panel">
            <div className="sent-icon">
              <I name="check" size={28} />
            </div>
            <h2 className="auth-title">{t('requestSent')}</h2>
            <p className="auth-sub">{t('requestSentSub')}</p>
            <Btn
              className="btn-block"
              size="lg"
              iconRight="arrow"
              onClick={() => {
                setSent(false)
                setForm({ ...form, regEmail: form.regEmail, regPassword: '' })
                changeTab('login')
              }}
            >
              {t('backToSignIn')}
            </Btn>
          </div>
        ) : tab === 'forgot' ? (
          <div className="auth-panel">
            <button type="button" className="auth-back" onClick={() => changeTab('login')}>
              <I name="arrow" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('backToSignIn')}
            </button>
            {resetSent ? (
              <>
                <div className="sent-icon">
                  <I name="mail" size={28} />
                </div>
                <h2 className="auth-title">{t('resetLinkSentTitle')}</h2>
                <p className="auth-sub">{t('resetLinkSentSub')}</p>
                <Btn
                  className="btn-block"
                  size="lg"
                  iconRight="arrow"
                  onClick={() => {
                    setResetSent(false)
                    changeTab('login')
                  }}
                >
                  {t('backToSignIn')}
                </Btn>
              </>
            ) : (
              <>
                <h2 className="auth-title">{t('forgotPasswordTitle')}</h2>
                <p className="auth-sub">{t('forgotPasswordSub')}</p>

                {roleTabs}

                {formError ? <AuthAlert>{formError}</AuthAlert> : null}

                <form onSubmit={sendReset} noValidate>
                  <Field label={t('email')} error={errors.email}>
                    <AuthInput
                      icon="mail"
                      type="email"
                      placeholder={t('emailPh')}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      autoComplete="email"
                      required
                    />
                  </Field>

                  <Btn type="submit" className="btn-block" size="lg" loading={sendingReset} iconRight={sendingReset ? undefined : 'arrow'}>
                    {sendingReset ? t('sendingResetLink') : t('sendResetLink')}
                  </Btn>
                </form>
              </>
            )}
          </div>
        ) : (
          <div className="auth-panel">
            <div className="auth-head">
              <span className="auth-kicker">{t('appTag')}</span>
              <h2 className="auth-title">{tab === 'login' ? t('welcomeBackTitle') : t('requestAccessTitle')}</h2>
              <p className="auth-sub">{tab === 'login' ? t('chooseRole') : t('studentRegisterSub')}</p>
            </div>

            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                className={`atab ${tab === 'login' ? 'on' : ''}`}
                onClick={() => changeTab('login')}
              >
                <I name="login" size={16} /> {t('tabSignIn')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                className={`atab ${tab === 'register' ? 'on' : ''}`}
                onClick={() => changeTab('register')}
              >
                <I name="plus" size={16} /> {t('tabCreateAccount')}
              </button>
            </div>

            {roleTabs}

            {formError ? <AuthAlert>{formError}</AuthAlert> : null}

            {tab === 'login' ? (
              <>
                <form onSubmit={submit} noValidate>
                  <Field label={t('email')} error={errors.email}>
                    <AuthInput
                      icon="mail"
                      type="email"
                      placeholder={t('emailPh')}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      autoComplete="email"
                      required
                    />
                  </Field>

                  <Field label={t('password')} error={errors.password}>
                    <AuthInput
                      icon="lock"
                      type={show ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                      }}
                      autoComplete="current-password"
                      required
                      trailing={
                        <button
                          type="button"
                          className="input-action"
                          onClick={() => setShow((s) => !s)}
                          aria-label={t('togglePassword')}
                        >
                          <I name={show ? 'eyeOff' : 'eye'} size={17} />
                        </button>
                      }
                    />
                  </Field>

                  <div className="auth-row">
                    <button type="button" className="linkish" onClick={openForgot}>
                      {t('forgotPassword')}
                    </button>
                  </div>

                  <Btn type="submit" className="btn-block" size="lg" loading={loading} iconRight={loading ? undefined : 'arrow'}>
                    {loading ? t('signingIn') : t('signInAs', { role: roleLabel })}
                  </Btn>
                </form>

                <p className="auth-foot">
                  {t('firstTime')}{' '}
                  <button type="button" className="linkish" onClick={() => changeTab('register')}>
                    {t('requestAccess')}
                  </button>
                  <br />
                  {t('accessProvisioned')}
                </p>
              </>
            ) : role !== 'student' ? (
              <div className="auth-staff">
                <span className="auth-staff-icon">
                  <I name="shield" size={22} />
                </span>
                <h3>{t('authStaffTitle')}</h3>
                <p>{t('authStaffBody')}</p>
                <Btn className="btn-block" variant="soft" icon="cap" onClick={() => changeRole('student')}>
                  {t('authRequestStudentAccess')}
                </Btn>
                <p className="auth-foot">
                  {t('alreadyHaveAccount')}{' '}
                  <button type="button" className="linkish" onClick={() => changeTab('login')}>
                    {t('signIn')}
                  </button>
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={register} noValidate>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <Field label={t('fullName')} error={errors.name}>
                      <AuthInput icon="user" value={form.name} onChange={set('name')} placeholder={t('fullNamePh')} required />
                    </Field>
                    <Field label={t('email')} error={errors.email}>
                      <AuthInput icon="mail" type="email" value={form.regEmail} onChange={set('regEmail')} placeholder="you@mail.com" autoComplete="email" required />
                    </Field>
                  </div>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <Field label={t('password')} error={errors.password}>
                      <AuthInput
                        icon="lock"
                        type={regShow ? 'text' : 'password'}
                        value={form.regPassword}
                        onChange={set('regPassword')}
                        placeholder={t('passwordPh')}
                        minLength={6}
                        autoComplete="new-password"
                        required
                        trailing={
                          <button
                            type="button"
                            className="input-action"
                            onClick={() => setRegShow((s) => !s)}
                            aria-label={t('togglePassword')}
                          >
                            <I name={regShow ? 'eyeOff' : 'eye'} size={17} />
                          </button>
                        }
                      />
                    </Field>
                    <Field label={t('gender')} error={errors.gender}>
                      <div className="radio-row">
                        <button type="button" className={`chip ${form.gender === 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 1 })}>
                          {t('female')}
                        </button>
                        <button type="button" className={`chip ${form.gender === 0 ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 0 })}>
                          {t('male')}
                        </button>
                      </div>
                    </Field>
                  </div>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <Field label={t('level')} error={errors.level_id}>
                      <select className="select" value={form.level_id} onChange={set('level_id')}>
                        <option value="">{t('select')}</option>
                        {levels.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('department')} error={errors.department_id}>
                      <select className="select" value={form.department_id} onChange={set('department_id')}>
                        <option value="">{t('select')}</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <Field label={t('phoneOptional')} error={errors.phone}>
                      <AuthInput icon="user" value={form.phone} onChange={set('phone')} maxLength={11} placeholder={t('phonePh')} />
                    </Field>
                    <Field label={t('nationalIdOptional')} error={errors.national_id}>
                      <AuthInput icon="file" value={form.national_id} onChange={set('national_id')} maxLength={14} placeholder={t('nationalIdPh')} />
                    </Field>
                  </div>

                  <AuthAlert tone="info">{t('authStudentRegisterNote')}</AuthAlert>

                  <Btn type="submit" className="btn-block" size="lg" loading={registering} iconRight={registering ? undefined : 'arrow'}>
                    {registering ? t('submitting') : t('submitRequest')}
                  </Btn>
                </form>

                <p className="auth-foot">
                  {t('alreadyHaveAccount')}{' '}
                  <button type="button" className="linkish" onClick={() => changeTab('login')}>
                    {t('signIn')}
                  </button>
                </p>
              </>
            )}
          </div>
        )}
      </Reveal>
    </AuthShell>
  )
}
