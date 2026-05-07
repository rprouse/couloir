import styles from './Sidebar.module.css'
import { useUiStore, type SidebarTab } from '../store/ui'
import { ReactNode } from 'react'

const TABS: ReadonlyArray<{ id: SidebarTab; label: string; icon: string }> = [
  { id: 'layers',   label: 'Layers',   icon: '☰' },
  { id: 'search',   label: 'Search',   icon: '⌕' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

interface SidebarProps {
  panels: Partial<Record<SidebarTab, ReactNode>>
}

export function Sidebar({ panels }: SidebarProps) {
  const activeTab = useUiStore((s) => s.activeTab)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <aside
      className={styles.sidebar}
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
    >
      <nav className={styles.tabs} aria-label="Sidebar tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={styles.tabButton}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <span aria-hidden="true" className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
      {!sidebarCollapsed && (
        <div className={styles.content}>{panels[activeTab]}</div>
      )}
      <button
        type="button"
        className={styles.collapseButton}
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>
    </aside>
  )
}
