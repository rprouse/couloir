# Couloir Phase 1 — Project Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Vite + React + TypeScript app that renders a 3D Maptiler basemap with terrain, basemap switching, error handling for bad API keys, a Settings panel, and a Layer panel scaffold. No data layer yet.

**Architecture:** Single-page React app, MapLibre GL JS as the map renderer, Maptiler tiles + RGB terrain, Zustand for state, CSS Modules for component styles, dark theme via CSS custom properties. Vitest + React Testing Library for tests; MapLibre is mocked at the module level so component tests don't depend on a live map runtime.

**Tech Stack:** React 18, Vite 5+, TypeScript 5+, MapLibre GL JS 4+, Zustand, CSS Modules, Vitest, @testing-library/react, jsdom.

**Spec references:** `SPEC.md` (Map and Settings sections), `ARCHITECTURE.md` (Tech Stack, Project Structure, Maptiler Integration, State Management), `DATA-MODEL.md` (`MAP_DEFAULTS`, `Basemap` type), `TASKS.md` Tasks 1.1–1.7.

**Out of scope for this phase:** any data layer (SQLite/OPFS), GPX import, entity rendering, panels for routes/tracks/waypoints/photos, ZIP backup, PWA manifest, mobile bottom-sheet behavior. These phases come later.

---

## File Structure

```
couloir/
├── package.json                       Task 1.1
├── vite.config.ts                     Task 1.1
├── vitest.config.ts                   Task 1.1
├── tsconfig.json                      Task 1.1
├── tsconfig.node.json                 Task 1.1
├── index.html                         Task 1.1
├── .gitignore                         Task 1.1
├── src/
│   ├── main.tsx                       Task 1.1
│   ├── App.tsx                        Tasks 1.1, 1.2
│   ├── App.module.css                 Task 1.2
│   ├── theme.css                      Task 1.2 (CSS variables)
│   ├── vite-env.d.ts                  Task 1.1
│   ├── test/
│   │   ├── setup.ts                   Task 1.1 (jest-dom + module mocks)
│   │   └── mocks/maplibre-gl.ts       Task 1.3 (MapLibre mock)
│   ├── store/
│   │   ├── ui.ts                      Tasks 1.2, 1.4, 1.5, 1.7 (UI Zustand slice)
│   │   └── settings.ts                Task 1.6 (Maptiler key + map defaults)
│   ├── map/
│   │   ├── MapView.tsx                Task 1.3
│   │   ├── MapView.module.css         Task 1.3
│   │   ├── mapConfig.ts               Tasks 1.3, 1.5 (style URL builders)
│   │   ├── controls/
│   │   │   ├── TerrainControl.tsx     Task 1.4
│   │   │   ├── TerrainControl.module.css Task 1.4
│   │   │   ├── BasemapControl.tsx     Task 1.5
│   │   │   └── BasemapControl.module.css Task 1.5
│   │   └── errors/
│   │       └── tileErrorMonitor.ts    Task 1.3 (tile-error rolling-window logic)
│   ├── panels/
│   │   ├── Sidebar.tsx                Task 1.2
│   │   ├── Sidebar.module.css         Task 1.2
│   │   ├── SettingsPanel/
│   │   │   ├── SettingsPanel.tsx      Task 1.6
│   │   │   └── SettingsPanel.module.css Task 1.6
│   │   └── LayerPanel/
│   │       ├── LayerPanel.tsx         Task 1.7
│   │       └── LayerPanel.module.css  Task 1.7
│   ├── types/
│   │   └── index.ts                   Tasks 1.4, 1.5 (shared types — Basemap, MAP_DEFAULTS)
│   └── utils/
│       └── debug.ts                   Task 1.1 (per ARCHITECTURE.md)
└── (no src/storage/ yet — Phase 2)
```

**Test conventions** (locked in Task 1.1):
- Test files live next to the implementation: `Component.test.tsx` next to `Component.tsx`. Setup files live in `src/test/`.
- Vitest globals (`describe`, `it`, `expect`) are enabled — no per-file imports.
- `@testing-library/jest-dom` matchers available globally via the setup file.
- MapLibre is mocked in `src/test/mocks/maplibre-gl.ts` and applied via `vi.mock` in the setup file. No test ever imports the real MapLibre.

---

## Task 1.1 — Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/theme.css`
- Create: `src/test/setup.ts`
- Create: `src/utils/debug.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1.1.1: Write `package.json`**

```json
{
  "name": "couloir",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "maplibre-gl": "^4.7.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

`recharts` and `vite-plugin-pwa` are deferred to the phases that need them (Phase 3 and Phase 6 respectively). `wa-sqlite`, `exifr`, and `fflate` come in their respective phases.

- [ ] **Step 1.1.2: Install dependencies**

Run: `npm install`
Expected: completes with no errors; `node_modules/` created; `package-lock.json` written.

- [ ] **Step 1.1.3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.1.4: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 1.1.5: Write `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 1.1.6: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
```

- [ ] **Step 1.1.7: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0e1014" />
    <title>Couloir</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.1.8: Write `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 1.1.9: Write `src/theme.css`** (CSS custom properties for the dark theme)

```css
:root {
  color-scheme: dark;

  --color-bg-0: #0e1014;
  --color-bg-1: #15181f;
  --color-bg-2: #1c2029;
  --color-border: #2a2f3a;
  --color-text: #e6e8ec;
  --color-text-dim: #9aa0ad;
  --color-accent: #e05c2a;
  --color-accent-cool: #2a7be0;
  --color-danger: #ef4444;
  --color-warn: #f59e0b;
  --color-ok: #22c55e;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  --radius-sm: 4px;
  --radius-md: 8px;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--color-bg-0);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.4;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 1.1.10: Write `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 1.1.11: Write `src/App.tsx` — minimal placeholder for now**

```typescript
export default function App() {
  return <main>Couloir</main>
}
```

- [ ] **Step 1.1.12: Write `src/utils/debug.ts`** (per `ARCHITECTURE.md` "Debug Logging")

```typescript
const ENABLED =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('couloir_debug') === '1'

export function debug(...args: unknown[]): void {
  if (ENABLED) console.log('[couloir]', ...args)
}
```

- [ ] **Step 1.1.13: Write `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 1.1.14: Write the failing smoke test `src/App.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the application root', () => {
    render(<App />)
    expect(screen.getByText(/couloir/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 1.1.15: Run the smoke test to verify it passes**

Run: `npm test`
Expected: 1 test passing. (The placeholder `App` returns "Couloir" so the assertion passes — this is the baseline that everything in Phase 1 builds on.)

- [ ] **Step 1.1.16: Run `npm run dev` to verify the app boots**

Run: `npm run dev`
Expected: Vite dev server starts on http://localhost:5173 with no errors. Visit the URL and see "Couloir" rendered against the dark background. Stop the dev server (Ctrl+C) before proceeding.

- [ ] **Step 1.1.17: Run typecheck to verify the TS config is valid**

Run: `npm run typecheck`
Expected: completes with no errors.

- [ ] **Step 1.1.18: Write `.gitignore`**

```
node_modules
dist
dist-ssr
*.local
.vite

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Test
coverage
```

- [ ] **Step 1.1.19: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html src/
git commit -m "chore: scaffold Vite + React + TypeScript project with Vitest

Initial project skeleton: dependencies, build/test config, dark-theme
CSS custom properties, debug helper, smoke test."
```

---

## Task 1.2 — App layout shell

**Files:**
- Create: `src/store/ui.ts`, `src/store/ui.test.ts`
- Create: `src/panels/Sidebar.tsx`, `src/panels/Sidebar.module.css`, `src/panels/Sidebar.test.tsx`
- Modify: `src/App.tsx`, `src/App.module.css` (created here)
- Modify: `src/App.test.tsx`

The layout is a full-viewport flex row: sidebar on the left, map area filling the rest. Top bar is omitted from this phase — the spec calls for it but in practice Phase 1's only top-bar contents would be the basemap switcher and that lives on the map (Task 1.5). We can add a top bar later if Phase 6's polish needs it.

- [ ] **Step 1.2.1: Write the failing test `src/store/ui.test.ts` for sidebar state**

```typescript
import { useUiStore } from './ui'

describe('ui store — sidebar tabs', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'layers', sidebarCollapsed: false })
  })

  it('defaults to the layers tab, expanded', () => {
    expect(useUiStore.getState().activeTab).toBe('layers')
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('switches the active tab', () => {
    useUiStore.getState().setActiveTab('settings')
    expect(useUiStore.getState().activeTab).toBe('settings')
  })

  it('toggles the collapsed state', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })
})
```

- [ ] **Step 1.2.2: Run the test and verify it fails**

Run: `npm test src/store/ui.test.ts`
Expected: FAIL — module `./ui` does not exist.

- [ ] **Step 1.2.3: Write `src/store/ui.ts`**

```typescript
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
```

- [ ] **Step 1.2.4: Run the test and verify it passes**

Run: `npm test src/store/ui.test.ts`
Expected: 3 tests passing.

- [ ] **Step 1.2.5: Write the failing test `src/panels/Sidebar.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { useUiStore } from '../store/ui'

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'layers', sidebarCollapsed: false })
  })

  it('renders three tab buttons', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches the active tab on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(useUiStore.getState().activeTab).toBe('settings')
  })

  it('toggles collapse on the collapse button', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })
})
```

- [ ] **Step 1.2.6: Run the test and verify it fails**

Run: `npm test src/panels/Sidebar.test.tsx`
Expected: FAIL — module `./Sidebar` does not exist.

- [ ] **Step 1.2.7: Write `src/panels/Sidebar.tsx`**

```typescript
import styles from './Sidebar.module.css'
import { useUiStore, type SidebarTab } from '../store/ui'

const TABS: ReadonlyArray<{ id: SidebarTab; label: string; icon: string }> = [
  { id: 'layers',   label: 'Layers',   icon: '☰' },
  { id: 'search',   label: 'Search',   icon: '⌕' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export function Sidebar() {
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
```

- [ ] **Step 1.2.8: Write `src/panels/Sidebar.module.css`**

```css
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-1);
  border-right: 1px solid var(--color-border);
  width: 280px;
  min-width: 280px;
  transition: width 120ms ease, min-width 120ms ease;
}

.sidebar[data-collapsed='true'] {
  width: 56px;
  min-width: 56px;
}

.sidebar[data-collapsed='true'] .tabLabel {
  display: none;
}

.tabs {
  display: flex;
  flex-direction: column;
  padding: var(--space-sm);
  gap: var(--space-xs);
}

.tabButton {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-dim);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.tabButton:hover {
  background: var(--color-bg-2);
  color: var(--color-text);
}

.tabButton[aria-pressed='true'] {
  background: var(--color-bg-2);
  color: var(--color-text);
  border-color: var(--color-border);
}

.tabIcon {
  font-size: 18px;
  width: 20px;
  text-align: center;
}

.tabLabel {
  font-weight: 500;
}

.collapseButton {
  margin-top: auto;
  padding: var(--space-sm);
  background: transparent;
  border: none;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-dim);
  cursor: pointer;
  font-size: 18px;
}

.collapseButton:hover {
  color: var(--color-text);
}
```

- [ ] **Step 1.2.9: Run the Sidebar test and verify it passes**

Run: `npm test src/panels/Sidebar.test.tsx`
Expected: 4 tests passing.

- [ ] **Step 1.2.10: Update `src/App.test.tsx` to assert the layout structure**

Replace the contents with:

```typescript
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the sidebar and the map area', () => {
    render(<App />)
    expect(screen.getByRole('complementary')).toBeInTheDocument() // <aside>
    expect(screen.getByTestId('map-area')).toBeInTheDocument()
  })
})
```

- [ ] **Step 1.2.11: Run the test and verify it fails**

Run: `npm test src/App.test.tsx`
Expected: FAIL — `<aside>` and `[data-testid="map-area"]` are not present in the placeholder App.

- [ ] **Step 1.2.12: Update `src/App.tsx` to render the layout shell**

```typescript
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
```

- [ ] **Step 1.2.13: Write `src/App.module.css`**

```css
.app {
  display: flex;
  height: 100%;
  width: 100%;
}

.mapArea {
  flex: 1;
  position: relative;
  background: var(--color-bg-0);
}
```

- [ ] **Step 1.2.14: Run the App test and verify it passes**

Run: `npm test src/App.test.tsx`
Expected: 1 test passing.

- [ ] **Step 1.2.15: Run `npm run dev`, visually verify the layout in the browser**

Run: `npm run dev`
Open http://localhost:5173. Confirm:
- Sidebar on the left, dark; three tab buttons; collapse button at bottom.
- Map area on the right, slightly darker background, empty.
- Clicking each tab visually toggles the active style.
- Clicking the collapse button shrinks the sidebar to icons.
- Layout adapts to a 1280px+ desktop and is at least usable at 375px (no horizontal scroll on the layout itself; full mobile polish lands in Phase 6).

Stop the dev server.

- [ ] **Step 1.2.16: Commit**

```bash
git add src/store/ui.ts src/store/ui.test.ts src/panels/Sidebar.tsx src/panels/Sidebar.module.css src/panels/Sidebar.test.tsx src/App.tsx src/App.module.css src/App.test.tsx
git commit -m "feat: app layout shell with collapsible sidebar"
```

---

## Task 1.3 — MapLibre map with Maptiler

**Files:**
- Create: `src/store/settings.ts`, `src/store/settings.test.ts`
- Create: `src/map/mapConfig.ts`, `src/map/mapConfig.test.ts`
- Create: `src/map/errors/tileErrorMonitor.ts`, `src/map/errors/tileErrorMonitor.test.ts`
- Create: `src/map/MapView.tsx`, `src/map/MapView.module.css`, `src/map/MapView.test.tsx`
- Create: `src/test/mocks/maplibre-gl.ts`
- Modify: `src/test/setup.ts` (apply MapLibre mock globally)
- Modify: `src/App.tsx` (mount `MapView`)

This is the largest task in Phase 1: the map renderer plus error UX (per `ARCHITECTURE.md` "Maptiler error handling"). MapLibre is mocked at the module level so component tests focus on lifecycle and state, not WebGL.

### Settings store

- [ ] **Step 1.3.1: Write the failing test `src/store/settings.test.ts`**

```typescript
import { useSettingsStore } from './settings'

describe('settings store — Maptiler key', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ maptilerKey: null })
  })

  it('starts with no key when localStorage is empty', () => {
    expect(useSettingsStore.getState().maptilerKey).toBeNull()
  })

  it('persists the key on save', () => {
    useSettingsStore.getState().setMaptilerKey('abc123')
    expect(localStorage.getItem('couloir_maptiler_key')).toBe('abc123')
    expect(useSettingsStore.getState().maptilerKey).toBe('abc123')
  })

  it('hydrates from localStorage on init', () => {
    localStorage.setItem('couloir_maptiler_key', 'xyz789')
    useSettingsStore.getState().hydrateFromStorage()
    expect(useSettingsStore.getState().maptilerKey).toBe('xyz789')
  })

  it('clears the key', () => {
    localStorage.setItem('couloir_maptiler_key', 'abc')
    useSettingsStore.setState({ maptilerKey: 'abc' })
    useSettingsStore.getState().setMaptilerKey(null)
    expect(localStorage.getItem('couloir_maptiler_key')).toBeNull()
    expect(useSettingsStore.getState().maptilerKey).toBeNull()
  })
})
```

- [ ] **Step 1.3.2: Run the test and verify it fails**

Run: `npm test src/store/settings.test.ts`
Expected: FAIL — module `./settings` does not exist.

- [ ] **Step 1.3.3: Write `src/store/settings.ts`**

```typescript
import { create } from 'zustand'

const STORAGE_KEY = 'couloir_maptiler_key'

interface SettingsState {
  maptilerKey: string | null
  setMaptilerKey: (key: string | null) => void
  hydrateFromStorage: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  maptilerKey: null,
  setMaptilerKey: (key) => {
    if (key === null || key === '') {
      localStorage.removeItem(STORAGE_KEY)
      set({ maptilerKey: null })
    } else {
      localStorage.setItem(STORAGE_KEY, key)
      set({ maptilerKey: key })
    }
  },
  hydrateFromStorage: () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    set({ maptilerKey: stored && stored.length > 0 ? stored : null })
  },
}))
```

- [ ] **Step 1.3.4: Run the test and verify it passes**

Run: `npm test src/store/settings.test.ts`
Expected: 4 tests passing.

### mapConfig

- [ ] **Step 1.3.5: Write the failing test `src/map/mapConfig.test.ts`**

```typescript
import { styleUrl, terrainSourceUrl, validateStyle } from './mapConfig'

describe('mapConfig — URL builders', () => {
  it('builds the outdoor style URL with the key', () => {
    expect(styleUrl('outdoor', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY123',
    )
  })

  it('builds the satellite style URL with the key', () => {
    expect(styleUrl('satellite', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/satellite/style.json?key=KEY123',
    )
  })

  it('builds the winter style URL with the key', () => {
    expect(styleUrl('winter', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/winter-v2/style.json?key=KEY123',
    )
  })

  it('builds the terrain source URL with the key', () => {
    expect(terrainSourceUrl('KEY123')).toBe(
      'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=KEY123',
    )
  })
})

describe('mapConfig — validateStyle', () => {
  it('resolves true on a 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    expect(await validateStyle('outdoor', 'GOOD', fetchMock)).toEqual({ ok: true })
  })

  it('resolves with status on a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    expect(await validateStyle('outdoor', 'BAD', fetchMock)).toEqual({ ok: false, status: 401 })
  })

  it('resolves with status on a 403 (quota / restriction)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    expect(await validateStyle('outdoor', 'OVERDUE', fetchMock)).toEqual({ ok: false, status: 403 })
  })

  it('resolves with networkError when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'))
    expect(await validateStyle('outdoor', 'KEY', fetchMock)).toEqual({
      ok: false,
      networkError: true,
    })
  })
})
```

- [ ] **Step 1.3.6: Run the test and verify it fails**

Run: `npm test src/map/mapConfig.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 1.3.7: Write `src/map/mapConfig.ts`**

```typescript
import type { Basemap } from '../types'

const BASE = 'https://api.maptiler.com'

const STYLE_PATHS: Record<Basemap, string> = {
  satellite: 'maps/satellite/style.json',
  outdoor:   'maps/outdoor-v2/style.json',
  winter:    'maps/winter-v2/style.json',
}

export function styleUrl(basemap: Basemap, key: string): string {
  return `${BASE}/${STYLE_PATHS[basemap]}?key=${key}`
}

export function terrainSourceUrl(key: string): string {
  return `${BASE}/tiles/terrain-rgb-v2/tiles.json?key=${key}`
}

export type StyleValidation =
  | { ok: true }
  | { ok: false; status: number }
  | { ok: false; networkError: true }

export async function validateStyle(
  basemap: Basemap,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<StyleValidation> {
  try {
    const response = await fetchFn(styleUrl(basemap, key), { method: 'GET' })
    if (response.ok) return { ok: true }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, networkError: true }
  }
}
```

- [ ] **Step 1.3.8: Create `src/types/index.ts` to define the `Basemap` type used above**

```typescript
export type Basemap = 'satellite' | 'outdoor' | 'winter'

export const MAP_DEFAULTS = {
  center: [-116.0, 49.5] as [number, number],   // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  basemap: 'outdoor' as Basemap,
} as const
```

- [ ] **Step 1.3.9: Run the mapConfig test and verify it passes**

Run: `npm test src/map/mapConfig.test.ts`
Expected: 8 tests passing.

### Tile-error monitor

- [ ] **Step 1.3.10: Write the failing test `src/map/errors/tileErrorMonitor.test.ts`**

```typescript
import { createTileErrorMonitor } from './tileErrorMonitor'

describe('tileErrorMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not trip below the threshold', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    monitor.recordError()
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('trips when the threshold is reached within the window', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    monitor.recordError()
    monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip when errors are spread across windows', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    vi.advanceTimersByTime(6_000)
    monitor.recordError()
    vi.advanceTimersByTime(6_000)
    monitor.recordError()
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('does not re-trip during the cooldown after a trip', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({
      threshold: 3,
      windowMs: 10_000,
      cooldownMs: 30_000,
      onTrip,
    })
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(31_000)
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 1.3.11: Run the test and verify it fails**

Run: `npm test src/map/errors/tileErrorMonitor.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 1.3.12: Write `src/map/errors/tileErrorMonitor.ts`**

```typescript
interface MonitorOptions {
  threshold: number
  windowMs: number
  cooldownMs?: number
  onTrip: () => void
}

export interface TileErrorMonitor {
  recordError: () => void
  reset: () => void
}

export function createTileErrorMonitor(opts: MonitorOptions): TileErrorMonitor {
  const cooldownMs = opts.cooldownMs ?? 30_000
  let timestamps: number[] = []
  let lastTripAt = 0

  return {
    recordError() {
      const now = Date.now()
      timestamps.push(now)
      timestamps = timestamps.filter((t) => now - t <= opts.windowMs)
      if (now - lastTripAt < cooldownMs) return
      if (timestamps.length >= opts.threshold) {
        lastTripAt = now
        opts.onTrip()
      }
    },
    reset() {
      timestamps = []
      lastTripAt = 0
    },
  }
}
```

- [ ] **Step 1.3.13: Run the test and verify it passes**

Run: `npm test src/map/errors/tileErrorMonitor.test.ts`
Expected: 4 tests passing.

### MapLibre mock

- [ ] **Step 1.3.14: Write `src/test/mocks/maplibre-gl.ts`**

```typescript
import { vi } from 'vitest'

export class MockMap {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  loaded = false
  styleLoaded = false
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  })
  off = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.listeners.get(event)?.delete(handler)
    return this
  })
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
  addControl = vi.fn()
  removeControl = vi.fn()
  remove = vi.fn()
  getCanvas = vi.fn(() => ({ style: {} as CSSStyleDeclaration }))
  setTerrain = vi.fn()
  getTerrain = vi.fn(() => null)
  addSource = vi.fn()
  removeSource = vi.fn()
  getSource = vi.fn(() => null)
  setStyle = vi.fn()
  resize = vi.fn()
  flyTo = vi.fn()
}

export const NavigationControl = vi.fn().mockImplementation(() => ({}))
export const __mocks__ = { MockMap }

export const Map = vi.fn().mockImplementation(() => new MockMap())

export default { Map, NavigationControl }
```

- [ ] **Step 1.3.15: Apply the mock globally by updating `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.mock('maplibre-gl', () => import('./mocks/maplibre-gl'))

afterEach(() => {
  cleanup()
})
```

### MapView component

- [ ] **Step 1.3.16: Write the failing test `src/map/MapView.test.tsx`**

```typescript
import { render, screen, act } from '@testing-library/react'
import * as maplibre from 'maplibre-gl'
import { MapView } from './MapView'
import { useSettingsStore } from '../store/settings'

const MapMock = maplibre.Map as unknown as ReturnType<typeof vi.fn>

describe('MapView', () => {
  beforeEach(() => {
    MapMock.mockClear()
    useSettingsStore.setState({ maptilerKey: null })
    localStorage.clear()
  })

  it('does not initialize the map when no key is set', () => {
    render(<MapView />)
    expect(MapMock).not.toHaveBeenCalled()
    expect(screen.getByText(/maptiler api key/i)).toBeInTheDocument()
  })

  it('initializes the map with the outdoor style when a key is set', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)
    const args = MapMock.mock.calls[0][0]
    expect(args.style).toBe('https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY')
    expect(args.center).toEqual([-116.0, 49.5])
    expect(args.zoom).toBe(11)
    expect(args.pitch).toBe(45)
  })

  it('opens settings and surfaces an error when the style fetch fails', async () => {
    useSettingsStore.setState({ maptilerKey: 'BAD' })
    const { rerender } = render(<MapView />)

    const map = MapMock.mock.results[0].value as { emit: (e: string, p?: unknown) => void }
    act(() => {
      map.emit('error', { error: { status: 401 }, source: { url: 'style.json' } })
    })
    rerender(<MapView />)

    expect(screen.getByRole('alert')).toHaveTextContent(/maptiler/i)
  })

  it('rebinds the map style when the key changes', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY1' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)

    act(() => {
      useSettingsStore.getState().setMaptilerKey('KEY2')
    })

    const map = MapMock.mock.results[0].value as { setStyle: ReturnType<typeof vi.fn> }
    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY2',
    )
  })
})
```

- [ ] **Step 1.3.17: Run the test and verify it fails**

Run: `npm test src/map/MapView.test.tsx`
Expected: FAIL — `./MapView` not found.

- [ ] **Step 1.3.18: Write `src/map/MapView.module.css`**

```css
.container {
  position: absolute;
  inset: 0;
}

.canvas {
  position: absolute;
  inset: 0;
}

.banner {
  position: absolute;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-warn);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  gap: var(--space-md);
  align-items: center;
  z-index: 10;
}

.bannerDismiss {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  font-size: 18px;
}

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-text-dim);
  text-align: center;
  padding: var(--space-xl);
}
```

- [ ] **Step 1.3.19: Write `src/map/MapView.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './MapView.module.css'
import { useSettingsStore } from '../store/settings'
import { useUiStore } from '../store/ui'
import { styleUrl } from './mapConfig'
import { createTileErrorMonitor } from './errors/tileErrorMonitor'
import { MAP_DEFAULTS } from '../types'
import { debug } from '../utils/debug'

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const [styleError, setStyleError] = useState<string | null>(null)
  const [tileBannerVisible, setTileBannerVisible] = useState(false)

  // Initial mount: create map instance once we have a key.
  useEffect(() => {
    if (!maptilerKey || !containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(MAP_DEFAULTS.basemap, maptilerKey),
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current = map

    const monitor = createTileErrorMonitor({
      threshold: 3,
      windowMs: 10_000,
      onTrip: () => setTileBannerVisible(true),
    })

    const handleError = (event: { error?: { status?: number }; source?: { url?: string } }) => {
      const status = event.error?.status
      const url = event.source?.url ?? ''
      debug('map error', status, url)
      if (url.includes('style.json') && status && status >= 400) {
        setStyleError(`Maptiler returned ${status}. Check your API key.`)
        setActiveTab('settings')
        return
      }
      monitor.recordError()
    }
    map.on('error', handleError)

    return () => {
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
    }
  }, [maptilerKey, setActiveTab])

  // When the key changes after the map exists, rebind the style.
  useEffect(() => {
    if (!mapRef.current || !maptilerKey) return
    setStyleError(null)
    setTileBannerVisible(false)
    mapRef.current.setStyle(styleUrl(MAP_DEFAULTS.basemap, maptilerKey))
  }, [maptilerKey])

  if (!maptilerKey) {
    return (
      <div className={styles.empty}>
        <div>
          <p>A Maptiler API key is required to load the map.</p>
          <p>Open Settings to enter your key.</p>
          <p style={{ marginTop: 'var(--space-md)' }}>
            <a
              href="https://cloud.maptiler.com/account/keys/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a free Maptiler key →
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
      {styleError && (
        <div role="alert" className={styles.banner}>
          <span>{styleError}</span>
        </div>
      )}
      {tileBannerVisible && !styleError && (
        <div role="status" className={styles.banner}>
          <span>Tile loading is failing — your key may be invalid or over quota.</span>
          <button
            type="button"
            className={styles.bannerDismiss}
            onClick={() => setTileBannerVisible(false)}
            aria-label="Dismiss tile-error banner"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 1.3.20: Run the MapView test and verify it passes**

Run: `npm test src/map/MapView.test.tsx`
Expected: 4 tests passing.

- [ ] **Step 1.3.21: Mount `MapView` in `App.tsx`**

```typescript
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
```

- [ ] **Step 1.3.22: Hydrate the settings store at app startup**

Add to `src/main.tsx` (after the imports, before the render):

```typescript
import { useSettingsStore } from './store/settings'
useSettingsStore.getState().hydrateFromStorage()
```

So the file becomes:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useSettingsStore } from './store/settings'
import './theme.css'

useSettingsStore.getState().hydrateFromStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 1.3.23: Run the full test suite**

Run: `npm test`
Expected: all tests passing across `App`, `Sidebar`, `ui`, `settings`, `mapConfig`, `tileErrorMonitor`, `MapView`.

- [ ] **Step 1.3.24: Visually verify in the browser**

Run: `npm run dev`. Open http://localhost:5173:

- With no key, the map area shows the empty-state message and the link to maptiler.com.
- Manually set a key in DevTools: `localStorage.setItem('couloir_maptiler_key', 'YOUR_KEY')`, reload. The map should render Outdoor at the Fernie default location with zoom controls in the top-right.
- Set a deliberately bad key (`'invalid'`), reload. The error banner appears and the Settings tab becomes active.
- Reset to a good key, reload. Map renders again.

Stop the dev server.

- [ ] **Step 1.3.25: Commit**

```bash
git add src/store/settings.ts src/store/settings.test.ts src/map/ src/test/mocks/ src/test/setup.ts src/types/index.ts src/App.tsx src/main.tsx
git commit -m "feat: MapLibre + Maptiler map with error handling

- settings store with localStorage-backed Maptiler key
- mapConfig style URL builders + style validator
- tile-error rolling-window monitor
- MapView component: lifecycle, style rebinding on key change,
  inline style-fetch error, dismissable tile-error banner
- MapLibre mocked in tests via vi.mock"
```

---

## Task 1.4 — 3D terrain

**Files:**
- Modify: `src/store/ui.ts`, `src/store/ui.test.ts` (add terrain state)
- Create: `src/map/controls/TerrainControl.tsx`, `src/map/controls/TerrainControl.module.css`, `src/map/controls/TerrainControl.test.tsx`
- Modify: `src/map/MapView.tsx` (add the DEM source, apply terrain, mount the control)

The exaggeration value persists in `localStorage` under `couloir_terrain_exaggeration` and is hydrated at startup. The terrain on/off state is purely UI state (defaults to on).

- [ ] **Step 1.4.1: Extend the ui-store test for terrain state**

Add to `src/store/ui.test.ts`:

```typescript
describe('ui store — terrain', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ terrainEnabled: true, terrainExaggeration: 1.5 })
  })

  it('defaults terrain enabled with exaggeration 1.5', () => {
    expect(useUiStore.getState().terrainEnabled).toBe(true)
    expect(useUiStore.getState().terrainExaggeration).toBe(1.5)
  })

  it('toggles terrain', () => {
    useUiStore.getState().toggleTerrain()
    expect(useUiStore.getState().terrainEnabled).toBe(false)
  })

  it('persists exaggeration to localStorage', () => {
    useUiStore.getState().setTerrainExaggeration(2.5)
    expect(localStorage.getItem('couloir_terrain_exaggeration')).toBe('2.5')
    expect(useUiStore.getState().terrainExaggeration).toBe(2.5)
  })

  it('hydrates exaggeration from localStorage', () => {
    localStorage.setItem('couloir_terrain_exaggeration', '2.0')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().terrainExaggeration).toBe(2.0)
  })

  it('clamps exaggeration to [1, 3]', () => {
    useUiStore.getState().setTerrainExaggeration(0.2)
    expect(useUiStore.getState().terrainExaggeration).toBe(1)
    useUiStore.getState().setTerrainExaggeration(7)
    expect(useUiStore.getState().terrainExaggeration).toBe(3)
  })
})
```

- [ ] **Step 1.4.2: Run, verify it fails**

Run: `npm test src/store/ui.test.ts`
Expected: FAIL — `terrainEnabled`, `setTerrainExaggeration`, `hydrateFromStorage` not defined.

- [ ] **Step 1.4.3: Update `src/store/ui.ts`**

```typescript
import { create } from 'zustand'

const TERRAIN_KEY = 'couloir_terrain_exaggeration'
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'

interface UiState {
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  terrainEnabled: boolean
  terrainExaggeration: number
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleTerrain: () => void
  setTerrainExaggeration: (value: number) => void
  hydrateFromStorage: () => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTerrain: () => set((s) => ({ terrainEnabled: !s.terrainEnabled })),
  setTerrainExaggeration: (value) => {
    const next = clamp(value)
    localStorage.setItem(TERRAIN_KEY, String(next))
    set({ terrainExaggeration: next })
  },
  hydrateFromStorage: () => {
    const raw = localStorage.getItem(TERRAIN_KEY)
    if (raw === null) return
    const n = Number(raw)
    if (Number.isFinite(n)) set({ terrainExaggeration: clamp(n) })
  },
}))
```

- [ ] **Step 1.4.4: Run all ui tests, verify they pass**

Run: `npm test src/store/ui.test.ts`
Expected: 8 tests passing.

- [ ] **Step 1.4.5: Hydrate the ui store at startup**

Update `src/main.tsx`:

```typescript
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
```

- [ ] **Step 1.4.6: Write the failing test `src/map/controls/TerrainControl.test.tsx`**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerrainControl } from './TerrainControl'
import { useUiStore } from '../../store/ui'

describe('TerrainControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ terrainEnabled: true, terrainExaggeration: 1.5 })
  })

  it('renders an enabled toggle and the slider value', () => {
    render(<TerrainControl />)
    expect(screen.getByRole('switch', { name: /3d terrain/i })).toBeChecked()
    expect(screen.getByRole('slider', { name: /exaggeration/i })).toHaveValue('1.5')
  })

  it('toggles terrain on click', async () => {
    const user = userEvent.setup()
    render(<TerrainControl />)
    await user.click(screen.getByRole('switch', { name: /3d terrain/i }))
    expect(useUiStore.getState().terrainEnabled).toBe(false)
  })

  it('updates exaggeration on slider change', () => {
    render(<TerrainControl />)
    fireEvent.change(screen.getByRole('slider', { name: /exaggeration/i }), {
      target: { value: '2.5' },
    })
    expect(useUiStore.getState().terrainExaggeration).toBe(2.5)
  })

  it('disables the slider when terrain is off', () => {
    useUiStore.setState({ terrainEnabled: false })
    render(<TerrainControl />)
    expect(screen.getByRole('slider', { name: /exaggeration/i })).toBeDisabled()
  })
})
```

- [ ] **Step 1.4.7: Run the test, verify it fails**

Run: `npm test src/map/controls/TerrainControl.test.tsx`
Expected: FAIL — `./TerrainControl` not found.

- [ ] **Step 1.4.8: Write `src/map/controls/TerrainControl.tsx`**

```typescript
import styles from './TerrainControl.module.css'
import { useUiStore } from '../../store/ui'

export function TerrainControl() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const exaggeration = useUiStore((s) => s.terrainExaggeration)
  const toggle = useUiStore((s) => s.toggleTerrain)
  const setExag = useUiStore((s) => s.setTerrainExaggeration)

  return (
    <div className={styles.control}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          aria-label="3D terrain"
          checked={enabled}
          onChange={toggle}
        />
        <span>3D Terrain</span>
      </label>
      <label className={styles.slider}>
        <span>Exaggeration</span>
        <input
          type="range"
          aria-label="Exaggeration"
          min={1}
          max={3}
          step={0.1}
          value={exaggeration}
          disabled={!enabled}
          onChange={(e) => setExag(Number(e.target.value))}
        />
        <span className={styles.value}>{exaggeration.toFixed(1)}×</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 1.4.9: Write `src/map/controls/TerrainControl.module.css`**

```css
.control {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-md);
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  z-index: 5;
}

.toggle,
.slider {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 12px;
}

.slider input[type='range'] {
  width: 120px;
}

.value {
  width: 32px;
  text-align: right;
  color: var(--color-text-dim);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 1.4.10: Run the TerrainControl test, verify it passes**

Run: `npm test src/map/controls/TerrainControl.test.tsx`
Expected: 4 tests passing.

- [ ] **Step 1.4.11: Wire terrain into `MapView.tsx`**

Add the DEM source on map load and reactively apply / remove terrain when the store state changes. Add the import:

```typescript
import { TerrainControl } from './controls/TerrainControl'
import { terrainSourceUrl } from './mapConfig'
```

Inside the `MapView` function, change the initial-mount effect to install the DEM source after `style.load`:

```typescript
useEffect(() => {
  if (!maptilerKey || !containerRef.current || mapRef.current) return

  const map = new maplibregl.Map({
    container: containerRef.current,
    style: styleUrl(MAP_DEFAULTS.basemap, maptilerKey),
    center: MAP_DEFAULTS.center,
    zoom: MAP_DEFAULTS.zoom,
    pitch: MAP_DEFAULTS.pitch,
    bearing: MAP_DEFAULTS.bearing,
  })
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
  mapRef.current = map

  const installDem = () => {
    if (!map.getSource('maptiler-dem')) {
      map.addSource('maptiler-dem', {
        type: 'raster-dem',
        url: terrainSourceUrl(maptilerKey),
        tileSize: 256,
      })
    }
    const { terrainEnabled, terrainExaggeration } = useUiStore.getState()
    if (terrainEnabled) {
      map.setTerrain({ source: 'maptiler-dem', exaggeration: terrainExaggeration })
    }
  }
  map.on('style.load', installDem)

  const monitor = createTileErrorMonitor({
    threshold: 3,
    windowMs: 10_000,
    onTrip: () => setTileBannerVisible(true),
  })

  const handleError = (event: { error?: { status?: number }; source?: { url?: string } }) => {
    const status = event.error?.status
    const url = event.source?.url ?? ''
    debug('map error', status, url)
    if (url.includes('style.json') && status && status >= 400) {
      setStyleError(`Maptiler returned ${status}. Check your API key.`)
      setActiveTab('settings')
      return
    }
    monitor.recordError()
  }
  map.on('error', handleError)

  return () => {
    map.off('style.load', installDem)
    map.off('error', handleError)
    map.remove()
    mapRef.current = null
  }
}, [maptilerKey, setActiveTab])
```

Add a second effect that responds to terrain state changes:

```typescript
const terrainEnabled = useUiStore((s) => s.terrainEnabled)
const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)

useEffect(() => {
  const map = mapRef.current
  if (!map) return
  if (terrainEnabled) {
    map.setTerrain({ source: 'maptiler-dem', exaggeration: terrainExaggeration })
  } else {
    map.setTerrain(null)
  }
}, [terrainEnabled, terrainExaggeration])
```

And render the control when the map is initialized:

```typescript
return (
  <div className={styles.container}>
    <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
    <TerrainControl />
    {styleError && (
      <div role="alert" className={styles.banner}>
        <span>{styleError}</span>
      </div>
    )}
    {tileBannerVisible && !styleError && (
      <div role="status" className={styles.banner}>
        <span>Tile loading is failing — your key may be invalid or over quota.</span>
        <button
          type="button"
          className={styles.bannerDismiss}
          onClick={() => setTileBannerVisible(false)}
          aria-label="Dismiss tile-error banner"
        >
          ×
        </button>
      </div>
    )}
  </div>
)
```

- [ ] **Step 1.4.12: Run the full test suite, fix anything broken**

Run: `npm test`
Expected: all passing. The MapView tests don't assert terrain-source behavior; they cover lifecycle and key change. Terrain is exercised by `TerrainControl` tests against the store.

- [ ] **Step 1.4.13: Visual check**

Run: `npm run dev`. With a valid key, the map should render with 3D terrain visible (mountainous areas show clearly). The terrain control sits in the bottom-right; toggling it flattens/raises the terrain; the slider scales the effect. Reload the page — exaggeration value persists.

- [ ] **Step 1.4.14: Commit**

```bash
git add src/store/ui.ts src/store/ui.test.ts src/map/controls/TerrainControl.tsx src/map/controls/TerrainControl.module.css src/map/controls/TerrainControl.test.tsx src/map/MapView.tsx src/main.tsx
git commit -m "feat: 3D terrain with toggle and exaggeration slider"
```

---

## Task 1.5 — Basemap switcher

**Files:**
- Modify: `src/store/ui.ts`, `src/store/ui.test.ts` (active basemap state, persisted)
- Create: `src/map/controls/BasemapControl.tsx`, `src/map/controls/BasemapControl.module.css`, `src/map/controls/BasemapControl.test.tsx`
- Modify: `src/map/MapView.tsx` (apply style on basemap change; preserve sources)

Switching basemaps via `map.setStyle()` removes all custom sources and layers by default. We re-install the DEM source and re-apply terrain in the existing `style.load` handler from Task 1.4 — that's why we put the DEM install behind that event. (Future phases that add custom sources for routes/tracks/etc. will hook into the same event.)

- [ ] **Step 1.5.1: Extend the ui-store test for basemap state**

Add to `src/store/ui.test.ts`:

```typescript
describe('ui store — basemap', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ activeBasemap: 'outdoor' })
  })

  it('defaults to outdoor', () => {
    expect(useUiStore.getState().activeBasemap).toBe('outdoor')
  })

  it('persists basemap on change', () => {
    useUiStore.getState().setBasemap('satellite')
    expect(localStorage.getItem('couloir_basemap')).toBe('satellite')
    expect(useUiStore.getState().activeBasemap).toBe('satellite')
  })

  it('hydrates basemap from localStorage', () => {
    localStorage.setItem('couloir_basemap', 'winter')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().activeBasemap).toBe('winter')
  })

  it('ignores unknown values during hydration', () => {
    localStorage.setItem('couloir_basemap', 'mars')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().activeBasemap).toBe('outdoor')
  })
})
```

- [ ] **Step 1.5.2: Run, verify it fails**

Run: `npm test src/store/ui.test.ts`
Expected: FAIL — `activeBasemap`, `setBasemap` not defined.

- [ ] **Step 1.5.3: Update `src/store/ui.ts`**

```typescript
import { create } from 'zustand'
import type { Basemap } from '../types'

const TERRAIN_KEY  = 'couloir_terrain_exaggeration'
const BASEMAP_KEY  = 'couloir_basemap'
const VALID_BASEMAPS: ReadonlySet<Basemap> = new Set(['satellite', 'outdoor', 'winter'])
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'

interface UiState {
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  terrainEnabled: boolean
  terrainExaggeration: number
  activeBasemap: Basemap
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleTerrain: () => void
  setTerrainExaggeration: (value: number) => void
  setBasemap: (basemap: Basemap) => void
  hydrateFromStorage: () => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  activeBasemap: 'outdoor',
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTerrain: () => set((s) => ({ terrainEnabled: !s.terrainEnabled })),
  setTerrainExaggeration: (value) => {
    const next = clamp(value)
    localStorage.setItem(TERRAIN_KEY, String(next))
    set({ terrainExaggeration: next })
  },
  setBasemap: (basemap) => {
    localStorage.setItem(BASEMAP_KEY, basemap)
    set({ activeBasemap: basemap })
  },
  hydrateFromStorage: () => {
    const rawTerrain = localStorage.getItem(TERRAIN_KEY)
    if (rawTerrain !== null) {
      const n = Number(rawTerrain)
      if (Number.isFinite(n)) set({ terrainExaggeration: clamp(n) })
    }
    const rawBasemap = localStorage.getItem(BASEMAP_KEY)
    if (rawBasemap && VALID_BASEMAPS.has(rawBasemap as Basemap)) {
      set({ activeBasemap: rawBasemap as Basemap })
    }
  },
}))
```

- [ ] **Step 1.5.4: Run all ui tests, verify they pass**

Run: `npm test src/store/ui.test.ts`
Expected: all passing (12 tests across the file).

- [ ] **Step 1.5.5: Write the failing test `src/map/controls/BasemapControl.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BasemapControl } from './BasemapControl'
import { useUiStore } from '../../store/ui'

describe('BasemapControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ activeBasemap: 'outdoor' })
  })

  it('renders three buttons with the active one pressed', () => {
    render(<BasemapControl />)
    expect(screen.getByRole('button', { name: /satellite/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /outdoor/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /winter/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the basemap on click', async () => {
    const user = userEvent.setup()
    render(<BasemapControl />)
    await user.click(screen.getByRole('button', { name: /winter/i }))
    expect(useUiStore.getState().activeBasemap).toBe('winter')
  })
})
```

- [ ] **Step 1.5.6: Run, verify it fails**

Run: `npm test src/map/controls/BasemapControl.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 1.5.7: Write `src/map/controls/BasemapControl.tsx`**

```typescript
import styles from './BasemapControl.module.css'
import { useUiStore } from '../../store/ui'
import type { Basemap } from '../../types'

const OPTIONS: ReadonlyArray<{ id: Basemap; label: string }> = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'outdoor',   label: 'Outdoor'   },
  { id: 'winter',    label: 'Winter'    },
]

export function BasemapControl() {
  const active = useUiStore((s) => s.activeBasemap)
  const setBasemap = useUiStore((s) => s.setBasemap)

  return (
    <div className={styles.control} role="group" aria-label="Basemap">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={styles.button}
          aria-pressed={active === opt.id}
          onClick={() => setBasemap(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 1.5.8: Write `src/map/controls/BasemapControl.module.css`**

```css
.control {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  overflow: hidden;
  z-index: 5;
}

.button {
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.button:hover {
  color: var(--color-text);
}

.button[aria-pressed='true'] {
  background: var(--color-bg-1);
  color: var(--color-text);
}

.button + .button {
  border-left: 1px solid var(--color-border);
}
```

Note: the BasemapControl is at top-right; MapLibre's NavigationControl is also at top-right. Reposition the navigation control to top-left in the MapView (next step) so they don't overlap.

- [ ] **Step 1.5.9: Run BasemapControl test, verify it passes**

Run: `npm test src/map/controls/BasemapControl.test.tsx`
Expected: 2 tests passing.

- [ ] **Step 1.5.10: Wire basemap switching into `MapView.tsx`**

Two changes:

**A.** Move the NavigationControl to `'top-left'`:

```typescript
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
```

**B.** Add an effect that calls `setStyle` when `activeBasemap` changes, and use the active basemap from the store for the initial style. Replace the existing key-change effect with one that handles both:

```typescript
const activeBasemap = useUiStore((s) => s.activeBasemap)

useEffect(() => {
  const map = mapRef.current
  if (!map || !maptilerKey) return
  setStyleError(null)
  setTileBannerVisible(false)
  map.setStyle(styleUrl(activeBasemap, maptilerKey))
  // The DEM source and terrain reattach via the 'style.load' handler set up
  // in the initial-mount effect.
}, [maptilerKey, activeBasemap])
```

And in the initial-mount effect, change the initial style URL to use `activeBasemap` from the store:

```typescript
const map = new maplibregl.Map({
  container: containerRef.current,
  style: styleUrl(useUiStore.getState().activeBasemap, maptilerKey),
  center: MAP_DEFAULTS.center,
  zoom: MAP_DEFAULTS.zoom,
  pitch: MAP_DEFAULTS.pitch,
  bearing: MAP_DEFAULTS.bearing,
})
```

Add `<BasemapControl />` to the rendered output:

```typescript
return (
  <div className={styles.container}>
    <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
    <BasemapControl />
    <TerrainControl />
    {/* banners remain unchanged */}
  </div>
)
```

Import:

```typescript
import { BasemapControl } from './controls/BasemapControl'
```

- [ ] **Step 1.5.11: Run full test suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 1.5.12: Visual check**

Run: `npm run dev`. With a valid key:
- All three basemaps render at the same map position.
- Switching basemaps preserves zoom/center/pitch.
- Terrain still applies on every basemap (the DEM reattaches on `style.load`).
- Reload the page — the previously-selected basemap is active.

Stop the dev server.

- [ ] **Step 1.5.13: Commit**

```bash
git add src/store/ui.ts src/store/ui.test.ts src/map/controls/BasemapControl.tsx src/map/controls/BasemapControl.module.css src/map/controls/BasemapControl.test.tsx src/map/MapView.tsx
git commit -m "feat: basemap switcher with persistence (satellite/outdoor/winter)"
```

---

## Task 1.6 — Settings panel

**Files:**
- Create: `src/panels/SettingsPanel/SettingsPanel.tsx`, `SettingsPanel.module.css`, `SettingsPanel.test.tsx`
- Modify: `src/App.tsx` (mount SettingsPanel inside the Sidebar's content area)
- Modify: `src/panels/Sidebar.tsx` (host the panel content based on `activeTab`)
- Modify: `src/panels/Sidebar.module.css`

For Phase 1 the Settings panel content covers what we already have: Maptiler API key, terrain default, app version. Map defaults (center/zoom/pitch) and the export/import buttons land in later phases.

- [ ] **Step 1.6.1: Update `src/panels/Sidebar.tsx` to host content slot**

```typescript
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
```

- [ ] **Step 1.6.2: Add the content style to `Sidebar.module.css`**

Append:

```css
.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  border-top: 1px solid var(--color-border);
}
```

- [ ] **Step 1.6.3: Update `src/panels/Sidebar.test.tsx` to pass empty panels**

Modify the `render(<Sidebar />)` calls to pass an empty panel map so the existing tests keep working:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { useUiStore } from '../store/ui'

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'layers', sidebarCollapsed: false })
  })

  it('renders three tab buttons', () => {
    render(<Sidebar panels={{}} />)
    expect(screen.getByRole('button', { name: /layers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Sidebar panels={{}} />)
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches the active tab on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar panels={{}} />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(useUiStore.getState().activeTab).toBe('settings')
  })

  it('toggles collapse on the collapse button', async () => {
    const user = userEvent.setup()
    render(<Sidebar panels={{}} />)
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('renders the panel for the active tab', () => {
    useUiStore.setState({ activeTab: 'settings' })
    render(<Sidebar panels={{ settings: <div>SETTINGS_PANEL</div> }} />)
    expect(screen.getByText('SETTINGS_PANEL')).toBeInTheDocument()
  })

  it('does not render content when collapsed', () => {
    useUiStore.setState({ sidebarCollapsed: true, activeTab: 'settings' })
    render(<Sidebar panels={{ settings: <div>SETTINGS_PANEL</div> }} />)
    expect(screen.queryByText('SETTINGS_PANEL')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 1.6.4: Write the failing test `src/panels/SettingsPanel/SettingsPanel.test.tsx`**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPanel } from './SettingsPanel'
import { useSettingsStore } from '../../store/settings'
import { useUiStore } from '../../store/ui'

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ maptilerKey: null })
    useUiStore.setState({ terrainExaggeration: 1.5 })
  })

  it('shows an empty key state and saves what the user types', async () => {
    const user = userEvent.setup()
    render(<SettingsPanel />)
    const input = screen.getByLabelText(/maptiler api key/i)
    expect(input).toHaveValue('')
    await user.type(input, 'NEWKEY')
    await user.click(screen.getByRole('button', { name: /save key/i }))
    expect(useSettingsStore.getState().maptilerKey).toBe('NEWKEY')
  })

  it('renders a masked value when a key is already set', () => {
    useSettingsStore.setState({ maptilerKey: 'AB12345678' })
    render(<SettingsPanel />)
    expect(screen.getByText(/key set/i)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('AB12345678')).not.toBeInTheDocument()
  })

  it('replaces the key when the user clicks Replace', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ maptilerKey: 'OLD' })
    render(<SettingsPanel />)
    await user.click(screen.getByRole('button', { name: /replace/i }))
    const input = screen.getByLabelText(/maptiler api key/i)
    await user.type(input, 'NEW')
    await user.click(screen.getByRole('button', { name: /save key/i }))
    expect(useSettingsStore.getState().maptilerKey).toBe('NEW')
  })

  it('updates terrain exaggeration default through the slider', () => {
    render(<SettingsPanel />)
    fireEvent.change(screen.getByRole('slider', { name: /terrain exaggeration/i }), {
      target: { value: '2' },
    })
    expect(useUiStore.getState().terrainExaggeration).toBe(2)
  })
})
```

- [ ] **Step 1.6.5: Run, verify it fails**

Run: `npm test src/panels/SettingsPanel/SettingsPanel.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 1.6.6: Write `src/panels/SettingsPanel/SettingsPanel.tsx`**

```typescript
import { useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useSettingsStore } from '../../store/settings'
import { useUiStore } from '../../store/ui'

export function SettingsPanel() {
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const setTerrainExaggeration = useUiStore((s) => s.setTerrainExaggeration)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(maptilerKey === null)

  const save = () => {
    if (draft.trim().length === 0) return
    setMaptilerKey(draft.trim())
    setDraft('')
    setEditing(false)
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Settings</h2>

      <section className={styles.section}>
        <h3>Maptiler</h3>
        {!editing && maptilerKey !== null ? (
          <div className={styles.row}>
            <span className={styles.subtle}>Key set ({maptilerKey.slice(0, 4)}…)</span>
            <button type="button" onClick={() => setEditing(true)}>Replace</button>
          </div>
        ) : (
          <div className={styles.column}>
            <label className={styles.field}>
              <span>Maptiler API key</span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div className={styles.row}>
              <button type="button" onClick={save}>Save key</button>
              {maptilerKey !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            <a
              className={styles.subtle}
              href="https://cloud.maptiler.com/account/keys/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a free Maptiler key →
            </a>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Map defaults</h3>
        <label className={styles.field}>
          <span>Terrain exaggeration</span>
          <input
            type="range"
            aria-label="Terrain exaggeration"
            min={1}
            max={3}
            step={0.1}
            value={terrainExaggeration}
            onChange={(e) => setTerrainExaggeration(Number(e.target.value))}
          />
          <span className={styles.subtle}>{terrainExaggeration.toFixed(1)}×</span>
        </label>
      </section>

      <section className={styles.section}>
        <h3>About</h3>
        <p className={styles.subtle}>Couloir 0.0.1</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 1.6.7: Write `src/panels/SettingsPanel/SettingsPanel.module.css`**

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.heading {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-dim);
}

.row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field input[type='text'] {
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  color: var(--color-text);
  font: inherit;
}

.field input[type='range'] {
  width: 100%;
}

.subtle {
  color: var(--color-text-dim);
  font-size: 12px;
}

.section button {
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font: inherit;
}

.section button:hover {
  background: var(--color-bg-1);
}
```

- [ ] **Step 1.6.8: Mount Settings in `App.tsx`**

```typescript
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
```

- [ ] **Step 1.6.9: Run the full test suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 1.6.10: Visual check**

Run: `npm run dev`. With no key, the map area shows the empty state and the Settings tab is highlighted (because `MapView`'s style-error path opens it). Enter a key in the Settings panel, click Save — map renders. Click Replace, change the key — map rebinds. Adjust the terrain slider — map terrain updates live and the value persists across reload.

- [ ] **Step 1.6.11: Commit**

```bash
git add src/panels/Sidebar.tsx src/panels/Sidebar.test.tsx src/panels/Sidebar.module.css src/panels/SettingsPanel/ src/App.tsx
git commit -m "feat: settings panel with API key + terrain defaults"
```

---

## Task 1.7 — Layer panel scaffold

**Files:**
- Create: `src/panels/LayerPanel/LayerPanel.tsx`, `LayerPanel.module.css`, `LayerPanel.test.tsx`
- Modify: `src/store/ui.ts`, `src/store/ui.test.ts` (per-layer visibility toggle)
- Modify: `src/App.tsx` (mount LayerPanel as the layers panel)

The layer panel is a scaffold for Phases 3–5. It renders four rows (Routes, Tracks, Waypoints, Photos), each with a visibility toggle, a color swatch (using the default color per layer type from `DATA-MODEL.md`), and a count badge currently fixed at `0`. Toggles update store state but have no visual effect on the map yet.

- [ ] **Step 1.7.1: Extend the ui-store test for layer visibility**

Add to `src/store/ui.test.ts`:

```typescript
describe('ui store — layer visibility', () => {
  beforeEach(() => {
    useUiStore.setState({
      layerVisibility: { routes: true, tracks: true, waypoints: true, photos: true },
    })
  })

  it('defaults all layers visible', () => {
    expect(useUiStore.getState().layerVisibility).toEqual({
      routes: true, tracks: true, waypoints: true, photos: true,
    })
  })

  it('toggles a single layer', () => {
    useUiStore.getState().toggleLayer('routes')
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
    expect(useUiStore.getState().layerVisibility.tracks).toBe(true)
  })
})
```

- [ ] **Step 1.7.2: Run, verify it fails**

Run: `npm test src/store/ui.test.ts`
Expected: FAIL — `layerVisibility`, `toggleLayer` not defined.

- [ ] **Step 1.7.3: Update `src/store/ui.ts`**

Add the type and state:

```typescript
export type LayerKey = 'routes' | 'tracks' | 'waypoints' | 'photos'

interface UiState {
  // ...existing fields...
  layerVisibility: Record<LayerKey, boolean>
  toggleLayer: (layer: LayerKey) => void
}
```

In the store factory:

```typescript
layerVisibility: { routes: true, tracks: true, waypoints: true, photos: true },
toggleLayer: (layer) =>
  set((s) => ({
    layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] },
  })),
```

- [ ] **Step 1.7.4: Run all ui tests, verify they pass**

Run: `npm test src/store/ui.test.ts`
Expected: all passing.

- [ ] **Step 1.7.5: Write the failing test `src/panels/LayerPanel/LayerPanel.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'

describe('LayerPanel', () => {
  beforeEach(() => {
    useUiStore.setState({
      layerVisibility: { routes: true, tracks: true, waypoints: true, photos: true },
    })
  })

  it('renders four rows with zero counts', () => {
    render(<LayerPanel />)
    for (const label of ['Routes', 'Tracks', 'Waypoints', 'Photos']) {
      const row = screen.getByText(label).closest('[data-row]')
      expect(row).not.toBeNull()
      expect(row).toHaveTextContent(/\b0\b/)
    }
  })

  it('toggles layer visibility on click', async () => {
    const user = userEvent.setup()
    render(<LayerPanel />)
    await user.click(screen.getByRole('switch', { name: /routes visibility/i }))
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
  })
})
```

- [ ] **Step 1.7.6: Run, verify it fails**

Run: `npm test src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 1.7.7: Write `src/panels/LayerPanel/LayerPanel.tsx`**

```typescript
import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'

interface RowDef {
  key: LayerKey
  label: string
  color: string
}

const ROWS: ReadonlyArray<RowDef> = [
  { key: 'routes',    label: 'Routes',    color: '#E05C2A' },
  { key: 'tracks',    label: 'Tracks',    color: '#2A7BE0' },
  { key: 'waypoints', label: 'Waypoints', color: '#FBBF24' },
  { key: 'photos',    label: 'Photos',    color: '#94A3B8' },
]

export function LayerPanel() {
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <ul className={styles.rows}>
        {ROWS.map((row) => (
          <li key={row.key} className={styles.row} data-row={row.key}>
            <span className={styles.swatch} style={{ background: row.color }} aria-hidden="true" />
            <span className={styles.label}>{row.label}</span>
            <span className={styles.count}>0</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={`${row.label} visibility`}
              checked={visibility[row.key]}
              onChange={() => toggleLayer(row.key)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 1.7.8: Write `src/panels/LayerPanel/LayerPanel.module.css`**

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.heading {
  margin: 0;
  font-size: 16px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.swatch {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.label {
  color: var(--color-text);
}

.count {
  color: var(--color-text-dim);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  min-width: 24px;
  text-align: right;
}
```

- [ ] **Step 1.7.9: Run the LayerPanel test, verify it passes**

Run: `npm test src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: 2 tests passing.

- [ ] **Step 1.7.10: Mount in `App.tsx`**

```typescript
import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'
import { LayerPanel } from './panels/LayerPanel/LayerPanel'

export default function App() {
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
```

- [ ] **Step 1.7.11: Run the full test suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 1.7.12: Visual check**

Run: `npm run dev`. With a valid key, the Layers tab shows four rows with color swatches and `0` counts. Toggles flip the switch state visually but have no effect on the map (no data sources yet — this is correct for Phase 1).

- [ ] **Step 1.7.13: Commit**

```bash
git add src/store/ui.ts src/store/ui.test.ts src/panels/LayerPanel/ src/App.tsx
git commit -m "feat: layer panel scaffold with four toggle rows"
```

---

## End-of-phase verification

- [ ] **Run typecheck and tests**

```
npm run typecheck
npm test
```

Both should complete cleanly.

- [ ] **Run a build**

```
npm run build
```

The TypeScript compile and Vite build should both succeed. `dist/` should contain the built artifacts.

- [ ] **Manual smoke test against the deliverable goals**

With a valid Maptiler key:
- Map renders 3D terrain centered on Fernie, BC.
- All three basemaps (Satellite, Outdoor, Winter) load and switch without losing position.
- Terrain exaggeration slider works in both the map control and the settings panel; value persists across reload.
- Switching the basemap persists across reload.
- Replacing the API key in Settings rebinds the map without a reload.
- Clearing the key drops back to the empty state.
- Sidebar tabs (Layers / Search / Settings) switch correctly; collapse/expand works.
- Layer panel shows four rows with `0` counts and working visibility switches.

If anything fails, fix it before moving to Phase 2.

- [ ] **(Optional) Tag the commit**

```
git tag phase-1-shell
```

This phase is the foundation Phase 2 builds on.

---

## Notes for the implementer

**Why MapLibre is mocked in tests.** A real MapLibre instance needs WebGL, which jsdom doesn't have. Mocking at the module level lets us test lifecycle (constructor called with right args, key change calls `setStyle`, error events route correctly) without dragging in a headless-browser test stack. If a future test really needs a live map, that's Playwright territory — out of scope for Phase 1.

**Why the DEM source is installed inside `style.load`, not directly after `new Map(...)`.** Switching basemaps via `setStyle()` clears all sources and layers. Re-attaching them in the `style.load` handler covers both initial load and every basemap switch with the same code path. Phase 3 will follow the same pattern when it adds the routes/tracks GeoJSON sources.

**Why the layer panel state is in the UI slice, not a layers slice.** The visibility toggles are pure UI state — they don't drive what's loaded into the store, just what's rendered. Keeping them in `ui` matches the rest of the panel/placement/basemap state and avoids a slice that's effectively just a `Record<LayerKey, boolean>`.

**Style URL builders are pure functions.** `mapConfig.ts` deliberately avoids reading the store. This makes URL construction trivially testable and keeps the map module from tangling with state hydration order.
