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
  const [form, setForm] = useState({ credit_limit: '', passing_score: '', drop_window_days: '', grade_edit_window_hours: '', appeal_window_days: '', attendance_edit_window_hours: '', attendance_warn_threshold: '', attendance_bar_threshold: '', quiz_allow_resubmit: '0', quiz_allow_late: '0', quiz_submission_max_kb: '' })
  const [defaults, setDefaults] = useState(null)
  const [busy, setBusy] = useState(false)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  useEffect(() => {
    if (!data) return
    setForm({
      credit_limit: data.credit_limit ?? '',
      passing_score: data.passing_score ?? '',
      drop_window_days: data.drop_window_days ?? '',
      grade_edit_window_hours: data.grade_edit_window_hours ?? '',
      appeal_window_days: data.appeal_window_days ?? '',
      attendance_edit_window_hours: data.attendance_edit_window_hours ?? '',
      attendance_warn_threshold: data.attendance_warn_threshold ?? '',
      attendance_bar_threshold: data.attendance_bar_threshold ?? '',
      quiz_allow_resubmit: data.quiz_allow_resubmit ? '1' : '0',
      quiz_allow_late: data.quiz_allow_late ? '1' : '0',
      quiz_submission_max_kb: data.quiz_submission_max_kb ?? '',
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
          grade_edit_window_hours: Number(form.grade_edit_window_hours),
          appeal_window_days: Number(form.appeal_window_days),
          attendance_edit_window_hours: Number(form.attendance_edit_window_hours),
          attendance_warn_threshold: Number(form.attendance_warn_threshold),
          attendance_bar_threshold: Number(form.attendance_bar_threshold),
          quiz_allow_resubmit: Number(form.quiz_allow_resubmit),
          quiz_allow_late: Number(form.quiz_allow_late),
          quiz_submission_max_kb: Number(form.quiz_submission_max_kb),
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
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('gradeEditWindowSetting')} hint={t('gradeEditWindowSettingHint')} error={errors?.grade_edit_window_hours?.[0]}>
              <input className="input" type="number" min="0" max="8760" value={form.grade_edit_window_hours} disabled={loading} onChange={(e) => setForm({ ...form, grade_edit_window_hours: e.target.value })} />
            </Field>
            <Field label={t('appealWindowSetting')} hint={t('appealWindowSettingHint')} error={errors?.appeal_window_days?.[0]}>
              <input className="input" type="number" min="0" max="365" value={form.appeal_window_days} disabled={loading} onChange={(e) => setForm({ ...form, appeal_window_days: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('attendanceEditWindowSetting')} hint={t('attendanceEditWindowSettingHint')} error={errors?.attendance_edit_window_hours?.[0]}>
              <input className="input" type="number" min="0" max="8760" value={form.attendance_edit_window_hours} disabled={loading} onChange={(e) => setForm({ ...form, attendance_edit_window_hours: e.target.value })} />
            </Field>
            <Field label={t('attendanceWarnSetting')} hint={t('attendanceWarnSettingHint')} error={errors?.attendance_warn_threshold?.[0]}>
              <input className="input" type="number" min="0" max="100" value={form.attendance_warn_threshold} disabled={loading} onChange={(e) => setForm({ ...form, attendance_warn_threshold: e.target.value })} />
            </Field>
          </div>
          <Field label={t('attendanceBarSetting')} hint={t('attendanceBarSettingHint')} error={errors?.attendance_bar_threshold?.[0]}>
            <input className="input" type="number" min="0" max="100" value={form.attendance_bar_threshold} disabled={loading} onChange={(e) => setForm({ ...form, attendance_bar_threshold: e.target.value })} />
          </Field>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('quizAllowResubmitSetting')} hint={t('quizAllowResubmitSettingHint')} error={errors?.quiz_allow_resubmit?.[0]}>
              <select className="select" value={form.quiz_allow_resubmit} disabled={loading} onChange={(e) => setForm({ ...form, quiz_allow_resubmit: e.target.value })}>
                <option value="0">{t('no')}</option>
                <option value="1">{t('yes')}</option>
              </select>
            </Field>
            <Field label={t('quizAllowLateSetting')} hint={t('quizAllowLateSettingHint')} error={errors?.quiz_allow_late?.[0]}>
              <select className="select" value={form.quiz_allow_late} disabled={loading} onChange={(e) => setForm({ ...form, quiz_allow_late: e.target.value })}>
                <option value="0">{t('no')}</option>
                <option value="1">{t('yes')}</option>
              </select>
            </Field>
          </div>
          <Field label={t('quizMaxSizeSetting')} hint={t('quizMaxSizeSettingHint')} error={errors?.quiz_submission_max_kb?.[0]}>
            <input className="input" type="number" min="1" max="102400" value={form.quiz_submission_max_kb} disabled={loading} onChange={(e) => setForm({ ...form, quiz_submission_max_kb: e.target.value })} />
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
