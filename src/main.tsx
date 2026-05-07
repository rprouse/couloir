import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { OPFSStorageProvider } from './storage/opfs'
import { useSettingsStore } from './store/settings'
import { useUiStore } from './store/ui'
import { debug } from './utils/debug'
import './theme.css'

useSettingsStore.getState().hydrateFromStorage()
useUiStore.getState().hydrateFromStorage()

// Temporary smoke-test for Task 2.1 — exercised manually via DevTools.
// Removed in Task 2.5 when storage init is wired into the proper bootstrap.
// To see the log, set `localStorage.couloir_debug = '1'` before reload.
;(async () => {
  const storage = new OPFSStorageProvider()
  await storage.init()
  debug('storage initialized')
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
