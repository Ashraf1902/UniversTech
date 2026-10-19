import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Modal, Pager, Reveal, Spinner, useToast } from '../../lib/ui'
import { DemoBanner, Head, money } from './_shared'

const STATUS_META = {
  paid: { tone: 'grn', key: 'status_paid' },
  waived: { tone: 'cy', key: 'status_waived' },
  refunded: { tone: 'amb', key: 'status_refunded' },
  failed: { tone: 'red', key: 'status_failed' },
  pending: { tone: '', key: 'status_pending' },
}

function StatusBadge({ status }) {
  const { t } = useI18n()
  const meta = STATUS_META[status] || STATUS_META.pending
  return <Badge tone={meta.tone} dot>{t(meta.key)}</Badge>
}

export function StudentPayments() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const { data, loading, error, run } = useAsync(() => request(`/api/user/payments?page=${page}`), [page])
  const paged = normalizePage(data)

  const [receipt, setReceipt] = useState(null)
  const [receiptBusy, setReceiptBusy] = useState(false)

  const viewReceipt = async (payment) => {
    setReceiptBusy(true)
    try {
      const data = await request(`/api/user/payment/${payment.id}/receipt`)
      setReceipt(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReceiptBusy(false)
    }
  }

  const printReceipt = () => {
    if (!receipt) return
    const rows = (receipt.line_items || [])
      .map((li) => `<tr><td>${li.label}</td><td style="text-align:right">${money(li.amount)}</td></tr>`)
      .join('')
    const html = `<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${receipt.receipt_number}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;padding:32px;max-width:640px;margin:auto}
h1{font-size:1.3rem}table{width:100%;border-collapse:collapse;margin:18px 0}
td,th{border-bottom:1px solid #ddd;padding:8px 4px;font-size:.9rem}
.meta{color:#555;font-size:.85rem}.total{font-weight:700}</style></head>
<body>
<h1>${t('receiptTitle')}</h1>
<div class="meta">${t('receiptNumber')}: ${receipt.receipt_number}</div>
<div class="meta">${t('issuedOn')}: ${new Date(receipt.issued_at).toLocaleString()}</div>
<div class="meta">${t('student')}: ${receipt.student?.name || ''}</div>
<table><thead><tr><th>${t('description')}</th><th style="text-align:right">${t('amount')}</th></tr></thead>
<tbody>${rows}<tr class="total"><td>${t('total')}</td><td style="text-align:right">${money(receipt.amount)}</td></tr></tbody></table>
<div class="meta">${t('status')}: ${receipt.status}</div>
</body></html>`
    const win = window.open('', '_blank', 'width=720,height=800')
    if (!win) {
      toast.error(t('popupBlocked'))
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <>
      <Head kicker={t('billing')} title={t('myPayments')} sub={t('paymentsSub')} />

      <DemoBanner />

      {loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('receiptNumber')}</th>
                  <th>{t('type')}</th>
                  <th>{t('semester')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('status')}</th>
                  <th>{t('date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-main">{p.receipt_number || '—'}</td>
                    <td>{p.type === 'courses' ? t('typeCourses') : t('typeYear')}</td>
                    <td>{p.semester?.name || '—'}</td>
                    <td>{money(p.amount)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        {p.has_receipt ? (
                          <Btn size="sm" variant="soft" icon="file" loading={receiptBusy} onClick={() => viewReceipt(p)}>{t('viewReceipt')}</Btn>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty
          icon="wallet"
          title={t('noPayments')}
          sub={t('noPaymentsSub')}
          action={<Link to="/app/student/courses"><Btn icon="wallet">{t('unlockCourses')}</Btn></Link>}
        />
      )}

      {error && !paged.items.length ? (
        <div className="form-alert" role="alert" style={{ marginTop: 16 }}>{error.message}</div>
      ) : null}

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title={t('receiptTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setReceipt(null)}>{t('close')}</Btn>
            <Btn icon="file" onClick={printReceipt}>{t('printReceipt')}</Btn>
          </>
        }
      >
        {receipt ? (
          <Reveal>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--muted)' }}>{t('receiptNumber')}</span>
              <strong>{receipt.receipt_number}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--muted)' }}>{t('issuedOn')}</span>
              <span>{new Date(receipt.issued_at).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--muted)' }}>{t('student')}</span>
              <span>{receipt.student?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--muted)' }}>{t('status')}</span>
              <StatusBadge status={receipt.status} />
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>{t('description')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th></tr></thead>
                <tbody>
                  {(receipt.line_items || []).map((li, i) => (
                    <tr key={i}><td>{li.label}</td><td style={{ textAlign: 'right' }}>{money(li.amount)}</td></tr>
                  ))}
                  <tr><td style={{ fontWeight: 700 }}>{t('total')}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(receipt.amount)}</td></tr>
                </tbody>
              </table>
            </div>
          </Reveal>
        ) : null}
      </Modal>
    </>
  )
}
