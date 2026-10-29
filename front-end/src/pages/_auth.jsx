import { Brand } from '../lib/Brand'
import { useI18n } from '../lib/i18n'
import { I } from '../lib/ui'

/* Shared shell for the sign-in and password-reset screens.
   Left: the indigo campus panel with a weekly-timetable motif and gold lecture
   blocks. Right: the form, set on a paper-like surface. At tablet size the
   panel folds into a short banner above the form. */

const MOTIF_DAYS = ['S', 'S', 'M', 'T', 'W', 'T']

const MOTIF_BLOCKS = [
  { col: 1, row: 2, span: 2, time: '09:00', label: 'LEC' },
  { col: 3, row: 1, span: 2, time: '11:00', label: 'SEC' },
  { col: 2, row: 4, span: 2, time: '13:00', label: 'LEC' },
  { col: 5, row: 2, span: 3, time: '10:00', label: 'LAB' },
  { col: 4, row: 5, span: 1, time: '14:00', label: 'LEC' },
  { col: 6, row: 1, span: 2, time: '09:00', label: 'SEC' },
]

export function TimetableMotif() {
  const { t } = useI18n()

  return (
    <div className="auth-motif" aria-hidden="true">
      <div className="auth-motif-head">
        <span className="auth-motif-live">
          <span className="auth-motif-dot" />
          {t('currentWeek')}
        </span>
        <span className="auth-motif-days">6</span>
      </div>
      <div className="auth-motif-grid">
        {MOTIF_DAYS.map((day, i) => (
          <span key={i} className="auth-motif-day">
            {day}
          </span>
        ))}
        <div className="auth-motif-lines">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        {MOTIF_BLOCKS.map((block, i) => (
          <span
            key={i}
            className={`auth-motif-block ${i === 1 ? 'is-open' : ''}`}
            style={{ gridColumn: block.col, gridRow: `${block.row} / span ${block.span}` }}
          >
            <b>{block.time}</b>
            <small>{block.label}</small>
          </span>
        ))}
      </div>
      <div className="auth-motif-foot">
        <span className="auth-next-chip">
          <I name="clock" size={14} />
          {t('authNextUp')} · 09:00
        </span>
        <span className="auth-motif-note">{t('authTimetableNote')}</span>
      </div>
    </div>
  )
}

export function AuthShell({ children, asideExtra }) {
  const { t } = useI18n()

  return (
    <div className="auth">
      <aside className="auth-visual">
        <div className="auth-visual-inner">
          <div className="auth-visual-top">
            <Brand size="lg" />
            <span className="auth-term">{t('activeTerm')}</span>
          </div>
          <div className="auth-visual-copy">
            <span className="auth-eyebrow">{t('authPanelEyebrow')}</span>
            <h1>
              {t('heroTitle')} <span className="auth-spot">{t('heroSpot')}</span>
            </h1>
            <p>{t('authPanelLead')}</p>
          </div>
          <TimetableMotif />
          {asideExtra ? <div className="auth-aside-extra">{asideExtra}</div> : null}
        </div>
      </aside>

      <main className="auth-form">
        <div className="auth-paper">
          {children}
        </div>
      </main>
    </div>
  )
}

/* Input with a leading icon and optional trailing control (password toggle). */
export function AuthInput({ icon, trailing, className = '', ...rest }) {
  return (
    <span className="input-wrap">
      {icon ? (
        <span className="input-ico">
          <I name={icon} size={17} />
        </span>
      ) : null}
      <input
        className={`input ${icon ? 'has-ico' : ''} ${trailing ? 'has-trail' : ''} ${className}`.trim()}
        {...rest}
      />
      {trailing ? <span className="input-trail">{trailing}</span> : null}
    </span>
  )
}

export function AuthAlert({ tone = 'error', children }) {
  return (
    <div className={`auth-alert ${tone}`} role="alert">
      <I name={tone === 'error' ? 'info' : 'check'} size={16} />
      <span>{children}</span>
    </div>
  )
}

/* Pull the Laravel 422 field bag out of an ApiError. */
export function errorFields(err) {
  const data = err?.payload?.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const bag = data.errors && typeof data.errors === 'object' ? data.errors : data
    const out = {}
    Object.entries(bag).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length) out[key] = String(value[0])
      else if (typeof value === 'string' && value) out[key] = value
    })
    return out
  }
  const errors = err?.payload?.errors
  if (errors && typeof errors === 'object') {
    const out = {}
    Object.entries(errors).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length) out[key] = String(value[0])
    })
    return out
  }
  return null
}
