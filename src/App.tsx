import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'

export default function App() {
  return (
    <div className={styles.app}>
      <Sidebar />
      <div data-testid="map-area" className={styles.mapArea}>
        {/* Map goes here in Task 1.3 */}
      </div>
    </div>
  )
}
