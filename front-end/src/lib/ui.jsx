import { createContext, cloneElement, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react'
import { useI18n } from './i18n'
import {
  ArrowDown,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  GraduationCap,
  Info,
  Layers,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Moon,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react'

/* ---------------- ICONS ---------------- */
/* Lucide line icons, mapped onto the short names the pages already use so no
   page-level markup has to change. */
const ICONS = {
  grid: LayoutDashboard,
  book: BookOpen,
  users: Users,
  user: User,
  bell: Bell,
  calendar: Calendar,
  clock: Clock,
  award: Award,
  chart: ChartColumn,
  logout: LogOut,
  menu: Menu,
  x: X,
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  check: Check,
  plus: Plus,
  trash: Trash2,
  edit: Pencil,
  search: Search,
  play: Play,
  file: FileText,
  upload: Upload,
  download: Download,
  mail: Mail,
  lock: Lock,
  building: Building2,
  cap: GraduationCap,
  spark: Sparkles,
  shield: ShieldCheck,
  arrow: ArrowRight,
  down: ArrowDown,
  refresh: RefreshCw,
  info: Info,
  layers: Layers,
  trend: TrendingUp,
  wallet: Wallet,
  eye: Eye,
  eyeOff: EyeOff,
  globe: Globe,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  more: MoreHorizontal,
  login: LogIn,
}

export function I({ name, size = 20, className = '', style, strokeWidth = 1.8 }) {
  const Glyph = ICONS[name] || Info
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={`i ${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
    />
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
            <stop offset="0%" stopColor="var(--ut-indigo-600)" />
            <stop offset="100%" stopColor="var(--ut-gold-400)" />
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
  'linear-gradient(135deg, var(--ut-indigo-600), var(--ut-indigo-800))',
  'linear-gradient(135deg, var(--ut-indigo-700), var(--ut-indigo-500))',
  'linear-gradient(135deg, var(--ut-indigo-800), var(--ut-gold-500))',
  'linear-gradient(135deg, var(--ut-gold-600), var(--ut-indigo-700))',
  'linear-gradient(135deg, var(--ut-indigo-500), var(--ut-indigo-700))',
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
    vio: ['var(--tone-indigo-bg)', 'var(--tone-indigo-fg)'],
    cy: ['var(--tone-gold-bg)', 'var(--tone-gold-fg)'],
    grn: ['var(--tone-green-bg)', 'var(--tone-green-fg)'],
    pnk: ['var(--tone-rose-bg)', 'var(--tone-rose-fg)'],
    amb: ['var(--tone-gold-bg)', 'var(--tone-gold-fg)'],
    red: ['var(--tone-red-bg)', 'var(--tone-red-fg)'],
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
export function Empty({ icon = 'info', title, sub, action }) {
  const { t } = useI18n()
  return (
    <div className="empty">
      <div className="eic">
        <I name={icon} size={26} />
      </div>
      <h3>{title ?? t('nothingHereYet')}</h3>
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

export function CourseLoader({ label }) {
  const { t } = useI18n()
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
        {label ?? t('loadingCourses')}
        <span className="cl-dots"><i /><i /><i /></span>
      </div>
    </div>
  )
}

/* ---------------- MODAL ---------------- */
export function Modal({ open, onClose, title, children, footer, size }) {
  const { t } = useI18n()
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
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}>
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
  const { t } = useI18n()
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
      {error ? <small className="field-msg" role="alert">{typeof error === 'string' ? error : Array.isArray(error) ? error[0] : t('fieldInvalid')}</small> : null}
      {hint ? <small style={{ color: 'var(--faint)', fontSize: '0.78rem' }}>{hint}</small> : null}
    </div>
  )
}

/* ---------------- PAGER ---------------- */
export function Pager({ page = 1, last = 1, onPage }) {
  const { t } = useI18n()
  if (last <= 1) return null
  const pages = []
  const from = Math.max(1, page - 2)
  const to = Math.min(last, from + 4)
  for (let i = from; i <= to; i++) pages.push(i)
  return (
    <div className="pager">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('previous')}>
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
      <button onClick={() => onPage(page + 1)} disabled={page >= last} aria-label={t('next')}>
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