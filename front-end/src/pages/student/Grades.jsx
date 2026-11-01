import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Modal, Prog, RateBadge, Reveal, Ring, Spinner, useToast } from '../../lib/ui'
import { Head } from './_shared'

function AppealStatus({ status }) {
  const { t } = useI18n()
  const tone = { pending: 'amb', accepted: 'grn', rejected: 'red' }[status] || ''
  const label = { pending: t('status_pending'), accepted: t('status_accepted'), rejected: t('status_refused') }[status] || status
  return <Badge tone={tone} dot>{label}</Badge>
}

function fmtMark(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value ?? '—'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

function SemesterCard({ card, index, onAppeal, t }) {
  const courses = card.courses || []
  const credits = courses.reduce((sum, row) => sum + (Number(row.credit_hours) || 0), 0)
  const final = card.final_score || {}
  const isFixed = final.type === 'fixed_term'

  return (
    <Reveal className="card std-sem" delay={index * 0.06}>
      <div className="std-sem-head">
        <div>
          <span className="std-sem-term">{card.semester?.academic_year}</span>
          <h3>{card.semester?.name}</h3>
          <span className="std-sem-system">
            {card.semester?.grading_system === 'fixed_term' ? t('gradingFixedTermSystem') : t('gradingGpaSystem')}
          </span>
        </div>
        <div className="std-sem-score">
          <span>{t('gradesSemesterResult')}</span>
          <strong>{isFixed ? `${final.percentage ?? '—'}%` : (final.gpa ?? '—')}</strong>
          {final.rate ? <RateBadge rate={final.rate} /> : null}
        </div>
      </div>

      <div className="std-sem-meta">
        <Badge tone="vio">{t('gradesCourseCount', { n: courses.length })}</Badge>
        <Badge>{t('creditHours')}: {credits}</Badge>
      </div>

      <div className="std-grade-list">
        {courses.map((row) => (
          <article className="std-grade-row" key={row.course_id}>
            <div className="std-grade-id">
              <strong>{row.course_name}</strong>
              <span>{row.course_code || '—'} · {t('creditHrs', { n: row.credit_hours })}</span>
            </div>

            <div className="std-grade-mark">
              <span>{t('marks')}</span>
              <strong>{fmtMark(row.marks)}/{fmtMark(row.max_marks)}</strong>
            </div>

            <div className="std-grade-pct">
              <div className="std-grade-pct-top">
                <span>{row.percentage}%</span>
                {row.status === 'locked' ? <Badge>{t('statusLocked')}</Badge> : null}
              </div>
              <Prog value={row.percentage} sm />
            </div>

            <div className="std-grade-rate">
              <RateBadge rate={row.rate} />
            </div>

            <Btn
              size="sm"
              variant="soft"
              icon="mail"
              title={row.grade_id == null ? t('appealUnavailable') : t('appealGrade')}
              aria-label={`${t('appealGrade')}: ${row.course_name}`}
              onClick={() => onAppeal(row)}
            />

            <div className="std-components">
              <span className="std-components-label">{t('gradesBreakdown')}</span>
              {row.components?.length ? (
                <div className="std-chips">
                  {row.components.map((comp, ci) => (
                    <Badge key={ci} tone="vio">
                      {comp.name} · {comp.weight}% · {comp.marks != null ? `${fmtMark(comp.marks)}/${fmtMark(comp.max_marks)}` : t('notGraded')}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="std-components-none">{t('gradesNoComponents')}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </Reveal>
  )
}

export function StudentGrades() {
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
  const hasResults = cards.some((card) => (card.courses || []).length > 0)

  const openAppeal = (row) => {
    if (row.grade_id == null) {
      toast.error(t('appealUnavailable'))
      return
    }
    setAppealRow(row)
    setReason('')
    setReasonError('')
  }

  const submitAppeal = async () => {
    if (appealRow?.grade_id == null) {
      setReasonError(t('appealUnavailable'))
      return
    }
    setBusy(true)
    setReasonError('')
    try {
      await request('/api/user/grade/appeal', {
        method: 'POST',
        data: { grade_id: appealRow.grade_id, reason },
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
      <Head kicker={t('gradesKicker')} title={t('gradesPageTitle')} sub={t('gradesPageSub')} />

      <Reveal className="std-hero std-hero--grades">
        <div className="std-hero-body">
          <span className="std-eyebrow">{t('gradesKicker')}</span>
          <h2 className="std-hero-title">{t('cumulativeGpa')}</h2>
          <div className="std-hero-score">
            <strong>{overall.cumulative_gpa ?? '—'}</strong>
            <span>/ 4.0</span>
            {overall.rate ? <RateBadge rate={overall.rate} /> : null}
          </div>
          <p className="std-hero-note">{t('gradesNote')}</p>
        </div>

        <div className="std-hero-ring">
          <Ring
            value={overall.cumulative_gpa || 0}
            max={4}
            size={132}
            label={overall.cumulative_gpa ?? '—'}
            sub={t('cgpa')}
          />
        </div>

        <dl className="std-hero-stats">
          <div>
            <dt>{t('gradedCourses')}</dt>
            <dd>{overall.total_graded_courses ?? 0}</dd>
          </div>
          <div>
            <dt>{t('creditHours')}</dt>
            <dd>{overall.total_credit_hours ?? 0}</dd>
          </div>
          <div>
            <dt>{t('gradesStanding')}</dt>
            <dd>{overall.rate || '—'}</dd>
          </div>
        </dl>
      </Reveal>

      {hasResults ? (
        <div className="std-sem-grid">
          {cards.map((card, index) => (
            <SemesterCard
              key={card.semester?.id ?? index}
              card={card}
              index={index}
              onAppeal={openAppeal}
              t={t}
            />
          ))}
        </div>
      ) : (
        <Reveal className="card">
          <Empty icon="award" title={t('noResultsYet')} sub={t('noResultsYetSub')} />
        </Reveal>
      )}

      <Reveal className="card std-appeals" delay={0.05}>
        <div className="card-head">
          <div>
            <h3>{t('myAppeals')}</h3>
            <p className="std-card-sub">{t('myAppealsSub')}</p>
          </div>
          <Link to="/app/student/attendance" className="home-link">
            {t('attendanceProgress')}
            <I name="chevron" size={14} />
          </Link>
        </div>

        {appeals.length ? (
          <div className="std-appeal-list">
            {appeals.map((a) => (
              <article className="std-appeal" key={a.id}>
                <div className="std-appeal-head">
                  <strong>{a.course || '—'}</strong>
                  <div>
                    <AppealStatus status={a.status} />
                    <span className="std-appeal-date">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
                <p className="std-appeal-reason">{a.reason}</p>
                {a.response_note ? (
                  <div className="std-appeal-response">
                    <span>{t('responseNote')}</span>
                    {a.response_note}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <Empty icon="mail" title={t('noAppeals')} sub={t('noAppealsSub')} />
        )}
      </Reveal>

      <Modal
        open={Boolean(appealRow)}
        onClose={() => setAppealRow(null)}
        title={t('appealThisGrade')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAppealRow(null)}>{t('cancel')}</Btn>
            <Btn loading={busy} onClick={submitAppeal} icon="check" disabled={!reason || appealRow?.grade_id == null}>{t('submitAppeal')}</Btn>
          </>
        }
      >
        {appealRow ? (
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ fontWeight: 600 }}>{appealRow.course_name}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 6 }}>
              {fmtMark(appealRow.marks)}/{fmtMark(appealRow.max_marks)} · {appealRow.percentage}%
            </div>
          </div>
        ) : null}
        <Field label={t('appealReason')} hint={t('appealReasonHint')} error={reasonError}>
          <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  )
}
