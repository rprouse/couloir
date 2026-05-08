import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'
import { LayerPanel } from './panels/LayerPanel/LayerPanel'
import { useEscapeKey } from './hooks/useEscapeKey'

export default function App() {
  useEscapeKey()
  return (
    <div className={styles.app}>
      <Sidebar
        panels={{
          layers:   <LayerPanel />,
          settings: <SettingsPanel />,
        }}
      />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
      </div>
    </div>
  )
}
