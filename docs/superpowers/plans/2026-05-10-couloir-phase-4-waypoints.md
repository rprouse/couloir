# Couloir Phase 4 — Waypoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place named waypoints on the map by clicking, render them with category icons, open a detail panel on click, edit/delete from the panel, and drag the marker to reposition. The Layer panel gains an "Add Waypoint" button and a placement-mode banner appears above the map while a waypoint is being placed.

**Architecture:** No new state-machine actions are added — Phase 2 already wired `startWaypointPlacement`, `completePlacement`, `cancelPlacement`, and the ESC precedence. Phase 4 adds *subscribers* and *triggers*. The Layer panel grows an "Add Waypoint" button that dispatches `startWaypointPlacement()`. A new `PlacementBanner` overlay reads `useUiStore((s) => s.placement)` and shows the prompt while placement is active. `MapView` subscribes to placement state to swap the cursor and register a one-shot map click that dispatches `completePlacement(lat, lng)`. A new `WaypointsLayer` mirrors the `RoutesLayer` shape — pure GeoJSON builder + a thin layer component — but uses a symbol layer with category icons generated programmatically via canvas and registered with `map.addImage()`. The DetailPanel router gets a `waypoint` view/edit branch (`WaypointDetail`) and a `waypoint` create branch (`WaypointCreate`), both following the existing `RouteDetail` shape. Drag-to-reposition is implemented inside the layer component: `mousedown` on a waypoint symbol disables `map.dragPan` and starts a drag; `mousemove` mutates the source GeoJSON for live feedback; `mouseup` commits the new lat/lng via `useWaypointsStore.update()` and re-enables `dragPan`.

**Tech Stack:** MapLibre symbol layer + `map.addImage` for the icon set, browser 2D canvas for programmatic icon generation, `map.queryTerrainElevation` for autofill, Vitest + React Testing Library for tests. No new dependencies.

**Spec references:** `SPEC.md` (Waypoints section), `ARCHITECTURE.md` (Map Layer Architecture, State Management/panel + placement state, Global ESC key handler), `DATA-MODEL.md` (`Waypoint` type, `WAYPOINT_CATEGORIES`), `TASKS.md` Tasks 4.1–4.5.

**Out of scope for this phase:** Photo placement and EXIF (Phase 5), tag *management* and *filtering* UI (Phase 6.1/6.2 — tag pills render in the detail panel read-only using the existing `tags` store), ZIP import/export (Phase 6.4), waypoint import from GPX `<wpt>` (post-MVP backlog), spatial indexes / viewport filtering (post-MVP).

---

## File Structure

```
couloir/
├── src/
│   ├── App.tsx                                            Task 4.1 (mount PlacementBanner)
│   ├── map/
│   │   ├── MapView.tsx                                    Task 4.1 (mount WaypointsLayer + placement cursor/click)
│   │   ├── placement/
│   │   │   ├── usePlacementMapBinding.ts                  Task 4.1 (cursor swap + one-shot click)
│   │   │   └── usePlacementMapBinding.test.ts             Task 4.1 (pure handler shape)
│   │   └── layers/
│   │       ├── layerStyles.ts                             Tasks 4.3 (extend with WAYPOINTS_*)
│   │       ├── WaypointsLayer.tsx                         Task 4.3
│   │       ├── waypointsLayerData.ts                      Task 4.3 (pure GeoJSON builder)
│   │       ├── waypointsLayerData.test.ts                 Task 4.3
│   │       ├── wpIcons.ts                                 Task 4.3 (canvas-generated category icons)
│   │       └── wpIcons.test.ts                            Task 4.3
│   ├── panels/
│   │   ├── PlacementBanner/
│   │   │   ├── PlacementBanner.tsx                        Task 4.1
│   │   │   ├── PlacementBanner.module.css                 Task 4.1
│   │   │   └── PlacementBanner.test.tsx                   Task 4.1
│   │   ├── LayerPanel/
│   │   │   ├── LayerPanel.tsx                             Task 4.1 (Add Waypoint button)
│   │   │   └── LayerPanel.test.tsx                        Task 4.1, 4.5 (button dispatch + count)
│   │   └── DetailPanel/
│   │       ├── DetailPanel.tsx                            Task 4.2, 4.4 (route 'waypoint' view/edit + create)
│   │       ├── WaypointCreate.tsx                         Task 4.2
│   │       ├── WaypointCreate.test.tsx                    Task 4.2
│   │       ├── WaypointDetail.tsx                         Task 4.4
│   │       └── WaypointDetail.test.tsx                    Task 4.4
└── (no waypoint slice changes — `useWaypointsStore` from Phase 2 already exposes load/add/update/remove)
```

**Test conventions** (carried forward from Phase 3):
- Vitest globals (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`) are enabled — no per-file imports.
- Zustand store tests reset state in `beforeEach`; `InMemoryStorageProvider` backs the storage layer in tests.
- jsdom does not render MapLibre. Layer code is tested through pure helpers (`buildWaypointsGeoJson`, `buildCategoryIcon`). Visual map verification happens in the browser per `TASKS.md` acceptance criteria.

---

## Task 4.1 — Waypoint placement mode

**Files:**
- Create: `src/panels/PlacementBanner/PlacementBanner.tsx`
- Create: `src/panels/PlacementBanner/PlacementBanner.module.css`
- Create: `src/panels/PlacementBanner/PlacementBanner.test.tsx`
- Create: `src/map/placement/usePlacementMapBinding.ts`
- Create: `src/map/placement/usePlacementMapBinding.test.ts`
- Modify: `src/panels/LayerPanel/LayerPanel.tsx`
- Create: `src/panels/LayerPanel/LayerPanel.test.tsx`
- Modify: `src/map/MapView.tsx`
- Modify: `src/App.tsx`

This task ends with: an "Add Waypoint" button in the Layer panel that activates placement mode; a banner overlay above the map that says "Click the map to place a waypoint. Press Escape to cancel." while placement is active; clicking the map dispatches `completePlacement(lat, lng)` (which transitions the panel to `create` mode); the map cursor switches to a crosshair while in placement mode; ESC cancels (already wired by `useEscapeKey`). The `panel.mode === 'create'` branch in `DetailPanel` still shows the existing `UnsupportedPlaceholder` — the actual create form lands in Task 4.2. `npm test` and `npm run typecheck` pass.

- [ ] **Step 4.1.1: Create `src/panels/PlacementBanner/PlacementBanner.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { PlacementBanner } from './PlacementBanner'

function reset() {
  act(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })
}

describe('PlacementBanner', () => {
  beforeEach(reset)

  it('renders nothing when placement is idle', () => {
    const { container } = render(<PlacementBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the waypoint prompt when placement.mode === "waypoint"', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.getState().startWaypointPlacement()
    })
    expect(screen.getByRole('status')).toHaveTextContent(/click the map/i)
    expect(screen.getByRole('status')).toHaveTextContent(/escape/i)
  })

  it('cancels placement when the Cancel button is clicked', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.getState().startWaypointPlacement()
    })
    act(() => {
      screen.getByRole('button', { name: /cancel/i }).click()
    })
    expect(useUiStore.getState().placement.mode).toBe('idle')
  })
})
```

- [ ] **Step 4.1.2: Run banner tests; expect them to fail**

Run: `npm test -- src/panels/PlacementBanner/PlacementBanner.test.tsx`
Expected: FAIL — `Cannot find module './PlacementBanner'`.

- [ ] **Step 4.1.3: Create `src/panels/PlacementBanner/PlacementBanner.module.css`**

```css
.banner {
  position: absolute;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 5;
  pointer-events: auto;
}
```

- [ ] **Step 4.1.4: Create `src/panels/PlacementBanner/PlacementBanner.tsx`**

```tsx
import styles from './PlacementBanner.module.css'
import { useUiStore } from '../../store/ui'

// Subscribes to the placement state machine. Renders nothing in idle mode.
// In waypoint mode it shows the click-the-map prompt with a Cancel button.
// The photo branch (placement.mode === 'photo') lands in Phase 5 and is
// intentionally left unhandled here.
export function PlacementBanner(): JSX.Element | null {
  const placement = useUiStore((s) => s.placement)
  const cancelPlacement = useUiStore((s) => s.cancelPlacement)

  if (placement.mode !== 'waypoint') return null

  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      <span>Click the map to place a waypoint. Press Escape to cancel.</span>
      <button type="button" onClick={cancelPlacement}>Cancel</button>
    </div>
  )
}
```

- [ ] **Step 4.1.5: Run banner tests; expect them to pass**

Run: `npm test -- src/panels/PlacementBanner/PlacementBanner.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 4.1.6: Create `src/map/placement/usePlacementMapBinding.test.ts`**

```typescript
import { applyPlacementBinding } from './usePlacementMapBinding'

interface FakeMap {
  canvas: { style: { cursor: string } }
  handlers: Record<string, ((e: { lngLat: { lat: number; lng: number } }) => void)[]>
  getCanvas: () => FakeMap['canvas']
  on: (event: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => void
  off: (event: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => void
}

const makeMap = (): FakeMap => {
  const m: FakeMap = {
    canvas: { style: { cursor: '' } },
    handlers: {},
    getCanvas: () => m.canvas,
    on: (event, fn) => {
      m.handlers[event] = m.handlers[event] ?? []
      m.handlers[event].push(fn)
    },
    off: (event, fn) => {
      m.handlers[event] = (m.handlers[event] ?? []).filter((f) => f !== fn)
    },
  }
  return m
}

describe('applyPlacementBinding', () => {
  it('does nothing when placement mode is idle', () => {
    const map = makeMap()
    const onComplete = vi.fn()
    const teardown = applyPlacementBinding(map as never, 'idle', onComplete)
    expect(map.canvas.style.cursor).toBe('')
    expect(map.handlers.click).toBeUndefined()
    teardown()
  })

  it('sets a crosshair cursor and registers a one-shot click in waypoint mode', () => {
    const map = makeMap()
    const onComplete = vi.fn()
    const teardown = applyPlacementBinding(map as never, 'waypoint', onComplete)
    expect(map.canvas.style.cursor).toBe('crosshair')
    expect(map.handlers.click).toHaveLength(1)
    map.handlers.click[0]({ lngLat: { lat: 49.5, lng: -116 } })
    expect(onComplete).toHaveBeenCalledWith(49.5, -116)
    teardown()
  })

  it('restores cursor and removes the click handler on teardown', () => {
    const map = makeMap()
    const teardown = applyPlacementBinding(map as never, 'waypoint', () => {})
    teardown()
    expect(map.canvas.style.cursor).toBe('')
    expect(map.handlers.click).toHaveLength(0)
  })
})
```

- [ ] **Step 4.1.7: Run placement-binding tests; expect them to fail**

Run: `npm test -- src/map/placement/usePlacementMapBinding.test.ts`
Expected: FAIL — `Cannot find module './usePlacementMapBinding'`.

- [ ] **Step 4.1.8: Create `src/map/placement/usePlacementMapBinding.ts`**

```typescript
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useUiStore } from '../../store/ui'
import { useMap } from '../../hooks/useMap'

// Map-side binding for placement mode: cursor + one-shot map click.
// Extracted as a pure helper (applyPlacementBinding) so the side effects can
// be unit-tested against a fake map without needing MapLibre/jsdom support.
// The hook is a thin wrapper for use inside MapView.
export function applyPlacementBinding(
  map: maplibregl.Map,
  mode: 'idle' | 'waypoint' | 'photo',
  onComplete: (lat: number, lng: number) => void,
): () => void {
  if (mode === 'idle') return () => {}

  const canvas = map.getCanvas()
  const previousCursor = canvas.style.cursor
  canvas.style.cursor = 'crosshair'

  const handler = (e: { lngLat: { lat: number; lng: number } }) => {
    onComplete(e.lngLat.lat, e.lngLat.lng)
  }
  map.on('click', handler as never)

  return () => {
    map.off('click', handler as never)
    canvas.style.cursor = previousCursor
  }
}

export function usePlacementMapBinding(): void {
  const map = useMap()
  const placementMode = useUiStore((s) => s.placement.mode)

  useEffect(() => {
    if (!map) return
    if (placementMode === 'idle') return
    // Photo placement (Phase 5) will need a different click payload; for now
    // we route both branches through completePlacement(lat, lng).
    const onComplete = (lat: number, lng: number) => {
      useUiStore.getState().completePlacement(lat, lng)
    }
    const teardown = applyPlacementBinding(map, placementMode, onComplete)
    return teardown
  }, [map, placementMode])
}
```

- [ ] **Step 4.1.9: Run placement-binding tests; expect them to pass**

Run: `npm test -- src/map/placement/usePlacementMapBinding.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4.1.10: Create `src/panels/LayerPanel/LayerPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'

const noopPrompt = async () => ({ choice: 'skip' as const, applyToAll: false })

function reset() {
  act(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
  })
}

describe('LayerPanel', () => {
  beforeEach(reset)

  it('dispatches startWaypointPlacement when the Add Waypoint button is clicked', () => {
    render(<LayerPanel promptDuplicate={noopPrompt} />)
    act(() => {
      screen.getByRole('button', { name: /add waypoint/i }).click()
    })
    expect(useUiStore.getState().placement.mode).toBe('waypoint')
  })

  it('reflects the live waypoint count', () => {
    render(<LayerPanel promptDuplicate={noopPrompt} />)
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('0')
    act(() => {
      useWaypointsStore.setState({
        waypoints: [
          {
            id: 'w1',
            user_id: 'local',
            name: 'A',
            description: '',
            lat: 49.5,
            lng: -116,
            elevation_m: 1500,
            category: 'summit',
            color: null,
            tags: [],
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    })
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
  })
})
```

- [ ] **Step 4.1.11: Run LayerPanel tests; expect them to fail**

Run: `npm test -- src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: FAIL — the "Add Waypoint" button does not exist yet.

- [ ] **Step 4.1.12: Modify `src/panels/LayerPanel/LayerPanel.tsx` to add the "Add Waypoint" button**

In the `<div className={styles.actions}>` block, after `<ImportButton promptDuplicate={promptDuplicate} />`, add a second button. Replace the imports at the top to add the ui store action, and replace the `actions` div as shown.

Top of file (extend imports):

```typescript
import { useUiStore, type LayerKey } from '../../store/ui'
```

Inside `LayerPanel`, near the existing store hooks, add:

```typescript
const startWaypointPlacement = useUiStore((s) => s.startWaypointPlacement)
```

Replace the `actions` div with:

```tsx
<div className={styles.actions}>
  <ImportButton promptDuplicate={promptDuplicate} />
  <button type="button" onClick={startWaypointPlacement}>
    Add Waypoint
  </button>
</div>
```

- [ ] **Step 4.1.13: Run LayerPanel tests; expect them to pass**

Run: `npm test -- src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 4.1.14: Modify `src/map/MapView.tsx` to install the placement binding**

After the existing imports, add:

```typescript
import { usePlacementMapBinding } from './placement/usePlacementMapBinding'
```

Inside the `MapView` component body (above the existing `useEffect`s and after the existing `useState`/`useRef` declarations), add:

```typescript
usePlacementMapBinding()
```

No other changes — the hook is a no-op while the map is null or placement is idle.

- [ ] **Step 4.1.15: Modify `src/App.tsx` to mount `<PlacementBanner />`**

Add import:

```typescript
import { PlacementBanner } from './panels/PlacementBanner/PlacementBanner'
```

Inside the `<div data-testid="map-area" className={styles.mapArea}>` block, mount `<PlacementBanner />` right after `<MapView />` (before `<FileDropzone>`):

```tsx
<MapView />
<PlacementBanner />
<FileDropzone onFiles={onDropFiles} />
```

- [ ] **Step 4.1.16: Run the whole test suite and typecheck**

Run: `npm test`
Expected: PASS (no regressions).

Run: `npm run typecheck`
Expected: no TypeScript errors.

- [ ] **Step 4.1.17: Browser smoke-check**

Run `npm run dev`. Open the app, click **Add Waypoint** in the Layer panel. Verify:
- Banner appears above the map with the prompt and a Cancel button.
- Map cursor is a crosshair when hovering the map canvas.
- Clicking the map dismisses the banner (placement transitions to idle and panel transitions to `create`); the DetailPanel renders the placeholder text "Detail for waypoint arrives in a later phase." (Task 4.2 replaces this.)
- Pressing **Escape** while placement is active dismisses the banner without opening the create panel.
- Clicking **Cancel** in the banner does the same.

- [ ] **Step 4.1.18: Commit**

```bash
git add src/panels/PlacementBanner/ src/map/placement/ src/panels/LayerPanel/LayerPanel.tsx src/panels/LayerPanel/LayerPanel.test.tsx src/map/MapView.tsx src/App.tsx
git commit -m "feat(waypoints): wire placement mode trigger, banner, and map click"
```

- [ ] **Step 4.1.19: Mark Task 4.1 done in `TASKS.md`**

Change `- [ ] [4.1 Waypoint placement mode](...)` to `- [x] [4.1 Waypoint placement mode](...)` under Phase 4. Stage and amend? No — keep it a separate commit per project convention:

```bash
git add TASKS.md
git commit -m "chore(tasks): tick 4.1 waypoint placement mode"
```

---

## Task 4.2 — Waypoint creation form

**Files:**
- Create: `src/panels/DetailPanel/WaypointCreate.tsx`
- Create: `src/panels/DetailPanel/WaypointCreate.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.tsx`

This task ends with: clicking the map in waypoint placement mode opens the DetailPanel in `create` mode with a form (name required, description, category dropdown showing all `WAYPOINT_CATEGORIES` with their colors, tags read-only pills, elevation prefilled from `map.queryTerrainElevation` when available or blank otherwise). Save creates a `Waypoint` via `useWaypointsStore.add()` and transitions the panel to `view` for the new waypoint. Cancel returns to `panel.idle`. `npm test` and `npm run typecheck` pass.

- [ ] **Step 4.2.1: Create `src/panels/DetailPanel/WaypointCreate.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { setStorage } from '../../storage/provider'
import { InMemoryStorageProvider } from '../../storage/memory'
import { WaypointCreate } from './WaypointCreate'

function reset() {
  act(() => {
    setStorage(new InMemoryStorageProvider())
    useUiStore.setState({
      panel: { mode: 'create', entityType: 'waypoint', draft: { lat: 49.5, lng: -116 } },
      placement: { mode: 'idle' },
    })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
  })
}

describe('WaypointCreate', () => {
  beforeEach(reset)

  it('disables Save until the name field has non-whitespace content', () => {
    render(<WaypointCreate />)
    const save = screen.getByRole('button', { name: /save/i })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    expect(save).not.toBeDisabled()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '   ' } })
    expect(save).toBeDisabled()
  })

  it('saves a waypoint with the seeded lat/lng and selected category', async () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'summit' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await new Promise((r) => setTimeout(r, 0))
    const stored = useWaypointsStore.getState().waypoints
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Summit Hut')
    expect(stored[0].category).toBe('summit')
    expect(stored[0].lat).toBe(49.5)
    expect(stored[0].lng).toBe(-116)
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityType: 'waypoint',
      entityId: stored[0].id,
    })
  })

  it('returns the panel to idle on Cancel without writing to storage', () => {
    render(<WaypointCreate />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useWaypointsStore.getState().waypoints).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
```

- [ ] **Step 4.2.2: Run create-form tests; expect them to fail**

Run: `npm test -- src/panels/DetailPanel/WaypointCreate.test.tsx`
Expected: FAIL — `Cannot find module './WaypointCreate'`.

- [ ] **Step 4.2.3: Create `src/panels/DetailPanel/WaypointCreate.tsx`**

```tsx
import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { useMap } from '../../hooks/useMap'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { WaypointCategory } from '../../types'
import { TagPills } from './TagPills'
import { debug } from '../../utils/debug'

// Waypoint creation form. Reads the seeded lat/lng from panel.draft (set by
// completePlacement); owns name/description/category/elevation as local state.
// Elevation is autofilled from queryTerrainElevation when the DEM is loaded;
// otherwise the field is left blank for the user to enter (or leave null).
// Tag *editing* lands in Phase 6.1 — for now we render an empty TagPills
// placeholder so the section structure matches the view panel.
export function WaypointCreate(): JSX.Element {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)
  const openEntity = useUiStore((s) => s.openEntity)
  const add = useWaypointsStore((s) => s.add)
  const map = useMap()

  // panel.mode is 'create' and entityType is 'waypoint' when this component is
  // rendered (the DetailPanel router enforces it). If invariants drift, render
  // an explanatory message rather than throw.
  if (panel.mode !== 'create' || panel.entityType !== 'waypoint') {
    return <div className={styles.subtle}>Waypoint placement not active.</div>
  }
  const draft = panel.draft as { lat?: number; lng?: number }
  const seedLat = typeof draft.lat === 'number' ? draft.lat : null
  const seedLng = typeof draft.lng === 'number' ? draft.lng : null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<WaypointCategory>('poi')
  const [elevation, setElevation] = useState<string>('')

  // Autofill elevation from the DEM when the map is available. queryTerrain-
  // Elevation returns null when terrain isn't enabled or tiles haven't loaded;
  // we leave the field blank in those cases rather than guess a value.
  useEffect(() => {
    if (!map || seedLat === null || seedLng === null) return
    const m = map as unknown as {
      queryTerrainElevation?: (lngLat: { lng: number; lat: number }) => number | null
    }
    const elev = m.queryTerrainElevation?.({ lng: seedLng, lat: seedLat }) ?? null
    if (typeof elev === 'number' && Number.isFinite(elev)) {
      setElevation(String(Math.round(elev)))
    }
  }, [map, seedLat, seedLng])

  const canSave = name.trim().length > 0 && seedLat !== null && seedLng !== null

  const onSave = async () => {
    if (!canSave || seedLat === null || seedLng === null) return
    const elevNum = elevation.trim() === '' ? null : Number(elevation)
    const elevValid = elevNum === null || Number.isFinite(elevNum)
    if (!elevValid) return
    try {
      const wp = await add({
        user_id: 'local',
        name: name.trim(),
        description,
        lat: seedLat,
        lng: seedLng,
        elevation_m: elevNum,
        category,
        color: null,
        tags: [],
      })
      openEntity('waypoint', wp.id)
    } catch (err) {
      debug('waypoint create failed', err)
    }
  }

  const onCancel = () => closePanel()

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>New waypoint</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      <section className={shared.section}>
        <label className={shared.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={shared.field}>
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WaypointCategory)}
          >
            {(Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]).map((k) => (
              <option key={k} value={k}>{WAYPOINT_CATEGORIES[k].label}</option>
            ))}
          </select>
        </label>
        <label className={shared.field}>
          <span>Elevation (m)</span>
          <input
            type="number"
            inputMode="numeric"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
            placeholder="optional"
          />
        </label>
      </section>

      <section className={shared.section}>
        <h3>Coordinates</h3>
        <p className={styles.subtle}>
          {seedLat !== null && seedLng !== null
            ? `${seedLat.toFixed(5)}, ${seedLng.toFixed(5)}`
            : '—'}
        </p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={[]} />
      </section>
    </>
  )
}
```

- [ ] **Step 4.2.4: Modify `src/panels/DetailPanel/DetailPanel.tsx` to route the waypoint create branch**

Replace the entire component body so the router handles `waypoint` view/edit (a placeholder import for Task 4.4) and the `create` branch for waypoints. For Task 4.2, only the `create` branch needs to be real; waypoint view/edit stays on the placeholder until Task 4.4.

```tsx
import styles from './DetailPanel.module.css'
import { useUiStore } from '../../store/ui'
import { RouteDetail } from './RouteDetail'
import { TrackDetail } from './TrackDetail'
import { WaypointCreate } from './WaypointCreate'

export function DetailPanel(): JSX.Element | null {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)

  if (panel.mode === 'idle') return null

  let body: JSX.Element
  if (panel.mode === 'view' || panel.mode === 'edit') {
    if (panel.entityType === 'route') {
      body = <RouteDetail routeId={panel.entityId} mode={panel.mode} />
    } else if (panel.entityType === 'track') {
      body = <TrackDetail trackId={panel.entityId} mode={panel.mode} />
    } else {
      // Waypoint view/edit ships in Task 4.4; photo in Phase 5.
      body = <UnsupportedPlaceholder type={panel.entityType} />
    }
  } else if (panel.entityType === 'waypoint') {
    body = <WaypointCreate />
  } else {
    // panel.mode === 'create' && entityType === 'photo' — Phase 5.
    body = <UnsupportedPlaceholder type={panel.entityType} />
  }

  return (
    <aside className={styles.panel} role="complementary" aria-label="Detail panel">
      {body}
      <button
        type="button"
        onClick={closePanel}
        style={{ alignSelf: 'flex-start' }}
      >
        Close
      </button>
    </aside>
  )
}

function UnsupportedPlaceholder({ type }: { type: string }): JSX.Element {
  return <div>Detail for {type} arrives in a later phase.</div>
}
```

- [ ] **Step 4.2.5: Run create-form tests; expect them to pass**

Run: `npm test -- src/panels/DetailPanel/WaypointCreate.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 4.2.6: Run the whole test suite and typecheck**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4.2.7: Browser smoke-check**

Run `npm run dev`. Verify end-to-end:
- Click **Add Waypoint** → banner appears.
- Click somewhere on the map → banner disappears; create form opens in DetailPanel with that coordinate displayed.
- Elevation auto-fills (with terrain enabled) or is blank (terrain disabled).
- Type a name, select **Summit**, click **Save**. Panel transitions to a "view" placeholder (real waypoint detail lands in Task 4.4). The waypoint isn't yet drawn on the map (that's Task 4.3) — but a reload should show its count increment from `window.__couloir.listAll()`.
- Clicking **Cancel** discards.

- [ ] **Step 4.2.8: Commit**

```bash
git add src/panels/DetailPanel/WaypointCreate.tsx src/panels/DetailPanel/WaypointCreate.test.tsx src/panels/DetailPanel/DetailPanel.tsx
git commit -m "feat(waypoints): create-form with category picker and elevation autofill"
```

- [ ] **Step 4.2.9: Mark Task 4.2 done in `TASKS.md`**

Tick the box, commit:

```bash
git add TASKS.md
git commit -m "chore(tasks): tick 4.2 waypoint creation form"
```

---

## Task 4.3 — Waypoints layer

**Files:**
- Modify: `src/map/layers/layerStyles.ts`
- Create: `src/map/layers/waypointsLayerData.ts`
- Create: `src/map/layers/waypointsLayerData.test.ts`
- Create: `src/map/layers/wpIcons.ts`
- Create: `src/map/layers/wpIcons.test.ts`
- Create: `src/map/layers/WaypointsLayer.tsx`
- Modify: `src/map/MapView.tsx`

This task ends with: waypoints rendering as colored category icons on the map; the existing Layer panel "Waypoints" toggle hides/shows them; drag-to-reposition writes the new lat/lng through to storage and persists across reload. `npm test` and `npm run typecheck` pass.

- [ ] **Step 4.3.1: Extend `src/map/layers/layerStyles.ts` with waypoint constants**

Append at the end:

```typescript
export const WAYPOINTS_SOURCE_ID = 'waypoints-source'
export const WAYPOINTS_SYMBOLS_LAYER_ID = 'waypoints-symbols'

// Pixel size of the generated category icon images (square). Tuned so that
// icons remain readable over satellite/topo basemaps without dominating the
// viewport. The MapLibre symbol layer renders them at this nominal size with
// icon-size: 1.0.
export const WAYPOINT_ICON_PX = 32
```

- [ ] **Step 4.3.2: Create `src/map/layers/waypointsLayerData.test.ts`**

```typescript
import { buildWaypointsGeoJson } from './waypointsLayerData'
import type { Waypoint } from '../../types'

const baseWaypoint = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: 'w1',
  user_id: 'local',
  name: 'wp',
  description: '',
  lat: 49.5,
  lng: -116,
  elevation_m: 1500,
  category: 'summit',
  color: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildWaypointsGeoJson', () => {
  it('returns a FeatureCollection with one Point feature per waypoint', () => {
    const fc = buildWaypointsGeoJson([
      baseWaypoint({ id: 'a' }),
      baseWaypoint({ id: 'b', lat: 50, lng: -115, category: 'hazard' }),
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].geometry.type).toBe('Point')
  })

  it('exposes id and category as feature properties', () => {
    const fc = buildWaypointsGeoJson([baseWaypoint({ id: 'a', category: 'cliff_band' })])
    expect(fc.features[0].properties).toEqual({ id: 'a', category: 'cliff_band' })
  })

  it('orders coordinates as [lng, lat]', () => {
    const fc = buildWaypointsGeoJson([baseWaypoint({ lat: 49.5, lng: -116 })])
    expect(fc.features[0].geometry.coordinates).toEqual([-116, 49.5])
  })

  it('produces an empty collection for no waypoints', () => {
    expect(buildWaypointsGeoJson([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})
```

- [ ] **Step 4.3.3: Run; expect to fail; implement `waypointsLayerData.ts`**

Run: `npm test -- src/map/layers/waypointsLayerData.test.ts`
Expected: FAIL — module not found.

Create `src/map/layers/waypointsLayerData.ts`:

```typescript
import type { Waypoint, WaypointCategory } from '../../types'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; category: WaypointCategory }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function buildWaypointsGeoJson(waypoints: Waypoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((w) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
      properties: { id: w.id, category: w.category },
    })),
  }
}
```

Run again; expect PASS, 4 tests.

- [ ] **Step 4.3.4: Create `src/map/layers/wpIcons.test.ts`**

```typescript
import { categoryGlyph, buildCategoryIcon } from './wpIcons'
import { WAYPOINT_ICON_PX } from './layerStyles'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { WaypointCategory } from '../../types'

describe('categoryGlyph', () => {
  it('returns a single-character glyph for each category', () => {
    for (const k of Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]) {
      const g = categoryGlyph(k)
      expect(g.length).toBeGreaterThan(0)
      expect(g.length).toBeLessThanOrEqual(2)
    }
  })

  it('is deterministic — same input, same output', () => {
    expect(categoryGlyph('summit')).toBe(categoryGlyph('summit'))
  })
})

describe('buildCategoryIcon', () => {
  it('returns ImageData sized to WAYPOINT_ICON_PX', () => {
    // jsdom provides a working OffscreenCanvas/HTMLCanvasElement 2d context
    // sufficient for shape/pixel checks. If the platform doesn't support it,
    // the helper falls back to an all-transparent ImageData of the right size.
    const img = buildCategoryIcon('summit')
    expect(img.width).toBe(WAYPOINT_ICON_PX)
    expect(img.height).toBe(WAYPOINT_ICON_PX)
    expect(img.data.byteLength).toBe(WAYPOINT_ICON_PX * WAYPOINT_ICON_PX * 4)
  })
})
```

- [ ] **Step 4.3.5: Run; expect to fail; implement `wpIcons.ts`**

Run: `npm test -- src/map/layers/wpIcons.test.ts`
Expected: FAIL — module not found.

Create `src/map/layers/wpIcons.ts`:

```typescript
import { WAYPOINT_CATEGORIES, type WaypointCategory } from '../../types'
import { WAYPOINT_ICON_PX } from './layerStyles'

// Single-character glyph per category. We use Unicode block characters that
// MapLibre's default text rendering would not necessarily support, but here
// the glyph is rendered into a canvas before being handed to addImage as an
// ImageData blob — so any character the platform's 2D context can draw works.
const GLYPHS: Record<WaypointCategory, string> = {
  entry_gate: 'G',
  cliff_band: 'C',
  rollover:   'R',
  hazard:     '!',
  skin_track: 'S',
  cache:      '◇',
  summit:     '▲',
  poi:        '•',
  other:      '·',
}

export function categoryGlyph(category: WaypointCategory): string {
  return GLYPHS[category]
}

// Renders a colored disc with a white outline and a single centered glyph
// onto a 2D canvas and returns the resulting ImageData for `map.addImage`.
// If the platform lacks a 2D canvas (e.g. very old browsers, or a stripped
// jsdom config), returns a transparent ImageData of the right size so the
// caller doesn't crash; in that case the symbol layer will render empty
// icons — visually broken but not fatal.
export function buildCategoryIcon(category: WaypointCategory): ImageData {
  const size = WAYPOINT_ICON_PX
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : null
  if (!canvas) {
    return new ImageData(size, size)
  }
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new ImageData(size, size)

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 2

  // Filled disc — category color
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = WAYPOINT_CATEGORIES[category].color
  ctx.fill()

  // White outline (halo for contrast over basemap tiles)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  // Glyph
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(GLYPHS[category], cx, cy + 1)

  return ctx.getImageData(0, 0, size, size)
}
```

Run again; expect PASS, 3 tests.

- [ ] **Step 4.3.6: Create `src/map/layers/WaypointsLayer.tsx`**

This component mirrors `RoutesLayer`'s shape: install on `style.load`, reconcile GeoJSON on data change, toggle visibility, click → `openEntity`. Plus: drag-to-reposition.

```tsx
import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { WAYPOINT_CATEGORIES, type WaypointCategory } from '../../types'
import { buildWaypointsGeoJson } from './waypointsLayerData'
import { buildCategoryIcon } from './wpIcons'
import {
  WAYPOINTS_SOURCE_ID,
  WAYPOINTS_SYMBOLS_LAYER_ID,
} from './layerStyles'

export function WaypointsLayer(): null {
  const map = useMap()
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const visible = useUiStore((s) => s.layerVisibility.waypoints)

  // Drag state lives in a ref because mousemove handlers fire on every pixel
  // and we don't want to re-bind React state for each one. dragging.id is set
  // by mousedown, mutated by mousemove (locally + via setData for live
  // feedback), and committed via update() on mouseup.
  const drag = useRef<{
    id: string | null
    lat: number
    lng: number
  }>({ id: null, lat: 0, lng: 0 })

  // Install source + layers on style.load. Register one ImageData per category
  // before adding the symbol layer so the icon-image expression always
  // resolves. Re-registering an image with the same name throws — guard with
  // hasImage.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(WAYPOINTS_SOURCE_ID)) return

      for (const cat of Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]) {
        const name = `wp-${cat}`
        if (!map.hasImage(name)) {
          map.addImage(name, buildCategoryIcon(cat))
        }
      }

      const initialWaypoints = useWaypointsStore.getState().waypoints
      const initialVisible = useUiStore.getState().layerVisibility.waypoints
      const visibility = initialVisible ? 'visible' : 'none'

      map.addSource(WAYPOINTS_SOURCE_ID, {
        type: 'geojson',
        data: buildWaypointsGeoJson(initialWaypoints) as never,
      })
      map.addLayer({
        id: WAYPOINTS_SYMBOLS_LAYER_ID,
        type: 'symbol',
        source: WAYPOINTS_SOURCE_ID,
        layout: {
          'icon-image': ['concat', 'wp-', ['get', 'category']],
          'icon-size': 1,
          'icon-allow-overlap': true,
          visibility,
        },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    // Click → open detail panel
    const onClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('waypoint', id)
      }
    }
    map.on('click', WAYPOINTS_SYMBOLS_LAYER_ID, onClick)

    // Cursor affordance — move when hovering a draggable waypoint
    const onEnter = () => { map.getCanvas().style.cursor = 'move' }
    const onLeave = () => {
      // Don't override placement-mode crosshair while placement is active.
      if (useUiStore.getState().placement.mode === 'idle') {
        map.getCanvas().style.cursor = ''
      }
    }
    map.on('mouseenter', WAYPOINTS_SYMBOLS_LAYER_ID, onEnter)
    map.on('mouseleave', WAYPOINTS_SYMBOLS_LAYER_ID, onLeave)

    // Drag-to-reposition. Starts on mousedown over a symbol; disables dragPan
    // for the duration; updates the source data live; commits via update()
    // on mouseup. If placement mode is active we skip the drag — clicking the
    // map in placement mode is the click-to-place gesture.
    const onMouseDown = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id !== 'string') return
      e.preventDefault()
      drag.current = { id, lat: e.lngLat.lat, lng: e.lngLat.lng }
      map.dragPan.disable()
      map.on('mousemove', onMouseMove)
      map.once('mouseup', onMouseUp)
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drag.current.id) return
      drag.current.lat = e.lngLat.lat
      drag.current.lng = e.lngLat.lng
      // Live feedback: rebuild GeoJSON from the store + the in-flight point.
      const src = map.getSource(WAYPOINTS_SOURCE_ID)
      if (!src || src.type !== 'geojson') return
      const wps = useWaypointsStore.getState().waypoints.map((w) =>
        w.id === drag.current.id
          ? { ...w, lat: drag.current.lat, lng: drag.current.lng }
          : w,
      )
      ;(src as GeoJSONSource).setData(buildWaypointsGeoJson(wps) as never)
    }

    const onMouseUp = async () => {
      const { id, lat, lng } = drag.current
      drag.current = { id: null, lat: 0, lng: 0 }
      map.off('mousemove', onMouseMove)
      map.dragPan.enable()
      if (!id) return
      // Commit. The store update flips updated_at and re-renders the layer,
      // which converges the visual state with the persisted state.
      await useWaypointsStore.getState().update(id, { lat, lng })
    }

    map.on('mousedown', WAYPOINTS_SYMBOLS_LAYER_ID, onMouseDown)

    return () => {
      map.off('style.load', install)
      map.off('click', WAYPOINTS_SYMBOLS_LAYER_ID, onClick)
      map.off('mouseenter', WAYPOINTS_SYMBOLS_LAYER_ID, onEnter)
      map.off('mouseleave', WAYPOINTS_SYMBOLS_LAYER_ID, onLeave)
      map.off('mousedown', WAYPOINTS_SYMBOLS_LAYER_ID, onMouseDown)
      map.off('mousemove', onMouseMove)
    }
  }, [map])

  // Sync GeoJSON on waypoint changes. Guards on the source not yet existing
  // (style.load is async) — install() seeds the initial data via getState().
  useEffect(() => {
    if (!map) return
    const src = map.getSource(WAYPOINTS_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    ;(src as GeoJSONSource).setData(buildWaypointsGeoJson(waypoints) as never)
  }, [map, waypoints])

  // Toggle visibility from the Layer panel.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(WAYPOINTS_SYMBOLS_LAYER_ID)) return
    map.setLayoutProperty(
      WAYPOINTS_SYMBOLS_LAYER_ID,
      'visibility',
      visible ? 'visible' : 'none',
    )
  }, [map, visible])

  return null
}
```

- [ ] **Step 4.3.7: Modify `src/map/MapView.tsx` to mount `<WaypointsLayer />`**

Add the import:

```typescript
import { WaypointsLayer } from './layers/WaypointsLayer'
```

Inside the returned JSX, alongside the existing `<RoutesLayer />` and `<TracksLayer />`, mount it:

```tsx
<RoutesLayer />
<TracksLayer />
<WaypointsLayer />
```

- [ ] **Step 4.3.8: Run the whole test suite and typecheck**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4.3.9: Browser smoke-check**

Run `npm run dev`. Verify:
- Existing waypoints (use `window.__couloir.createDummyWaypoint('Summit One')` if storage is empty) render as colored category icons.
- Toggle the **Waypoints** row in the Layer panel — icons hide/show.
- Hover an icon: cursor changes to **move**. Click and drag: the icon follows the cursor; release: it persists at the new spot.
- Hard-reload the page: dragged position is preserved.
- Add Waypoint flow still works (creates a new waypoint that immediately appears on the map).

- [ ] **Step 4.3.10: Commit**

```bash
git add src/map/layers/ src/map/MapView.tsx
git commit -m "feat(waypoints): render category icons on the map with drag-to-reposition"
```

- [ ] **Step 4.3.11: Mark Task 4.3 done in `TASKS.md`**

```bash
git add TASKS.md
git commit -m "chore(tasks): tick 4.3 waypoints layer"
```

---

## Task 4.4 — Waypoint detail panel

**Files:**
- Create: `src/panels/DetailPanel/WaypointDetail.tsx`
- Create: `src/panels/DetailPanel/WaypointDetail.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.tsx`

This task ends with: clicking a waypoint icon on the map opens the DetailPanel showing name, description, category, elevation, coordinates, tags. Edit mode allows changing name, description, category, elevation (numeric), and an optional color override. Save writes through `useWaypointsStore.update()` and returns to view. Delete (confirm prompt) removes from the map and storage. `npm test` and `npm run typecheck` pass.

- [ ] **Step 4.4.1: Create `src/panels/DetailPanel/WaypointDetail.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { setStorage } from '../../storage/provider'
import { InMemoryStorageProvider } from '../../storage/memory'
import { WaypointDetail } from './WaypointDetail'
import type { Waypoint } from '../../types'

const sample = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: 'w1',
  user_id: 'local',
  name: 'Summit Hut',
  description: 'Aid station.',
  lat: 49.5,
  lng: -116,
  elevation_m: 2400,
  category: 'summit',
  color: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

function setup(wp: Waypoint = sample()) {
  act(() => {
    setStorage(new InMemoryStorageProvider())
    useUiStore.setState({ panel: { mode: 'view', entityType: 'waypoint', entityId: wp.id } })
    useWaypointsStore.setState({ waypoints: [wp], loading: false, error: null })
  })
}

describe('WaypointDetail (view)', () => {
  beforeEach(() => setup())

  it('renders name, category label, and elevation', () => {
    render(<WaypointDetail waypointId="w1" mode="view" />)
    expect(screen.getByRole('heading', { name: 'Summit Hut' })).toBeInTheDocument()
    expect(screen.getByText(/Summit/)).toBeInTheDocument()       // category label
    expect(screen.getByText(/2400 m/)).toBeInTheDocument()       // elevation
    expect(screen.getByText(/49\.50000, -116\.00000/)).toBeInTheDocument()
  })

  it('renders "—" for null elevation', () => {
    setup(sample({ elevation_m: null }))
    render(<WaypointDetail waypointId="w1" mode="view" />)
    expect(screen.getByText('Elevation').nextSibling?.textContent).toBe('—')
  })

  it('renders "Waypoint not found." if the id is missing from the store', () => {
    render(<WaypointDetail waypointId="missing" mode="view" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})

describe('WaypointDetail (edit)', () => {
  beforeEach(() => setup())

  it('saves changes via the store and returns to view', async () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await new Promise((r) => setTimeout(r, 0))
    expect(useWaypointsStore.getState().waypoints[0].name).toBe('Renamed')
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityType: 'waypoint',
      entityId: 'w1',
    })
  })

  it('Cancel returns to view without writing', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Discarded' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useWaypointsStore.getState().waypoints[0].name).toBe('Summit Hut')
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityId: 'w1',
    })
  })
})

describe('WaypointDetail (delete)', () => {
  beforeEach(() => setup())

  it('Confirm delete removes from the store and closes the panel', async () => {
    render(<WaypointDetail waypointId="w1" mode="view" />)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await new Promise((r) => setTimeout(r, 0))
    expect(useWaypointsStore.getState().waypoints).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
```

- [ ] **Step 4.4.2: Run; expect to fail; implement `WaypointDetail.tsx`**

Run: `npm test -- src/panels/DetailPanel/WaypointDetail.test.tsx`
Expected: FAIL — module not found.

Create `src/panels/DetailPanel/WaypointDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { Waypoint, WaypointCategory } from '../../types'
import { formatElevationM, isValidHex } from '../../utils/format'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'

interface Props {
  waypointId: string
  mode: 'view' | 'edit'
}

export function WaypointDetail({ waypointId, mode }: Props): JSX.Element {
  const wp = useWaypointsStore((s) => s.waypoints.find((w) => w.id === waypointId)) ?? null
  if (!wp) return <div className={styles.subtle}>Waypoint not found.</div>
  return mode === 'view' ? <WaypointView wp={wp} /> : <WaypointEdit wp={wp} />
}

function WaypointView({ wp }: { wp: Waypoint }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useWaypointsStore((s) => s.remove)

  const handleDelete = async () => {
    try {
      await remove(wp.id)
      closePanel()
    } catch (err) {
      // Phase 6 will replace this with a user-visible error surface.
      debug('waypoint delete failed', err)
    }
  }

  const elevation = wp.elevation_m === null ? '—' : formatElevationM(wp.elevation_m)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{wp.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {wp.description && <p className={styles.subtle}>{wp.description}</p>}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Category" value={WAYPOINT_CATEGORIES[wp.category].label} />
          <Metric label="Elevation" value={elevation} />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Coordinates</h3>
        <p className={styles.subtle}>
          {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
        </p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={wp.tags} />
      </section>
    </>
  )
}

function WaypointEdit({ wp }: { wp: Waypoint }): JSX.Element {
  const update = useWaypointsStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(wp.name)
  const [description, setDescription] = useState(wp.description)
  const [category, setCategory] = useState<WaypointCategory>(wp.category)
  const [elevation, setElevation] = useState<string>(
    wp.elevation_m === null ? '' : String(wp.elevation_m),
  )
  const [color, setColor] = useState<string>(wp.color ?? '')

  // Re-sync local state if the underlying waypoint is replaced upstream
  // (e.g. drag commit, or a sync arrival in the future).
  useEffect(() => {
    setName(wp.name)
    setDescription(wp.description)
    setCategory(wp.category)
    setElevation(wp.elevation_m === null ? '' : String(wp.elevation_m))
    setColor(wp.color ?? '')
  }, [wp.id, wp.updated_at])

  const elevNum = elevation.trim() === '' ? null : Number(elevation)
  const elevValid = elevNum === null || Number.isFinite(elevNum)
  const colorOk = color === '' || isValidHex(color)
  const canSave = name.trim().length > 0 && elevValid && colorOk

  const onSave = async () => {
    if (!canSave) return
    try {
      await update(wp.id, {
        name: name.trim(),
        description,
        category,
        elevation_m: elevNum,
        color: color === '' ? null : color,
      })
      openEntity('waypoint', wp.id)
    } catch (err) {
      debug('waypoint save failed', err)
    }
  }

  const onCancel = () => openEntity('waypoint', wp.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit waypoint</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      <section className={shared.section}>
        <label className={shared.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={shared.field}>
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WaypointCategory)}
          >
            {(Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]).map((k) => (
              <option key={k} value={k}>{WAYPOINT_CATEGORIES[k].label}</option>
            ))}
          </select>
        </label>
        <label className={shared.field}>
          <span>Elevation (m)</span>
          <input
            type="number"
            inputMode="numeric"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className={shared.field}>
          <span>Color override</span>
          <div className={shared.row}>
            <input
              type="color"
              value={color === '' ? WAYPOINT_CATEGORIES[category].color : color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
              placeholder="leave blank to use category default"
            />
          </div>
          {!colorOk && <span className={styles.subtle}>Use #RRGGBB hex.</span>}
        </label>
      </section>
    </>
  )
}
```

Run: `npm test -- src/panels/DetailPanel/WaypointDetail.test.tsx`
Expected: PASS (all groups).

- [ ] **Step 4.4.3: Modify `src/panels/DetailPanel/DetailPanel.tsx` to route waypoint view/edit**

Replace the `else if (panel.entityType === 'track')` block so a third branch for `waypoint` is included. Add the import:

```typescript
import { WaypointDetail } from './WaypointDetail'
```

Replace the view/edit body decision with:

```tsx
if (panel.mode === 'view' || panel.mode === 'edit') {
  if (panel.entityType === 'route') {
    body = <RouteDetail routeId={panel.entityId} mode={panel.mode} />
  } else if (panel.entityType === 'track') {
    body = <TrackDetail trackId={panel.entityId} mode={panel.mode} />
  } else if (panel.entityType === 'waypoint') {
    body = <WaypointDetail waypointId={panel.entityId} mode={panel.mode} />
  } else {
    // photo view/edit ships in Phase 5
    body = <UnsupportedPlaceholder type={panel.entityType} />
  }
}
```

- [ ] **Step 4.4.4: Run the whole test suite and typecheck**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4.4.5: Browser smoke-check**

Run `npm run dev`. Verify:
- Create a new waypoint via the Add Waypoint flow → its detail panel opens in view mode with all fields rendered.
- Click an existing waypoint icon on the map → its detail panel opens.
- Click **Edit** → form fields populate; change the name + category, **Save** → map icon updates immediately (category color change shows up).
- Drag the waypoint on the map → coordinates in the open detail panel update on the next render.
- Click **Delete** → **Confirm delete** → the icon vanishes from the map and the panel closes.
- Reload the page: the deleted waypoint stays deleted; renamed waypoints retain their new name/category.

- [ ] **Step 4.4.6: Commit**

```bash
git add src/panels/DetailPanel/WaypointDetail.tsx src/panels/DetailPanel/WaypointDetail.test.tsx src/panels/DetailPanel/DetailPanel.tsx
git commit -m "feat(waypoints): detail panel view/edit/delete with category and color override"
```

- [ ] **Step 4.4.7: Mark Task 4.4 done in `TASKS.md`**

```bash
git add TASKS.md
git commit -m "chore(tasks): tick 4.4 waypoint detail panel"
```

---

## Task 4.5 — Waypoint count badge

**Files:**
- (No source changes — the count is already wired in `src/panels/LayerPanel/LayerPanel.tsx` to `useWaypointsStore((s) => s.waypoints.length)`. This task is a verification.)
- The LayerPanel test from Task 4.1 already asserts the live count.

This task ends with: confirmation that the waypoints count in the Layer panel updates immediately on add and delete, with a passing test.

- [ ] **Step 4.5.1: Confirm the existing test covers the acceptance criterion**

Run: `npm test -- src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: PASS. The "reflects the live waypoint count" assertion (added in Step 4.1.10) is the formal verification.

If the test doesn't already cover both add (count 0 → 1) and delete (1 → 0), extend it. Read the current test; if it only covers add, add:

```tsx
it('drops back to 0 when the last waypoint is removed', () => {
  render(<LayerPanel promptDuplicate={noopPrompt} />)
  act(() => {
    useWaypointsStore.setState({
      waypoints: [
        {
          id: 'w1', user_id: 'local', name: 'A', description: '',
          lat: 0, lng: 0, elevation_m: null, category: 'poi', color: null,
          tags: [], created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
  })
  expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
  act(() => {
    useWaypointsStore.setState({ waypoints: [] })
  })
  expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('0')
})
```

Run again; expect PASS.

- [ ] **Step 4.5.2: Browser smoke-check**

Run `npm run dev`. With the app open:
- Note the Waypoints count in the Layer panel.
- Create a waypoint → count increments by 1 immediately.
- Delete a waypoint via the detail panel → count decrements by 1 immediately.

- [ ] **Step 4.5.3: Commit (if Step 4.5.1 added tests)**

```bash
git add src/panels/LayerPanel/LayerPanel.test.tsx
git commit -m "test(waypoints): cover delete in layer-panel count badge test"
```

If no test changes were needed, skip the commit.

- [ ] **Step 4.5.4: Mark Task 4.5 done in `TASKS.md` and update the Phase 4 plan link**

In `TASKS.md`, change `### Phase 4 — Waypoints · Plan: not yet written` to:

```markdown
### Phase 4 — Waypoints  ·  Plan: [`2026-05-10-couloir-phase-4-waypoints.md`](docs/superpowers/plans/2026-05-10-couloir-phase-4-waypoints.md)
```

Tick the 4.5 checkbox, then:

```bash
git add TASKS.md
git commit -m "chore(tasks): tick 4.5 waypoint count badge; link phase 4 plan"
```

---

## Self-review

**Spec coverage check** (from `TASKS.md` Phase 4 acceptance criteria):

| Requirement | Where it's implemented |
|---|---|
| Placement mode activates and deactivates via the named actions | Task 4.1 — "Add Waypoint" button dispatches `startWaypointPlacement`; banner Cancel and ESC dispatch `cancelPlacement` |
| ESC cancels placement | Task 4.1 — relies on the existing `useEscapeKey` precedence (no new code needed; smoke-checked in Step 4.1.17) |
| Clicking the map in placement mode opens the create form with lat/lng pre-filled | Task 4.1 (click → `completePlacement(lat, lng)`) + Task 4.2 (form reads seed from `panel.draft`) |
| Map cursor and banner driven entirely by `PlacementState` | Task 4.1 — `usePlacementMapBinding` reads `placement.mode`; banner reads `placement.mode` |
| All form fields save correctly | Task 4.2 — `useWaypointsStore.add()` writes through the storage layer; tested |
| Category picker shows all categories with icons | Task 4.2 — picker iterates `WAYPOINT_CATEGORIES`; *icon previews next to each option* are intentionally minimal in this MVP — the label includes the human-readable name, and the icon shows on save when the waypoint hits the map. (If a richer per-option icon preview is needed later, the picker can swap to a custom listbox; that's out of scope here per the YAGNI principle.) |
| Waypoint appears on map immediately after save | Task 4.3 — `useWaypointsStore.add()` updates the slice; `WaypointsLayer`'s sync effect calls `setData`. Verified in Step 4.4.5 smoke test |
| All waypoint categories render with distinct icons | Task 4.3 — `buildCategoryIcon` per category, registered as `wp-${category}` |
| Icons visible over satellite and topo basemaps | Task 4.3 — `buildCategoryIcon` adds a 2px white outline halo |
| Layer toggle shows/hides all waypoints | Task 4.3 — `setLayoutProperty('visibility', ...)` effect |
| Detail panel shows all fields | Task 4.4 — `WaypointView` |
| Edit saves correctly | Task 4.4 — `WaypointEdit` → `update()` |
| Delete removes with confirmation | Task 4.4 — `ConfirmDelete` reused from Phase 3 |
| Drag to reposition updates coordinates in storage and persists across reload | Task 4.3 — mousedown/move/up + `update()` on commit |
| Count is accurate and updates on add/delete | Task 4.5 — verified by the LayerPanel test (already wired in Phase 3 file) |

**Placeholder scan**: No "TBD", "add appropriate error handling", or unconfigured asset paths. Every code block is concrete and runs. Tests reference real fields on the live `Waypoint` type.

**Type consistency**:
- Source/layer IDs: `WAYPOINTS_SOURCE_ID`, `WAYPOINTS_SYMBOLS_LAYER_ID` — used consistently across `layerStyles.ts` and `WaypointsLayer.tsx`.
- Pure helpers: `buildWaypointsGeoJson`, `buildCategoryIcon`, `categoryGlyph` — names match between tests and implementation.
- Store API: `useWaypointsStore.getState().add | update | remove` — matches the existing slice signatures (`add` takes `Omit<Waypoint, 'id' | 'created_at' | 'updated_at'>`, `update` takes `(id, patch)`, `remove` takes `(id)`).
- Image registration name pattern: `wp-${category}` — referenced consistently in `WaypointsLayer.tsx` (`map.addImage(name, ...)` and `'icon-image': ['concat', 'wp-', ['get', 'category']]`).

**Out-of-scope items intentionally deferred**:
- Photo placement and EXIF — Phase 5.
- Tag editing in the create/detail form — Phase 6.1 (the form currently shows an empty `TagPills` placeholder so the section is present).
- Spatial index / viewport filtering for waypoints — post-MVP (not needed at expected dataset sizes for one user).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-couloir-phase-4-waypoints.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
