import { useCallback, useEffect, useState } from 'react'
import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'
import { LayerPanel } from './panels/LayerPanel/LayerPanel'
import { SearchPanel } from './panels/SearchPanel/SearchPanel'
import { useEscapeKey } from './hooks/useEscapeKey'
import { FileDropzone } from './components/FileDropzone/FileDropzone'
import { DuplicatePrompt, type DuplicatePromptHandle } from './features/import/DuplicatePrompt'
import { runImport } from './features/import/ImportButton'
import { runAtesImport } from './features/ates/runAtesImport'
import { splitDroppedFiles } from './features/import/dropRouting'
import { subscribeToast } from './features/import/importToast'
import { DetailPanel } from './panels/DetailPanel/DetailPanel'
import { PlacementBanner } from './panels/PlacementBanner/PlacementBanner'
import { MOBILE_QUERY, useMediaQuery } from './hooks/useMediaQuery'
import { useUiStore } from './store/ui'

export default function App() {
  useEscapeKey()

  const [promptHandle, setPromptHandle] = useState<DuplicatePromptHandle | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => subscribeToast(setToast), [])

  const isMobile = useMediaQuery(MOBILE_QUERY)
  const panelOpen = useUiStore((s) => s.panel.mode !== 'idle')
  const placementActive = useUiStore((s) => s.placement.mode !== 'idle')
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  // Phone: start with the sheet closed so the map is unobstructed, and close
  // it whenever the detail sheet opens or placement starts, so sheets never
  // stack and the placement banner and map stay clear.
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true)
  }, [isMobile, setSidebarCollapsed])
  useEffect(() => {
    if (isMobile && (panelOpen || placementActive)) setSidebarCollapsed(true)
  }, [isMobile, panelOpen, placementActive, setSidebarCollapsed])

  // Stable callback so LayerPanel/dropzone don't re-bind on every render.
  // If the handle isn't ready (StrictMode double-render edge), the prompt
  // resolves immediately to 'skip' as a safe default.
  const promptDuplicate = useCallback(
    async (args: Parameters<DuplicatePromptHandle['enqueue']>[0]) => {
      if (!promptHandle) return { choice: 'skip' as const, applyToAll: false }
      return promptHandle.enqueue(args)
    },
    [promptHandle],
  )

  const onDropFiles = useCallback(
    (files: File[]) => {
      const { gpx, kmz } = splitDroppedFiles(files)
      if (gpx.length > 0) void runImport(gpx, promptDuplicate)
      if (kmz.length > 0) void runAtesImport(kmz)
    },
    [promptDuplicate],
  )

  return (
    <div className={styles.app}>
      <Sidebar
        panels={{
          layers:   <LayerPanel promptDuplicate={promptDuplicate} />,
          search:   <SearchPanel />,
          settings: <SettingsPanel />,
        }}
      />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
        <PlacementBanner />
        <FileDropzone onFiles={onDropFiles} />
        {toast && (
          <div role="status" aria-live="polite" className={styles.toast}>
            {toast}
          </div>
        )}
        <DetailPanel />
      </div>
      <DuplicatePrompt onReady={setPromptHandle} />
    </div>
  )
}
