import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted type: IBM Plex Sans Arabic for UI, IBM Plex Mono for figures/code.
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import App from './App'
import { applyTheme, resolveInitialTheme } from './lib/theme'
import './styles/main.css'

applyTheme(resolveInitialTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
