import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'

export default function App() {
  return (
    <div className={styles.app}>
      <Sidebar />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
      </div>
    </div>
  )
}
