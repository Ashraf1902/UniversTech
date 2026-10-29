import { useI18n } from './i18n'

import logoEnLight from '../assets/brand/universtech-logo-light.svg'
import logoEnDark from '../assets/brand/universtech-logo-dark.svg'
import logoArLight from '../assets/brand/universtech-logo-arabic-light.svg'
import logoArDark from '../assets/brand/universtech-logo-arabic-dark.svg'
import markLight from '../assets/brand/universtech-mark-light.svg'
import markDark from '../assets/brand/universtech-mark-dark.svg'
import iconFile from '../assets/brand/universtech-icon.svg'

/**
 * Full UniversTech lockup. Swaps English/Arabic artwork with the language and
 * light/dark artwork with the theme; both variants are in the DOM and CSS picks
 * the visible one so there is no flash while the theme resolves.
 */
export function Brand({ size = 'md', className = '' }) {
  const { lang } = useI18n()
  const arabic = lang === 'ar'
  const onLight = arabic ? logoArLight : logoEnLight
  const onDark = arabic ? logoArDark : logoEnDark

  return (
    <span className={`brand-logo is-${size} ${className}`}>
      <img className="brand-on-light" src={onLight} alt="UniversTech" />
      <img className="brand-on-dark" src={onDark} alt="UniversTech" />
    </span>
  )
}

/** Mark only — used where the full lockup would not fit. */
export function BrandMark({ size = 30, className = '' }) {
  return (
    <span className={`brand-logo brand-mark ${className}`} style={{ height: size }}>
      <img className="brand-on-light" src={markLight} alt="UniversTech" />
      <img className="brand-on-dark" src={markDark} alt="UniversTech" />
    </span>
  )
}

export { iconFile as appIcon }
