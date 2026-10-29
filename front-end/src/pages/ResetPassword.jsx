import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RESET_PASSWORD_PATHS, request } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Btn, Field, I, Reveal, useToast } from '../lib/ui'
import { AuthAlert, AuthInput, AuthShell, errorFields } from './_auth'

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
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const validLink = Boolean(token && email)

  const submit = async (e) => {
    e.preventDefault()
    setErrors({})
    setFormError('')
    if (password !== confirm) {
      toast.error(t('passwordsDoNotMatch'))
      setErrors({ password_confirmation: t('passwordsDoNotMatch') })
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
      const fields = errorFields(err)
      if (fields && Object.keys(fields).length) setErrors(fields)
      setFormError(err.message || t('somethingWrong'))
      toast.error(err.message || t('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
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
        {!validLink ? (
          <div className="auth-panel">
            <div className="sent-icon is-warn">
              <I name="x" size={28} />
            </div>
            <h2 className="auth-title">{t('invalidResetLink')}</h2>
            <p className="auth-sub">{t('invalidResetLinkSub')}</p>
            <Link className="btn btn-primary btn-block btn-lg" to="/login">
              {t('backToSignIn')}
            </Link>
          </div>
        ) : (
          <div className="auth-panel">
            <div className="auth-head">
              <span className="auth-kicker">{t('appTag')}</span>
              <h2 className="auth-title">{t('resetPasswordTitle')}</h2>
              <p className="auth-sub">{t('resetPasswordSub')}</p>
            </div>

            {formError ? <AuthAlert>{formError}</AuthAlert> : null}

            <form onSubmit={submit} noValidate>
              <Field label={t('newPassword')} error={errors.password}>
                <AuthInput
                  icon="lock"
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder={t('passwordPh')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  autoComplete="new-password"
                  trailing={
                    <button type="button" className="input-action" onClick={() => setShow((s) => !s)} aria-label={t('togglePassword')}>
                      <I name={show ? 'eyeOff' : 'eye'} size={17} />
                    </button>
                  }
                />
              </Field>

              <Field label={t('confirmPassword')} error={errors.password_confirmation}>
                <AuthInput
                  icon="lock"
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder={t('passwordPh')}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (errors.password_confirmation) setErrors((prev) => ({ ...prev, password_confirmation: undefined }))
                  }}
                  autoComplete="new-password"
                />
              </Field>

              <Btn type="submit" className="btn-block" size="lg" loading={loading} iconRight={loading ? undefined : 'check'}>
                {loading ? t('resetting') : t('resetPassword')}
              </Btn>
            </form>

            <p className="auth-foot">
              <Link className="linkish" to="/login">
                {t('backToSignIn')}
              </Link>
            </p>
          </div>
        )}
      </Reveal>
    </AuthShell>
  )
}
