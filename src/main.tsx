import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useSettingsStore } from './store/settings'
import { useUiStore } from './store/ui'
import './theme.css'

useSettingsStore.getState().hydrateFromStorage()
useUiStore.getState().hydrateFromStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
