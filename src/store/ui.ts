import { create } from 'zustand'

export type SidebarTab = 'layers' | 'search' | 'settings'

interface UiState {
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'layers',
  sidebarCollapsed: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
