import { useEffect, useState } from 'react'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, Field, Reveal, useToast } from '../../lib/ui'
import { Head, useFieldErrors } from './_shared'

export function AdminSettings() {
  const { t } = useI18n()
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request('/api/settings/get/all'), [])
  const [form, setForm] = useState({ credit_limit: '', passing_score: '', drop_window_days: '' })
  const [defaults, setDefaults] = useState(null)
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  useEffect(() => {
    if (!data) return
    setForm({
      credit_limit: data.credit_limit ?? '',
      passing_score: data.passing_score ?? '',
      drop_window_days: data.drop_window_days ?? '',
    })
    setDefaults(data.defaults || null)
  }, [data])

  const submit = async (e) => {
    e?.preventDefault?.()
    setBusy(true)
    try {
      await request('/api/settings/update', {
        method: 'POST',
        data: {
          credit_limit: Number(form.credit_limit),
          passing_score: Number(form.passing_score),
          drop_window_days: Number(form.drop_window_days),
        },
      })
      toast.success(t('settingsSaved'))
      clearErrors()
      run().catch(() => {})
    } catch (err) {
      if (!applyErrors(err)) toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head
        kicker={t('settingsKicker')}
        title={t('settingsTitle')}
        sub={t('settingsSub')}
        actions={<Btn form="ut-settings-form" type="submit" loading={busy} icon="check">{t('saveChanges')}</Btn>}
      />

      <Reveal className="card" style={{ maxWidth: 640 }}>
        <form id="ut-settings-form" onSubmit={submit}>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('creditLimitSetting')} hint={t('creditLimitSettingHint')} error={errors?.credit_limit?.[0]}>
              <input className="input" type="number" min="0" max="60" value={form.credit_limit} disabled={loading} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
            </Field>
            <Field label={t('passingScoreSetting')} hint={t('passingScoreSettingHint')} error={errors?.passing_score?.[0]}>
              <input className="input" type="number" min="0" max="100" value={form.passing_score} disabled={loading} onChange={(e) => setForm({ ...form, passing_score: e.target.value })} />
            </Field>
          </div>
          <Field label={t('dropWindowSetting')} hint={t('dropWindowSettingHint')} error={errors?.drop_window_days?.[0]}>
            <input className="input" type="number" min="0" max="365" value={form.drop_window_days} disabled={loading} onChange={(e) => setForm({ ...form, drop_window_days: e.target.value })} />
          </Field>
        </form>
        {defaults ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 18 }}>
            {t('settingsDefaults', { credit: defaults.credit_limit, pass: defaults.passing_score, days: defaults.drop_window_days })}
          </p>
        ) : null}
      </Reveal>
    </>
  )
}
