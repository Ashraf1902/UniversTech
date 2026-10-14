import { Fragment, useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, Modal, Prog, RateBadge, Reveal, Ring, Spinner, useToast } from '../../lib/ui'
import { Head } from './_shared'

function AppealStatus({ status }) {
  const { t } = useI18n()
  const tone = { pending: 'amb', accepted: 'grn', rejected: 'red' }[status] || ''
  const label = { pending: t('status_pending'), accepted: t('status_accepted'), rejected: t('status_refused') }[status] || status
  return <Badge tone={tone} dot>{label}</Badge>
}

export function StudentReports() {
  const { t } = useI18n()
  const toast = useToast()
  const { data, loading, run } = useAsync(() => request('/api/user/reports'))
  const appealsRes = useAsync(() => request('/api/user/grade/appeals'))
  const appeals = normalizePage(appealsRes.data).items

  const [appealRow, setAppealRow] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [reasonError, setReasonError] = useState('')

  if (loading) return <Spinner size={26} />
  const overall = data?.overall || {}
  const cards = data?.semester_cards || []
  const courses = data?.courses || []

  const submitAppeal = async () => {
    setBusy(true)
    setReasonError('')
    try {
      await request('/api/user/grade/appeal', {
        method: 'POST',
        data: { grade_id: appealRow.id, reason },
      })
      toast.success(t('appealSubmitted'))
      setAppealRow(null)
      setReason('')
      run().catch(() => {})
      appealsRes.run().catch(() => {})
    } catch (e) {
      const fe = e?.payload?.data
      const msg = fe && typeof fe === 'object' ? (fe.reason?.[0] || fe.grade_id?.[0]) : null
      if (msg) setReasonError(msg)
      else toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker={t('performance')} title={t('reportsTitle')} sub={t('reportsSub')} />

      <Reveal className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gpa-meter">
            <Ring value={overall.cumulative_gpa || 0} max={4} size={104} label={overall.cumulative_gpa ?? '—'} sub={t('cgpa')} />
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{t('cumulativeGpa')}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>{overall.cumulative_gpa ?? '—'} / 4.0</div>
              {overall.rate ? <RateBadge rate={overall.rate} /> : null}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('gradedCourses')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_graded_courses ?? 0}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('creditHours')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_credit_hours ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        {cards.length ? (
          cards.map((c, i) => (
            <Reveal key={c.semester?.id ?? i} className="card" delay={i * 0.08}>
              <div className="card-head">
                <div>
                  <h3 style={{ marginBottom: 4 }}>{c.semester?.name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                    {c.semester?.academic_year} · {c.semester?.grading_system === 'fixed_term' ? t('gradingFixedTermSystem') : t('gradingGpaSystem')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem' }}>
                    {c.final_score?.type === 'fixed_term' ? `${c.final_score?.percentage}%` : c.final_score?.gpa}
                  </div>
                  <RateBadge rate={c.final_score?.rate} />
                </div>
              </div>
              <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
                <table className="table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>{t('subject')}</th>
                      <th>{t('marks')}</th>
                      <th>{t('percent')}</th>
                      <th style={{ textAlign: 'right' }}>{t('rate')}</th>
                      <th style={{ textAlign: 'right' }}>{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.courses || []).map((row) => (
                      <Fragment key={row.course_id}>
                        <tr>
                          <td className="cell-main">{row.course_name}<div style={{ fontSize: '0.74rem', color: 'var(--faint)', fontWeight: 400 }}>{row.course_code} · {t('crHours', { n: row.credit_hours })}</div></td>
                          <td>{row.marks}/{row.max_marks}</td>
                          <td style={{ minWidth: 110 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Prog value={row.percentage} sm />
                              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', minWidth: 36 }}>{row.percentage}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}><RateBadge rate={row.rate} /></td>
                          <td style={{ textAlign: 'right' }}>
                            <Btn size="sm" variant="soft" icon="mail" title={t('appealGrade')} onClick={() => { setAppealRow(row); setReason(''); setReasonError('') }} />
                          </td>
                        </tr>
                        {row.components?.length ? (
                          <tr>
                            <td colSpan={5} style={{ paddingTop: 0 }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px 0 8px' }}>
                                {row.components.map((comp, ci) => (
                                  <Badge key={ci} tone="vio">
                                    {comp.name} · {comp.weight}% · {comp.marks != null ? `${comp.marks}/${comp.max_marks}` : t('notGraded')}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          ))
        ) : (
          <Reveal className="card" style={{ gridColumn: '1 / -1' }}>
            <Empty icon="award" title={t('noResultsYet')} sub={t('noResultsYetSub')} />
          </Reveal>
        )}
      </div>

      <Reveal className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h3>{t('myAppeals')}</h3>
        </div>
        {appeals.length ? (
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table">
              <thead>
                <tr><th>{t('course')}</th><th>{t('appealReason')}</th><th>{t('status')}</th><th>{t('responseNote')}</th><th style={{ textAlign: 'right' }}>{t('submittedOn')}</th></tr>
              </thead>
              <tbody>
                {appeals.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-main">{a.course || '—'}</td>
                    <td style={{ maxWidth: 320 }}>{a.reason}</td>
                    <td><AppealStatus status={a.status} /></td>
                    <td style={{ maxWidth: 320 }}>{a.response_note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="mail" title={t('noAppeals')} sub={t('noAppealsSub')} />
        )}
      </Reveal>

      <Reveal className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h3>{t('attendanceProgress')}</h3>
        </div>
        {courses.length ? (
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table">
              <thead>
                <tr><th>{t('course')}</th><th>{t('progress')}</th><th>{t('presentCol')}</th><th>{t('absentCol')}</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const pct = c.total_lectures ? Math.round((c.progress / c.total_lectures) * 100) : 0
                  return (
                    <tr key={c.course_name}>
                      <td className="cell-main">{c.course_name}</td>
                      <td style={{ minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Prog value={pct} tone="cy" sm />
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{pct}%</span>
                        </div>
                      </td>
                      <td><Badge tone="grn">{c.present}</Badge></td>
                      <td><Badge tone={c.absent ? 'red' : ''}>{c.absent}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="chart" title={t('noDataYet')} />
        )}
      </Reveal>

      <Modal
        open={Boolean(appealRow)}
        onClose={() => setAppealRow(null)}
        title={t('appealThisGrade')}
        footer={<><Btn variant="ghost" onClick={() => setAppealRow(null)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submitAppeal} icon="check" disabled={!reason}>{t('submitAppeal')}</Btn></>}
      >
        {appealRow ? (
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ fontWeight: 600 }}>{appealRow.course_name}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 6 }}>{appealRow.marks}/{appealRow.max_marks} · {appealRow.percentage}%</div>
          </div>
        ) : null}
        <Field label={t('appealReason')} hint={t('appealReasonHint')} error={reasonError}>
          <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  )
}
