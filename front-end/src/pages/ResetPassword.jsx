import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RESET_PASSWORD_PATHS, request } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Btn, Field, I, Reveal, useToast } from '../lib/ui'

const ROLES = ['student', 'professor', 'admin']

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const role = ROLES.includes(params.get('role')) ? params.get('role') : 'student'

  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const validLink = Boolean(token && email)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error(t('passwordsDoNotMatch'))
      return
    }
    setLoading(true)
    try {
      await request(RESET_PASSWORD_PATHS[role], {
        method: 'POST',
        data: { token, email, password, password_confirmation: confirm },
      })
      toast.success(t('passwordResetSuccess'))
      navigate(`/login?role=${role}`, { replace: true })
    } catch (err) {
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth login-flip" style={{ gridTemplateColumns: '1fr' }}>
      <button
        type="button"
        className="lang-toggle lang-toggle-float"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        title={t('langLabel')}
      >
        <I name="globe" size={17} />
        <span>{lang === 'ar' ? t('switchToEn') : t('switchToAr')}</span>
      </button>

      <main className="auth-form">
        <Reveal className="auth-card">
          <span className="logo" style={{ justifyContent: 'center', marginBottom: 28 }}>
            <span className="logo-mark">
              <I name="cap" size={20} />
            </span>
            Univers<span className="grad-text">Tech</span>
          </span>

          {!validLink ? (
            <div className="auth-panel">
              <div className="sent-icon">
                <I name="x" size={28} />
              </div>
              <h2 className="title">{t('invalidResetLink')}</h2>
              <p className="subt">{t('invalidResetLinkSub')}</p>
              <Link className="btn btn-primary btn-block btn-lg" to="/login">
                {t('backToSignIn')}
              </Link>
            </div>
          ) : (
            <div className="auth-panel">
              <h2 className="title">{t('resetPasswordTitle')}</h2>
              <p className="subt">{t('resetPasswordSub')}</p>

              <form onSubmit={submit}>
                <Field label={t('newPassword')}>
                  <div style={{ position: 'relative' }}>
                    <I name="lock" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                    <input
                      className="input"
                      type={show ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={t('passwordPh')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: 42, paddingRight: 44 }}
                      autoComplete="new-password"
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

                <Field label={t('confirmPassword')}>
                  <div style={{ position: 'relative' }}>
                    <I name="lock" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                    <input
                      className="input"
                      type={show ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={t('passwordPh')}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      style={{ paddingLeft: 42 }}
                      autoComplete="new-password"
                    />
                  </div>
                </Field>

                <Btn type="submit" className="btn-block" size="lg" loading={loading} iconRight={loading ? undefined : 'check'}>
                  {loading ? t('resetting') : t('resetPassword')}
                </Btn>
              </form>

              <p className="auth-foot">
                <Link className="linkish" to="/login">{t('backToSignIn')}</Link>
              </p>
            </div>
          )}
        </Reveal>
      </main>
    </div>
  )
}
