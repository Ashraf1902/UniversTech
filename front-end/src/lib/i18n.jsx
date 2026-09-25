import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import ar from './lang/ar'
import en from './lang/en'

const LANG_KEY = 'ut:lang'
const DICTS = { en, ar }

const I18nContext = createContext(null)

function template(str, vars) {
  if (!vars) return str
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m))
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(LANG_KEY) || 'en'
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const dict = DICTS[lang] || en

  const t = useCallback(
    (key, vars) => template(dict[key] ?? en[key] ?? key, vars),
    [dict],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, isRTL: lang === 'ar', dir: lang === 'ar' ? 'rtl' : 'ltr' }),
    [lang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}