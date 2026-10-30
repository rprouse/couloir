import styles from './Sidebar.module.css'
import { useUiStore, type SidebarTab } from '../store/ui'
import { ReactNode } from 'react'
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery'

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
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const onTab = (tab: SidebarTab) => {
    // Mobile bottom sheet: the active tab doubles as the close control.
    if (isMobile && !sidebarCollapsed && tab === activeTab) {
      setSidebarCollapsed(true)
      return
    }
    setActiveTab(tab)
    if (sidebarCollapsed) setSidebarCollapsed(false)
  }

  return (
    <aside
      aria-label="Sidebar"
      className={styles.sidebar}
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      data-mobile={isMobile ? 'true' : 'false'}
    >
      {/* The site icon (public/icons/icon.svg, also the favicon). Collapsed,
          only the icon shows; on mobile the brand is hidden (bottom sheet). */}
      <header className={styles.brand}>
        <img className={styles.brandIcon} src="/icons/icon.svg" alt="" />
        <h1 className={styles.brandTitle}>Couloir</h1>
      </header>
      <nav className={styles.tabs} aria-label="Sidebar tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={styles.tabButton}
            aria-pressed={activeTab === tab.id}
            onClick={() => onTab(tab.id)}
          >
            <span aria-hidden="true" className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
      {!sidebarCollapsed && panels[activeTab] !== undefined && (
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
