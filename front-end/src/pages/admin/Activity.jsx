import { Fragment, useState } from 'react'
import { Badge, Btn, CourseLoader, Empty, Pager } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { Head, SearchBar, useDebounced, useList } from './_shared'

const ACTION_META = {
  created: { key: 'actionCreated', tone: 'grn' },
  updated: { key: 'actionUpdated', tone: 'cy' },
  deleted: { key: 'actionDeleted', tone: 'amb' },
  restored: { key: 'actionRestored', tone: 'vio' },
  force_deleted: { key: 'actionForceDeleted', tone: 'red' },
  login: { key: 'actionLogin', tone: 'grn' },
  login_failed: { key: 'actionLoginFailed', tone: 'red' },
  logout: { key: 'actionLogout', tone: '' },
  status_changed: { key: 'actionStatusChanged', tone: 'amb' },
  access_request_accepted: { key: 'actionAccessRequestAccepted', tone: 'grn' },
  access_request_refused: { key: 'actionAccessRequestRefused', tone: 'amb' },
  admin_created: { key: 'actionAdminCreated', tone: 'grn' },
  admin_updated: { key: 'actionAdminUpdated', tone: 'cy' },
  admin_deleted: { key: 'actionAdminDeleted', tone: 'red' },
  password_reset: { key: 'actionPasswordReset', tone: 'amb' },
  password_changed: { key: 'actionPasswordChanged', tone: 'cy' },
  enrollment_status_changed: { key: 'actionEnrollmentStatusChanged', tone: 'amb' },
  settings_updated: { key: 'actionSettingsUpdated', tone: 'cy' },
  ai_override: { key: 'actionAiOverride', tone: 'vio' },
}

const ACTION_OPTIONS = Object.keys(ACTION_META)

const SUBJECT_META = {
  User: 'subjectUser',
  Course: 'subjectCourse',
  Department: 'subjectDepartment',
  Grade: 'subjectGrade',
  Payment: 'subjectPayment',
  Event: 'subjectEvent',
  Schedule: 'subjectSchedule',
  Lecture: 'subjectLecture',
  Quiz: 'subjectQuiz',
  Attendance: 'subjectAttendance',
  StudentCourse: 'subjectEnrollment',
  Semester: 'subjectSemester',
}

const SUBJECT_OPTIONS = Object.keys(SUBJECT_META)

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  if (v === true) return 'true'
  if (v === false) return 'false'
  return String(v)
}

function Details({ properties, t }) {
  if (!properties || !Object.keys(properties).length) {
    return <p style={{ color: 'var(--muted)' }}>{t('noDetails')}</p>
  }

  const attrs = properties.attributes
  const old = properties.old

  if (attrs && typeof attrs === 'object') {
    const keys = Object.keys(attrs)
    if (!keys.length) return <p style={{ color: 'var(--muted)' }}>{t('noDetails')}</p>
    const hasOld = old && typeof old === 'object'
    return (
      <table className="table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'start' }}>{t('changedFields')}</th>
            {hasOld ? <th style={{ textAlign: 'start' }}>{t('previousValue')}</th> : null}
            <th style={{ textAlign: 'start' }}>{hasOld ? t('newValue') : t('fieldValue')}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td style={{ textAlign: 'start' }}>{k}</td>
              {hasOld ? <td style={{ textAlign: 'start', color: 'var(--muted)' }}>{fmt(old[k])}</td> : null}
              <td style={{ textAlign: 'start' }}>{fmt(attrs[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <table className="table" style={{ marginTop: 8 }}>
      <tbody>
        {Object.entries(properties).map(([k, v]) => (
          <tr key={k}>
            <td style={{ textAlign: 'start', color: 'var(--muted)' }}>{k}</td>
            <td style={{ textAlign: 'start' }}>{fmt(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AdminActivity() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [actorType, setActorType] = useState('')
  const [subjectType, setSubjectType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openId, setOpenId] = useState(null)
  const search = useDebounced(q)

  const buildPath = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (action) params.set('action', action)
    if (actorType) params.set('actor_type', actorType)
    if (subjectType) params.set('subject_type', subjectType)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return `/api/activity/get/all${qs ? `?${qs}` : ''}`
  }

  const { paged, loading } = useList(buildPath(), page, [search, action, actorType, subjectType, from, to])

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const clearFilters = () => {
    setQ('')
    setAction('')
    setActorType('')
    setSubjectType('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const hasFilters = q || action || actorType || subjectType || from || to

  return (
    <>
      <Head kicker={t('activityKicker')} title={t('activityTitle')} sub={t('activitySub')} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        <SearchBar value={q} onChange={reset(setQ)} placeholder={t('searchActivityPh')} style={{ maxWidth: 380, flex: '1 1 240px' }} />
        <select className="input" style={{ maxWidth: 220 }} value={action} onChange={(e) => reset(setAction)(e.target.value)}>
          <option value="">{t('allActions')}</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{t(ACTION_META[a].key)}</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={actorType} onChange={(e) => reset(setActorType)(e.target.value)}>
          <option value="">{t('allActors')}</option>
          <option value="admin">{t('actorAdmin')}</option>
          <option value="user">{t('actorUser')}</option>
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={subjectType} onChange={(e) => reset(setSubjectType)(e.target.value)}>
          <option value="">{t('allSubjects')}</option>
          {SUBJECT_OPTIONS.map((s) => (
            <option key={s} value={s}>{t(SUBJECT_META[s])}</option>
          ))}
        </select>
        <input type="date" className="input" style={{ maxWidth: 170 }} value={from} aria-label={t('filterFrom')} onChange={(e) => reset(setFrom)(e.target.value)} />
        <input type="date" className="input" style={{ maxWidth: 170 }} value={to} aria-label={t('filterTo')} onChange={(e) => reset(setTo)(e.target.value)} />
        {hasFilters ? (
          <Btn variant="ghost" onClick={clearFilters}>{t('clearFilters')}</Btn>
        ) : null}
      </div>

      {loading ? (
        <CourseLoader label={t('loadingRecords')} />
      ) : !paged.items.length ? (
        <Empty icon="info" title={t('noActivity')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ textAlign: 'start' }}>{t('colWhen')}</th>
                <th style={{ textAlign: 'start' }}>{t('colActor')}</th>
                <th style={{ textAlign: 'start' }}>{t('colAction')}</th>
                <th style={{ textAlign: 'start' }}>{t('colSubject')}</th>
                <th style={{ textAlign: 'start' }}>{t('colIp')}</th>
                <th style={{ textAlign: 'end' }}>{t('colDetails')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.items.map((r) => {
                const open = openId === r.id
                const meta = ACTION_META[r.action]
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ textAlign: 'start' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                      <td style={{ textAlign: 'start' }}>
                        {r.actor
                          ? <span>{r.actor.name} <Badge tone={r.actor.type === 'admin' ? 'vio' : 'cy'}>{r.actor.type === 'admin' ? t('actorAdmin') : t('actorUser')}</Badge></span>
                          : <span style={{ color: 'var(--muted)' }}>{t('actorSystem')}</span>}
                      </td>
                      <td style={{ textAlign: 'start' }}>
                        <Badge tone={meta?.tone}>{meta ? t(meta.key) : r.action}</Badge>
                      </td>
                      <td style={{ textAlign: 'start' }}>
                        {r.subject ? <span>{t(SUBJECT_META[r.subject.type]) || r.subject.type} #{r.subject.id}</span> : '—'}
                      </td>
                      <td style={{ textAlign: 'start' }}>{r.ip_address || '—'}</td>
                      <td style={{ textAlign: 'end' }}>
                        <Btn
                          size="sm"
                          variant="soft"
                          onClick={() => setOpenId(open ? null : r.id)}
                          title={open ? t('hideDetails') : t('showDetails')}
                        >
                          {open ? t('hideDetails') : t('showDetails')}
                        </Btn>
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--surface-2, transparent)' }}>
                          <Details properties={r.properties} t={t} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
    </>
  )
}
