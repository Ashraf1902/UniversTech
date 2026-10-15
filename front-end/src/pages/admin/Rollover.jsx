import { useEffect, useMemo, useState } from 'react'
import { request } from '../../lib/api'
import { Badge, Btn, Field, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, Head, useFieldErrors, useOptions } from './_shared'

const STEPS = ['closeSemester', 'reviewUnresolved', 'previewPromotion', 'confirmPromotion']

export function AdminRollover() {
  const { t } = useI18n()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [semesters, setSemesters] = useState([])
  const [fromSemesterId, setFromSemesterId] = useState('')
  const [closePreview, setClosePreview] = useState(null)
  const [unresolved, setUnresolved] = useState([])
  const [levels, setLevels] = useState([])
  const [selectedLevelIds, setSelectedLevelIds] = useState([])
  const [exclude, setExclude] = useState('')
  const [graduateFinal, setGraduateFinal] = useState(true)
  const [promoList, setPromoList] = useState([])
  const [loadingClose, setLoadingClose] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingApply, setLoadingApply] = useState(false)
  const { errors, clear: clearErrors } = useFieldErrors()

  useEffect(() => {
    ;(async () => {
      try {
        const sem = await request('/api/semester/get/all?page=1')
        setSemesters((sem.data?.items ?? sem.items ?? []))
      } catch {}
      try {
        const lev = await request('/api/level/get/all?page=1')
        setLevels((lev.data?.items ?? lev.items ?? []))
      } catch {}
    })()
  }, [])

  const closedSummary = useMemo(() => closePreview || null, [closePreview])

  const loadClosePreview = async () => {
    if (!fromSemesterId) return
    setLoadingClose(true)
    try {
      const r = await request(`/api/rollover/close/preview?semester_id=${fromSemesterId}`)
      setClosePreview(r.data || r)
      setStep(1)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingClose(false)
    }
  }

  const loadUnresolved = async () => {
    if (!fromSemesterId) return
    setLoadingClose(true)
    try {
      const r = await request(`/api/rollover/unresolved?semester_id=${fromSemesterId}`)
      setUnresolved(r.data || r)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingClose(false)
    }
  }

  const confirmClose = async () => {
    if (!window.confirm(t('closeSemesterWarning'))) return
    setLoadingClose(true)
    try {
      const r = await request('/api/rollover/semester/close', { method: 'POST', data: { semester_id: fromSemesterId } })
      toast.success(t('semesterClosed'))
      setClosePreview(r.data || r)
      setStep(2)
      await loadUnresolved()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingClose(false)
    }
  }

  const loadPromo = async () => {
    if (!fromSemesterId) return
    setLoadingPreview(true)
    try {
      const payload = {
        from_semester_id: fromSemesterId,
        level_ids: selectedLevelIds.length ? selectedLevelIds : undefined,
        exclude: exclude
          ? exclude
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : undefined,
        graduate_final: graduateFinal,
      }
      const r = await request('/api/rollover/promotion/preview', { method: 'GET', params: payload }) // but request helper uses data? wait - request takes {method,data,params}? let us check api lib pattern
      // in codebase request(path,{method,data}) - for GET, data not sent; so use path with query
      const qs = Object.entries(payload)
        .map(([k, v]) => {
          if (Array.isArray(v)) return v.map((x) => `${k}[]=${encodeURIComponent(x)}`).join('&')
          if (v === undefined || v === null) return null
          return `${k}=${encodeURIComponent(v)}`
        })
        .filter(Boolean)
        .join('&')
      const r2 = await request(`/api/rollover/promotion/preview${qs ? '?' + qs : ''}`)
      setPromoList(r2.data || r2)
      setStep(3)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  const applyPromo = async () => {
    if (!window.confirm(t('confirmApplyPromotion'))) return
    setLoadingApply(true)
    try {
      const payload = {
        from_semester_id: fromSemesterId,
        level_ids: selectedLevelIds.length ? selectedLevelIds : undefined,
        exclude: exclude
          ? exclude
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : undefined,
        graduate_final: graduateFinal,
      }
      const qs = Object.entries(payload)
        .map(([k, v]) => {
          if (Array.isArray(v)) return v.map((x) => `${k}[]=${encodeURIComponent(x)}`).join('&')
          if (v === undefined || v === null) return null
          return `${k}=${encodeURIComponent(v)}`
        })
        .filter(Boolean)
        .join('&')
      const r = await request(`/api/rollover/promotion/apply${qs ? '?' + qs : ''}`, { method: 'POST', data: {} })
      toast.success(t('promotionApplied'))
      setPromoList(r.data || r)
      setStep(3)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingApply(false)
    }
  }

  const stepLabel = (i) => t(STEPS[i])

  return (
    <>
      <Head kicker={t('calendar')} title={t('rollover')} sub={t('rolloverSub')} />
      <div className="card" style={{ padding: 22, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <Badge key={s} tone={i === step ? 'vio' : 'cy'}>
              {i + 1}. {t(s)}
            </Badge>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div className="grid grid-2" style={{ gap: 14, maxWidth: 600 }}>
            <Field label={t('semesterToClose')} error={errors?.semester_id?.[0]}>
              <select className="input" value={fromSemesterId} onChange={(e) => setFromSemesterId(e.target.value)}>
                <option value="">{t('selectSemesterToClose')}</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.academic_year}) {s.is_active ? '(active)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Btn loading={loadingClose} onClick={loadClosePreview} disabled={!fromSemesterId}>
              {t('closePreview')}
            </Btn>
            <Btn loading={loadingClose} variant="danger" onClick={confirmClose} disabled={!fromSemesterId}>
              {t('confirmCloseSemester')}
            </Btn>
          </div>
          {closedSummary && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
              <div className="stat">
                <div className="stat-num">{closedSummary.grades_to_lock ?? 0}</div>
                <div className="stat-lbl">{t('gradesToLock')}</div>
              </div>
              <div className="stat">
                <div className="stat-num">{closedSummary.enrollments_completed ?? 0}</div>
                <div className="stat-lbl">{t('enrollmentsCompleted')}</div>
              </div>
              <div className="stat">
                <div className="stat-num">{closedSummary.enrollments_failed ?? 0}</div>
                <div className="stat-lbl">{t('enrollmentsFailed')}</div>
              </div>
              <div className="stat">
                <div className="stat-num">{closedSummary.unresolved_count ?? 0}</div>
                <div className="stat-lbl">{t('unresolvedCount')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>{t('unresolvedEnrollments')}</div>
            <Btn size="sm" variant="soft" loading={loadingClose} onClick={loadUnresolved}>
              {t('refresh')}
            </Btn>
          </div>
          <DataTable
            columns={[
              { key: 'student_name', label: t('student') },
              { key: 'course_code', label: t('code') },
              { key: 'course_name', label: t('course') },
              { key: 'reason', label: t('reason') },
            ]}
            rows={unresolved}
            empty={
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('noUnresolved')}</div>
                <div style={{ color: 'var(--muted)' }}>{t('noUnresolvedSub')}</div>
              </div>
            }
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Btn onClick={() => setStep(2)}>{t('stepPreviewPromotion')}</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 22 }}>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label={t('levelFilters')}>
              <select
                className="input"
                multiple
                value={selectedLevelIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                  setSelectedLevelIds(opts)
                }}
              >
                {levels.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('exclusions')}>
              <input
                className="input"
                value={exclude}
                onChange={(e) => setExclude(e.target.value)}
                placeholder="e.g. 5,7"
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={graduateFinal} onChange={(e) => setGraduateFinal(e.target.checked)} />
              {t('graduateFinal')}
            </label>
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn loading={loadingPreview} onClick={loadPromo}>
              {t('loadPreview')}
            </Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: 22 }}>
          <DataTable
            columns={[
              { key: 'name', label: t('student') },
              { key: 'from_level', label: t('fromLevel') },
              { key: 'to_level', label: t('toLevel') },
              { key: 'from_semester', label: t('fromSemesterTerm') },
              { key: 'to_semester', label: t('toSemesterTerm') },
              { key: 'action', label: t('action'), render: (r) => <Badge tone="cy">{t(r.action)}</Badge> },
            ]}
            rows={promoList}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Btn loading={loadingApply} onClick={applyPromo} variant="danger">
              {t('applyPromotion')}
            </Btn>
          </div>
        </div>
      )}
    </>
  )
}
