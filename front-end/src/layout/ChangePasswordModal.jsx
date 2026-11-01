import { useEffect, useState } from 'react'
import { CHANGE_PASSWORD_PATHS, request } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Btn, Field, Modal, useToast } from '../lib/ui'

/**
 * The one change-password dialog used by every dashboard role. Kept outside
 * the layout so pages such as the student profile can open it directly.
 */
export default function ChangePasswordModal({ open, onClose, role }) {
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
