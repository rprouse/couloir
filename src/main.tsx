import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installDevConsole } from './dev/devConsole'
import { OPFSStorageProvider } from './storage/opfs'
import { useSettingsStore } from './store/settings'
import { useUiStore } from './store/ui'
import { debug } from './utils/debug'
import './theme.css'

useSettingsStore.getState().hydrateFromStorage()
useUiStore.getState().hydrateFromStorage()

// Temporary storage init for Phase 2 dev verification — exercised manually via
// DevTools. Removed in Task 2.5 when storage init is wired into the proper
// bootstrap that also seeds the Zustand stores. To see the debug log, set
// `localStorage.couloir_debug = '1'` before reload.
if (import.meta.env.DEV) {
  ;(async () => {
    const storage = new OPFSStorageProvider()
    await storage.init()
    debug('storage initialized')
    installDevConsole(storage)
  })().catch((err) => {
    debug('storage init failed', err)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
