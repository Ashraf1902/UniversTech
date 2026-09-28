import { createContext, cloneElement, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react'

/* ---------------- ICONS ---------------- */
const PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  chart: <path d="M12 20V10M18 20V4M6 20v-4" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  menu: <path d="M3 12h18M3 6h18M3 18h18" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  edit: <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  file: (
    <>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  down: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  layers: (
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </>
  ),
  trend: (
    <>
      <path d="m23 6-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </>
  ),
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
}

export function I({ name, size = 20, className = '', style }) {
  const glyph = PATHS[name] || PATHS.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}

/* ---------------- REVEAL ---------------- */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ '--d': `${delay}s` }} {...rest}>
      {children}
    </Tag>
  )
}

export function RevealWords({ text, className = '', step = 0.05, start = 0 }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          obs.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <span ref={ref} className={className}>
      {String(text)
        .split(' ')
        .map((w, i) => (
          <span key={i} className={`r-word ${shown ? 'in' : ''}`} style={{ '--d': `${start + i * step}s` }}>
            {w}
            {'\u00A0'}
          </span>
        ))}
    </span>
  )
}

export function useInView(threshold = 0.3) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

/* ---------------- COUNTER ---------------- */
export function Counter({ to, decimals = 0, prefix = '', suffix = '', duration = 1600 }) {
  const [ref, inView] = useInView(0.4)
  const [val, setVal] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    if (!inView || done.current) return
    done.current = true
    const target = Number(to) || 0
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, duration])

  return (
    <span ref={ref}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/* ---------------- PROGRESS / RING ---------------- */
export function Prog({ value = 0, tone = '', className = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={`prog ${tone ? `tone-${tone}` : ''} ${className}`} role="progressbar" aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Ring({ value = 0, max = 4, size = 86, label, sub }) {
  const pct = Math.max(0, Math.min(1, (Number(value) || 0) / max))
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#29d3f7" />
          </linearGradient>
        </defs>
        <circle className="r-track" cx={size / 2} cy={size / 2} r={r} strokeWidth="7" fill="none" />
        <circle
          className="r-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth="7"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="val" style={{ fontSize: size < 60 ? '0.85rem' : '1.1rem' }}>
        {label ?? value}
        {sub ? <small style={{ display: 'block', fontSize: '0.6rem', color: 'var(--faint)', fontWeight: 500 }}>{sub}</small> : null}
      </div>
    </div>
  )
}

export function RateBadge({ rate }) {
  if (!rate) return <span className="badge">—</span>
  const key = String(rate).replace(/[+-]/g, (m) => (m === '+' ? 'p' : ''))
  const tone =
    { A: 'r-a', Ap: 'r-a', Bp: 'r-bp', B: 'r-b', C: 'r-c', D: 'r-d', F: 'r-f' }[key] || 'r-c'
  return <span className={`rate ${tone}`}>{rate}</span>
}

/* ---------------- BUTTON ---------------- */
export function Btn({ variant = 'primary', size, icon, iconRight, loading, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', children ? '' : 'btn-icon', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} {...rest}>
      {loading ? <span className="spinner" style={{ '--s': '18px' }} /> : icon ? <I name={icon} size={18} /> : null}
      {children}
      {iconRight ? <I name={iconRight} size={18} /> : null}
      <span className="shine" aria-hidden="true" />
    </button>
  )
}

/* ---------------- AVATAR ---------------- */
const AV = [
  'linear-gradient(135deg,#7c5cff,#29d3f7)',
  'linear-gradient(135deg,#f563b0,#7c5cff)',
  'linear-gradient(135deg,#29d3f7,#34f5a2)',
  'linear-gradient(135deg,#ffce66,#f563b0)',
  'linear-gradient(135deg,#5a73ff,#7c5cff)',
]
export function Avatar({ name = '?', size = 42, radius = 13 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const idx = (name.charCodeAt(0) || 0) % AV.length
  return (
    <span className="av" style={{ width: size, height: size, borderRadius: radius, background: AV[idx], fontSize: size * 0.36 }}>
      {initials || '?'}
    </span>
  )
}

/* ---------------- STATCARD ---------------- */
export function StatCard({ icon, label, value, sub, tone = 'vio', delay = 0, children }) {
  const tones = {
    vio: ['rgba(124,92,255,.16)', '#a48bff'],
    cy: ['rgba(41,211,247,.14)', '#6fe3ff'],
    grn: ['rgba(52,245,162,.14)', '#8af7c7'],
    pnk: ['rgba(245,99,176,.14)', '#ffb0d6'],
    amb: ['rgba(255,206,102,.14)', '#ffe0a0'],
    red: ['rgba(255,93,122,.14)', '#ffc2cd'],
  }
  const [bg, color] = tones[tone] || tones.vio
  return (
    <Reveal className="stat" delay={delay} style={{ '--tbg': bg, '--tc': color }}>
      <span className="stat-glow" />
      {icon ? (
        <div className="ico">
          <I name={icon} size={22} />
        </div>
      ) : null}
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
      {children}
    </Reveal>
  )
}

/* ---------------- SECTION TITLE ---------------- */
export function SectionTitle({ kicker, title, sub, center = true }) {
  return (
    <Reveal className={`sec-head ${center ? 'center' : ''}`}>
      {kicker ? <span className="kicker">{kicker}</span> : null}
      <h2>
        <span className="grad-text">{title}</span>
      </h2>
      {sub ? <p>{sub}</p> : null}
    </Reveal>
  )
}

/* ---------------- EMPTY / LOADER ---------------- */
export function Empty({ icon = 'info', title = 'Nothing here yet', sub, action }) {
  return (
    <div className="empty">
      <div className="eic">
        <I name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {sub ? <p>{sub}</p> : null}
      {action}
    </div>
  )
}

export function Spinner({ size = 20 }) {
  return <span className="spinner" style={{ '--s': `${size}px` }} />
}

export function Loader() {
  return (
    <div className="loader-full">
      <div>
        <div className="loader-heart">
          <svg viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(124,92,255,.18)" strokeDasharray="8 10" strokeWidth="2" />
          </svg>
          <svg className="ring2" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="30" fill="none" stroke="rgba(41,211,247,.16)" strokeDasharray="4 12" strokeWidth="2" />
          </svg>
          <div className="core">
            <I name="cap" size={22} />
          </div>
        </div>
        <div className="loader-txt">UniversTech</div>
      </div>
    </div>
  )
}

export function CourseLoader({ label = 'Loading courses…' }) {
  return (
    <div className="course-loader" role="status" aria-live="polite">
      <div className="cl-stage">
        <span className="cl-ring cl-ring-a" />
        <span className="cl-ring cl-ring-b" />
        <span className="cl-book">
          <I name="cap" size={22} />
        </span>
        <span className="cl-dot cl-dot-1" />
        <span className="cl-dot cl-dot-2" />
        <span className="cl-dot cl-dot-3" />
      </div>
      <div className="cl-label">
        {label}
        <span className="cl-dots"><i /><i /><i /></span>
      </div>
    </div>
  )
}

/* ---------------- MODAL ---------------- */
export function Modal({ open, onClose, title, children, footer, size }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const lastFocus = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const getFocusables = () =>
    Array.from(panelRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
      (el) => !el.disabled,
    )

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const focusables = getFocusables()
    const preferred = focusables.find((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
    ;(preferred || focusables[0])?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const list = getFocusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = ''
      lastFocus.current?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <I name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

/* ---------------- TOASTS ---------------- */
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const remove = (id) => setItems((arr) => arr.filter((t) => t.id !== id))
  const push = (type, message) => {
    const id = Math.random().toString(36).slice(2)
    setItems((arr) => [...arr, { id, type, message }])
    setTimeout(() => remove(id), 4200)
  }

  const api = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="tic">
              <I name={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'info'} size={15} />
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

/* ---------------- FORM ---------------- */
export function Field({ label, hint, error, children, className = '' }) {
  const fid = useId()
  const child =
    isValidElement(children)
      ? cloneElement(children, { id: children.props.id || fid, 'aria-invalid': error ? 'true' : undefined })
      : children
  const id = isValidElement(child) ? child.props.id : undefined
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {child}
      {error ? <small className="field-msg" role="alert">{typeof error === 'string' ? error : Array.isArray(error) ? error[0] : 'This field is invalid.'}</small> : null}
      {hint ? <small style={{ color: 'var(--faint)', fontSize: '0.78rem' }}>{hint}</small> : null}
    </div>
  )
}

/* ---------------- PAGER ---------------- */
export function Pager({ page = 1, last = 1, onPage }) {
  if (last <= 1) return null
  const pages = []
  const from = Math.max(1, page - 2)
  const to = Math.min(last, from + 4)
  for (let i = from; i <= to; i++) pages.push(i)
  return (
    <div className="pager">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous">
        <I name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />
      </button>
      {from > 1 ? (
        <>
          <button onClick={() => onPage(1)}>1</button>
          {from > 2 ? <span style={{ color: 'var(--faint)' }}>…</span> : null}
        </>
      ) : null}
      {pages.map((p) => (
        <button key={p} className={p === page ? 'on' : ''} onClick={() => onPage(p)}>
          {p}
        </button>
      ))}
      {to < last ? (
        <>
          {to < last - 1 ? <span style={{ color: 'var(--faint)' }}>…</span> : null}
          <button onClick={() => onPage(last)}>{last}</button>
        </>
      ) : null}
      <button onClick={() => onPage(page + 1)} disabled={page >= last} aria-label="Next">
        <I name="chevron" size={16} />
      </button>
    </div>
  )
}

/* ---------------- MISC ---------------- */
export function Badge({ tone = '', children, dot }) {
  return (
    <span className={`badge ${tone}`}>
      {dot ? <span className="gd" /> : null}
      {children}
    </span>
  )
}

export function Crumb({ items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--faint)', fontSize: '0.82rem', marginBottom: 14 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {i > 0 ? <I name="chevron" size={13} /> : null}
          <span style={{ color: i === items.length - 1 ? 'var(--muted)' : 'inherit' }}>{it}</span>
        </span>
      ))}
    </div>
  )
}