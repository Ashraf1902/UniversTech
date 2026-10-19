import en from '../src/lib/lang/en.js'
import ar from '../src/lib/lang/ar.js'

const enKeys = Object.keys(en)
const arKeys = Object.keys(ar)

const missingInAr = enKeys.filter((k) => !(k in ar))
const missingInEn = arKeys.filter((k) => !(k in en))

console.log(`en: ${enKeys.length} keys, ar: ${arKeys.length} keys`)

if (missingInAr.length || missingInEn.length) {
  if (missingInAr.length) console.error(`Missing in ar: ${missingInAr.join(', ')}`)
  if (missingInEn.length) console.error(`Missing in en: ${missingInEn.join(', ')}`)
  process.exit(1)
}

console.log('i18n parity OK')
