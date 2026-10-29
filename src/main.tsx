import React from 'react'
import maplibregl from 'maplibre-gl'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'
import { HttpStorageProvider } from './storage/http'
import { setStorage } from './storage/provider'
import { useRoutesStore } from './store/routes'
import { useTracksStore } from './store/tracks'
import { useWaypointsStore } from './store/waypoints'
import { usePhotosStore } from './store/photos'
import { useTagsStore } from './store/tags'
import { useAtesAreasStore } from './store/atesAreas'
import { useUiStore } from './store/ui'
import { useSettingsStore } from './store/settings'
import { installDevConsole } from './dev/devConsole'
import { registerOverlayProtocols } from './map/slope/overlayProtocol'
import { browserCodec } from './map/slope/browserCodec'

async function bootstrap(): Promise<void> {
  // All data lives on the Couloir server (same origin). init() checks it is
  // reachable and on a schema this build understands; it blocks first render.
  const storage = new HttpStorageProvider()
  await storage.init()
  setStorage(storage)

  // Hydrate localStorage-backed slices synchronously before first render.
  useSettingsStore.getState().hydrateFromStorage()
  useUiStore.getState().hydrateFromStorage()
  // Fall back to the server's Maptiler key when this browser has none, so a
  // new computer doesn't land on the welcome screen.
  await useSettingsStore.getState().loadServerKey()

  // Fire entity loads in parallel; they update slice state when done.
  // Components show empty/loading state until the relevant slice fills in.
  void useRoutesStore.getState().load()
  void useTracksStore.getState().load()
  void useWaypointsStore.getState().load()
  void usePhotosStore.getState().load()
  void useTagsStore.getState().load()
  void useAtesAreasStore.getState().load()

  // slope:// and aspect:// tiles read the key live, so a key change needs no
  // re-register.
  registerOverlayProtocols(maplibregl.addProtocol, {
    fetchFn: fetch.bind(globalThis),
    codec: browserCodec,
    getKey: () => useSettingsStore.getState().maptilerKey,
  })

  if (import.meta.env.DEV) installDevConsole(storage)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  if (import.meta.env.PROD) {
    // Service workers need a secure context, so this fails on a plain-HTTP
    // LAN address. The app works without one; it just can't be installed.
    try {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({ immediate: true })
    } catch {
      // No offline shell on this origin.
    }
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[couloir] bootstrap failed:', err)
  const pre = document.createElement('pre')
  pre.style.cssText =
    'color:#e6e8ec;background:#0e1014;padding:24px;font-family:ui-monospace'
  pre.textContent =
    `Couloir failed to start.\n\n${String(err)}\n\n` +
    'Couloir keeps its data on the Couloir server. Check that the server is ' +
    'running and reachable from this computer, then reload.'
  document.body.replaceChildren(pre)
})
