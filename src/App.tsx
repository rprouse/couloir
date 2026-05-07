import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'

export default function App() {
  return (
    <div className={styles.app}>
      <Sidebar
        panels={{
          settings: <SettingsPanel />,
        }}
      />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
      </div>
    </div>
  )
}
