import { useI18n } from '../../lib/i18n'
import { useDemoMode } from '../../lib/hooks'
import { I } from '../../lib/ui'

export const money = (n) => `EGP ${Number(n || 0).toLocaleString()}`

export function Head({ kicker, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {sub ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function DemoBanner() {
  const { t } = useI18n()
  const demo = useDemoMode()
  if (!demo) return null
  return (
    <div className="card" role="status" data-testid="payment-demo-banner" style={{ marginBottom: 18, borderColor: 'var(--amb, #d69e2e)' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className="fic" style={{ marginBottom: 0, width: 42, height: 42 }}>
          <I name="info" size={20} />
        </span>
        <strong style={{ fontSize: '0.95rem' }}>{t('paymentDemoBanner')}</strong>
      </div>
    </div>
  )
}
