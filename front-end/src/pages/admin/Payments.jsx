import { useState } from 'react'
import { buildQuery, normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Field, Modal, Pager, Spinner, useToast } from '../../lib/ui'
import { Head, SearchBar, useDebounced, useFieldErrors } from './_shared'

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

export function AdminPayments() {
  const { t } = useI18n()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState({ status: '', type: '' })
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const payments = useAsync(
    () => request('/api/payment/get/all' + buildQuery({ ...filter, search: debounced, page })),
    [filter, debounced, page],
  )
  const paged = normalizePage(payments.data)

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ status: 'paid', reason: '' })
  const [busy, setBusy] = useState(false)

  const openOverride = (payment) => {
    setTarget(payment)
    setForm({ status: payment.status === 'paid' ? 'refunded' : 'paid', reason: '' })
    clearErrors()
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      await request('/api/payment/override', {
        method: 'POST',
        data: { payment_id: target.id, status: form.status, reason: form.reason },
      })
      toast.success(t('paymentOverridden'))
      setOpen(false)
      payments.run().catch(() => {})
    } catch (e) {
      if (!applyErrors(e)) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head kicker={t('billing')} title={t('rolePayments')} sub={t('aPaymentsSub')} />

      <div className="card" style={{ marginBottom: 22, maxWidth: 900 }}>
        <div className="grid grid-3">
          <Field label={t('status')}>
            <select className="select" value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1) }}>
              <option value="">{t('allStatuses')}</option>
              <option value="paid">{t('status_paid')}</option>
              <option value="waived">{t('status_waived')}</option>
              <option value="refunded">{t('status_refunded')}</option>
              <option value="pending">{t('status_pending')}</option>
              <option value="failed">{t('status_failed')}</option>
            </select>
          </Field>
          <Field label={t('type')}>
            <select className="select" value={filter.type} onChange={(e) => { setFilter({ ...filter, type: e.target.value }); setPage(1) }}>
              <option value="">{t('allTypes')}</option>
              <option value="courses">{t('typeCourses')}</option>
              <option value="year">{t('typeYear')}</option>
            </select>
          </Field>
          <Field label={t('search')}>
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder={t('searchPaymentsPh')} />
          </Field>
        </div>
      </div>

      {payments.loading ? (
        <Spinner size={24} />
      ) : paged.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('type')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('status')}</th>
                  <th>{t('receiptNumber')}</th>
                  <th>{t('date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-main">{p.student || '—'}</td>
                    <td>{p.type === 'courses' ? t('typeCourses') : t('typeYear')}</td>
                    <td>{Number(p.amount).toLocaleString()}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.receipt_number || '—'}</td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        <Btn size="sm" variant="soft" icon="edit" title={t('overridePayment')} onClick={() => openOverride(p)} />
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
        <div className="empty">
          <h3>{t('noPayments')}</h3>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('overridePayment')}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Btn><Btn loading={busy} onClick={submit} icon="check" disabled={form.reason.trim().length < 3}>{t('applyOverride')}</Btn></>}
      >
        {target ? (
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ fontWeight: 600 }}>{target.student} · {target.type === 'courses' ? t('typeCourses') : t('typeYear')}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 6 }}>
              {Number(target.amount).toLocaleString()} · <StatusBadge status={target.status} />
            </div>
          </div>
        ) : null}
        <Field label={t('overrideStatus')}>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="paid">{t('status_paid')}</option>
            <option value="waived">{t('status_waived')}</option>
            <option value="refunded">{t('status_refunded')}</option>
          </select>
        </Field>
        <Field label={t('overrideReason')} hint={t('overrideReasonHint')} error={errors?.reason?.[0]}>
          <textarea className="input" rows={4} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
      </Modal>
    </>
  )
}
