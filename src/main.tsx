import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'
import { OPFSStorageProvider } from './storage/opfs'
import { setStorage } from './storage/provider'
import { useRoutesStore } from './store/routes'
import { useTracksStore } from './store/tracks'
import { useWaypointsStore } from './store/waypoints'
import { usePhotosStore } from './store/photos'
import { useTagsStore } from './store/tags'
import { useUiStore } from './store/ui'
import { useSettingsStore } from './store/settings'
import { installDevConsole } from './dev/devConsole'

async function bootstrap(): Promise<void> {
  const storage = new OPFSStorageProvider()
  // ensureSchema runs inside init(); blocks first render so we never read
  // from a database that's not yet at SCHEMA_VERSION.
  await storage.init()
  setStorage(storage)

  // Hydrate localStorage-backed slices synchronously before first render.
  useSettingsStore.getState().hydrateFromStorage()
  useUiStore.getState().hydrateFromStorage()

  // Fire entity loads in parallel; they update slice state when done.
  // Components show empty/loading state until the relevant slice fills in.
  void useRoutesStore.getState().load()
  void useTracksStore.getState().load()
  void useWaypointsStore.getState().load()
  void usePhotosStore.getState().load()
  void useTagsStore.getState().load()

  if (import.meta.env.DEV) installDevConsole(storage)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[couloir] bootstrap failed:', err)
  const pre = document.createElement('pre')
  pre.style.cssText =
    'color:#e6e8ec;background:#0e1014;padding:24px;font-family:ui-monospace'
  pre.textContent = `Couloir failed to start.\n\n${String(err)}`
  document.body.replaceChildren(pre)
})
