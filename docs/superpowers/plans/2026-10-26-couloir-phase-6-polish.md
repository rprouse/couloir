# Couloir Phase 6 — Polish and MVP Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leave browser-only verification steps unticked unless you actually ran them in a browser.

**Goal:** Finish the MVP: tags you can create and assign, per-layer tag filters, global search, ZIP backup and restore, an installable offline-capable PWA, a usable phone layout, first-run onboarding, and an end-to-end QA pass.

**Decisions taken in planning (2026-10-26):**

1. **New dependencies (approved by the user):** `fflate@0.8.3` (runtime, ZIP read/write) and `vite-plugin-pwa@1.3.0` (dev, manifest + Workbox service worker). Pin `1.3.0` rather than the newer 2.x: it supports Vite 5 and Node ≥ 20, and 2.0 is too fresh to have settled.
2. **Tag assignment is part of Task 6.1.** Every form today shows a read-only "No tags" placeholder. 6.1 adds a `TagPicker` to the edit forms of all four entity types and to the waypoint and photo create forms, with inline "new tag" creation. This is needed for QA step 7.
3. **Export streams to disk where the browser allows.** Chrome and Edge use `showSaveFilePicker` and write the ZIP chunk by chunk. Other browsers build a `Blob` from the chunks and trigger a normal download. Photos are read from storage **one at a time** while zipping, so export never holds every photo in memory. The bundle is built from the entity getters, and the `StorageProvider` interface is unchanged.
4. **App icons:** a hand-written SVG is committed as the source. The 192/512/180 px PNGs are rendered once through the Playwright browser and committed. No icon tooling is added to the repo.
5. **Tag filters and usage counts are computed in memory** from the entity slices (each entity already carries `tags: string[]`). Filtering happens in JS before each layer builds its GeoJSON, not with MapLibre filter expressions. No storage changes.
6. **Offline scope:** the service worker precaches the app shell, the JS chunks, the storage worker and the wa-sqlite `.wasm`. Map tiles are **not** cached (that's the post-MVP "offline tile caching" backlog item). Offline, the app opens and your data is there, but the basemap will be blank.

**Spec references:** `SPEC.md` (Layer System, Settings, Search and Filter), `ARCHITECTURE.md` (Backup Format, PWA Configuration, State Management), `DATA-MODEL.md` (`Tag`, `ExportBundle`, `BackupManifest`), `TASKS.md` Tasks 6.1–6.8.

**Out of scope:** tile caching, bulk tag operations (backlog), editing tags from the map, swipe gestures on the mobile bottom sheet (tap to open/close is the MVP), GPX export (backlog).

---

## File Structure

```
couloir/
├── package.json                                   6.4 (+ fflate), 6.5 (+ vite-plugin-pwa)
├── vite.config.ts, index.html                     6.5
├── public/icons/icon.svg, icon-192.png,           6.5
│   icon-512.png, apple-touch-icon.png
├── ARCHITECTURE.md, TASKS.md                      each task (docs + ticks)
├── src/
│   ├── main.tsx, vite-env.d.ts                    6.5 (SW registration)
│   ├── theme.css                                  6.6 (--mobile-tabbar-h)
│   ├── types/index.ts                             6.1 (TAG_PALETTE), 6.4 (BUNDLE_VERSION)
│   ├── types/fileSystemAccess.d.ts                6.4 (showSaveFilePicker ambient types)
│   ├── utils/
│   │   ├── tags.ts / tags.test.ts                 6.1 (validateTagInput, countTagUsage, readableTextColor, nextTagColor), 6.2 (filterByTags)
│   │   ├── geo.ts / geo.test.ts                   6.3 (lineBounds)
│   │   ├── format.ts / format.test.ts             6.4 (formatBytes)
│   │   └── image.ts                               6.4 (makeThumbnail)
│   ├── store/ui.ts / ui.test.ts                   6.2 (tagFilters), 6.6 (setSidebarCollapsed)
│   ├── hooks/useMediaQuery.ts / .test.tsx         6.6
│   ├── components/
│   │   ├── TagPill/TagPill.tsx, .module.css       6.1
│   │   └── TagPicker/TagPicker.tsx, .module.css, .test.tsx   6.1
│   ├── features/
│   │   ├── tags/deleteTag.ts / deleteTag.test.ts  6.1
│   │   ├── search/search.ts / search.test.ts      6.3
│   │   └── backup/
│   │       ├── writeBackup.ts / readBackup.ts / prepareImport.ts / saveTarget.ts
│   │       └── backup.test.ts                     6.4
│   ├── map/
│   │   ├── flyToEntity.ts / flyToEntity.test.ts   6.3
│   │   ├── layers/{Routes,Tracks,Waypoints,Photos}Layer.tsx   6.2 (apply tag filter)
│   │   ├── controls/TerrainControl.module.css     6.6
│   │   └── MapView.tsx / MapView.test.tsx         6.7 (WelcomeScreen)
│   ├── test/mocks/maplibre-gl.ts                  6.3 (fitBounds)
│   ├── panels/
│   │   ├── DetailPanel/TagPills.tsx               6.1 (use TagPill)
│   │   ├── DetailPanel/{Route,Track,Waypoint,Photo}Detail.tsx, WaypointCreate.tsx, PhotoCreate.tsx   6.1 (TagPicker)
│   │   ├── DetailPanel/DetailPanel.module.css     6.6 (bottom sheet)
│   │   ├── SettingsPanel/TagManager.tsx / .test.tsx   6.1
│   │   ├── SettingsPanel/BackupSection.tsx / .test.tsx 6.4
│   │   ├── SettingsPanel/SettingsPanel.tsx        6.1, 6.4
│   │   ├── LayerPanel/TagFilterMenu.tsx / .module.css  6.2
│   │   ├── LayerPanel/LayerPanel.tsx / .test.tsx / .module.css   6.2, 6.7
│   │   ├── SearchPanel/SearchPanel.tsx / .module.css / .test.tsx 6.3
│   │   ├── Welcome/WelcomeScreen.tsx / .module.css / .test.tsx   6.7
│   │   ├── Sidebar.tsx / Sidebar.module.css / Sidebar.test.tsx  6.6
│   └── App.tsx / App.module.css / App.test.tsx    6.3 (search panel), 6.6 (mobile effects)
```

**Conventions** (carried forward):
- Vitest globals; `InMemoryStorageProvider` + `setStorage`/`clearStorage` in tests. Plain `npm test` works (the Node webstorage flag is handled in `vitest.config.ts`).
- Real-browser behaviour (layout, PWA install, file save dialog, map motion) is verified by hand or through Playwright. Logic is pulled into pure, tested helpers.
- `git` only through the PowerShell tool. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One feature commit per task, with the plan and TASKS.md ticks folded in.

**Branch:** `git switch -c phase-6-polish` from an up-to-date `main` before Task 6.1.

---

## Task 6.1 — Tag management and tag assignment

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/utils/tags.ts`, `src/utils/tags.test.ts`
- Create: `src/components/TagPill/TagPill.tsx`, `TagPill.module.css`
- Create: `src/components/TagPicker/TagPicker.tsx`, `TagPicker.module.css`, `TagPicker.test.tsx`
- Create: `src/features/tags/deleteTag.ts`, `deleteTag.test.ts`
- Create: `src/panels/SettingsPanel/TagManager.tsx`, `TagManager.test.tsx`
- Modify: `src/panels/SettingsPanel/SettingsPanel.tsx`, `SettingsPanel.module.css`
- Modify: `src/panels/DetailPanel/TagPills.tsx`, `RouteDetail.tsx`, `TrackDetail.tsx`, `WaypointDetail.tsx`, `WaypointCreate.tsx`, `PhotoDetail.tsx`, `PhotoCreate.tsx` and their tests
- Modify: `src/store/ui.ts` (only the `pruneTagFromFilters` stub, see Step 6.1.6)

Ends with: a Tags section in Settings to create, rename, recolour and delete tags. Each tag shows how many entities use it, and deleting a tag that's in use asks for confirmation first. Every edit form and the two create forms have a tag picker, and pills everywhere use the tag colour with readable text.

- [x] **Step 6.1.1: Constants in `src/types/index.ts`**

Next to `DEFAULTS`:

```ts
// Default colours offered for new tags, cycled in order.
export const TAG_PALETTE = [
  '#E05C2A', '#2A7BE0', '#22C55E', '#F59E0B',
  '#A78BFA', '#EF4444', '#14B8A6', '#F472B6',
] as const
```

- [x] **Step 6.1.2: Tag helpers — test first, `src/utils/tags.test.ts`**

```ts
import { countTagUsage, nextTagColor, readableTextColor, validateTagInput } from './tags'
import { TAG_PALETTE, type Tag } from '../types'

const tag = (id: string, name: string): Tag => ({ id, name, color: '#888888', created_at: '' })

describe('validateTagInput', () => {
  const existing = [tag('t1', 'Steep'), tag('t2', 'North')]
  it('accepts a new unique name and a valid hex colour', () => {
    expect(validateTagInput('Couloir', '#AABBCC', existing)).toBeNull()
  })
  it('rejects a blank name', () => {
    expect(validateTagInput('  ', '#AABBCC', existing)).toMatch(/name/i)
  })
  it('rejects a duplicate name, case-insensitively', () => {
    expect(validateTagInput('steep', '#AABBCC', existing)).toMatch(/already/i)
  })
  it('allows a tag to keep its own name when renaming', () => {
    expect(validateTagInput('Steep', '#AABBCC', existing, 't1')).toBeNull()
  })
  it.each(['red', '#ABC', '#GGGGGG', 'AABBCC'])('rejects colour %s', (color) => {
    expect(validateTagInput('New', color, existing)).toMatch(/colou?r/i)
  })
})

describe('countTagUsage', () => {
  it('counts each tag across every entity collection', () => {
    const counts = countTagUsage([
      [{ tags: ['t1'] }, { tags: ['t1', 't2'] }],
      [{ tags: [] }],
      [{ tags: ['t2'] }],
    ])
    expect(counts.get('t1')).toBe(2)
    expect(counts.get('t2')).toBe(2)
    expect(counts.get('t3')).toBeUndefined()
  })
})

describe('readableTextColor', () => {
  it('uses dark text on light colours and light text on dark ones', () => {
    expect(readableTextColor('#FBBF24')).toBe('#000000')
    expect(readableTextColor('#1D4ED8')).toBe('#FFFFFF')
  })
})

describe('nextTagColor', () => {
  it('cycles the palette by tag count', () => {
    expect(nextTagColor([])).toBe(TAG_PALETTE[0])
    expect(nextTagColor(Array.from({ length: TAG_PALETTE.length + 1 }, (_, i) => tag(`t${i}`, `n${i}`))))
      .toBe(TAG_PALETTE[1])
  })
})
```

Run → FAIL. Then `src/utils/tags.ts`:

```ts
import { TAG_PALETTE, type Tag } from '../types'
import { isValidHex } from './format'

// Form-boundary validation for tag create/rename. Returns a user-facing
// message, or null when the input is acceptable. `selfId` lets a tag keep
// its own name while being renamed.
export function validateTagInput(
  name: string,
  color: string,
  existing: readonly Tag[],
  selfId?: string,
): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Tag name is required.'
  const clash = existing.find(
    (t) => t.id !== selfId && t.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (clash) return `A tag named "${clash.name}" already exists.`
  if (!isValidHex(color)) return 'Colour must be a #RRGGBB hex value.'
  return null
}

// How many entities carry each tag, across any number of entity lists.
export function countTagUsage(collections: ReadonlyArray<ReadonlyArray<{ tags: string[] }>>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const items of collections) {
    for (const item of items) {
      for (const id of item.tags) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

// Black or white, whichever reads better on the given #RRGGBB background
// (relative-luminance threshold, WCAG formula without gamma correction —
// close enough for pill text).
export function readableTextColor(hex: string): '#000000' | '#FFFFFF' {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#000000' : '#FFFFFF'
}

export function nextTagColor(existing: readonly Tag[]): string {
  return TAG_PALETTE[existing.length % TAG_PALETTE.length]
}
```

Check `isValidHex` in `src/utils/format.ts` matches `/^#[0-9a-fA-F]{6}$/`, as TASKS.md 6.1 requires. If it accepts `#RGB`, tighten it there and add a test. Run → PASS.

- [x] **Step 6.1.3: `TagPill` — the one pill used everywhere**

`src/components/TagPill/TagPill.module.css`:

```css
.pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  line-height: 1.4;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  border: 1px solid transparent;
  background: var(--tag-color);
  color: var(--tag-text);
  font-family: inherit;
}

/* Unselected pill inside a picker: outline only. */
.outline {
  background: transparent;
  border-color: var(--tag-color);
  color: var(--color-text);
}

button.pill {
  cursor: pointer;
}
```

`src/components/TagPill/TagPill.tsx`:

```tsx
import type { CSSProperties } from 'react'
import styles from './TagPill.module.css'
import type { Tag } from '../../types'
import { readableTextColor } from '../../utils/tags'

interface Props {
  tag: Tag
  // Picker usage: renders a toggle button; `selected` controls fill vs outline.
  onClick?: () => void
  selected?: boolean
}

export function TagPill({ tag, onClick, selected = true }: Props): JSX.Element {
  // Per-tag colours are data, not theme, so they arrive as CSS variables.
  const style = { '--tag-color': tag.color, '--tag-text': readableTextColor(tag.color) } as CSSProperties
  const className = selected ? styles.pill : `${styles.pill} ${styles.outline}`
  if (!onClick) return <span className={className} style={style}>{tag.name}</span>
  return (
    <button type="button" className={className} style={style} aria-pressed={selected} onClick={onClick}>
      {tag.name}
    </button>
  )
}
```

Rewrite `src/panels/DetailPanel/TagPills.tsx` to use it (and drop the inline styles):

```tsx
import { useTagsStore } from '../../store/tags'
import { TagPill } from '../../components/TagPill/TagPill'
import shared from './DetailPanel.shared.module.css'

interface Props {
  tagIds: string[]
}

export function TagPills({ tagIds }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const known = tags.filter((t) => tagIds.includes(t.id))
  if (known.length === 0) return <span className={shared.metricLabel}>No tags</span>
  return (
    <div className={shared.pillRow}>
      {known.map((tag) => <TagPill key={tag.id} tag={tag} />)}
    </div>
  )
}
```

Add to `DetailPanel.shared.module.css`:

```css
.pillRow {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}
```

Existing detail-panel tests that look for "No tags" must still pass. If one asserted the old inline colour style, update it.

- [x] **Step 6.1.4: `TagPicker` — test first, `src/components/TagPicker/TagPicker.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, useState } from 'react'
import { TagPicker } from './TagPicker'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'

function Harness({ initial = [] as string[], spy = vi.fn() }) {
  const [value, setValue] = useState<string[]>(initial)
  return <TagPicker value={value} onChange={(v) => { setValue(v); spy(v) }} />
}

describe('TagPicker', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => useTagsStore.setState({
      tags: [
        { id: 't1', name: 'Steep', color: '#EF4444', created_at: '' },
        { id: 't2', name: 'North', color: '#2A7BE0', created_at: '' },
      ],
    }))
  })
  afterEach(() => clearStorage())

  it('toggles existing tags on and off', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    expect(spy).toHaveBeenLastCalledWith(['t1'])
    expect(screen.getByRole('button', { name: 'Steep' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    expect(spy).toHaveBeenLastCalledWith([])
  })

  it('creates and selects a new tag inline', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.change(screen.getByPlaceholderText('New tag'), { target: { value: 'Couloir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(useTagsStore.getState().tags).toHaveLength(3))
    const created = useTagsStore.getState().tags.find((t) => t.name === 'Couloir')!
    expect(spy).toHaveBeenLastCalledWith([created.id])
  })

  it('selects the existing tag instead of creating a duplicate', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.change(screen.getByPlaceholderText('New tag'), { target: { value: 'steep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(['t1']))
    expect(useTagsStore.getState().tags).toHaveLength(2)
  })
})
```

`TagPicker.module.css`:

```css
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.add {
  display: flex;
  gap: var(--space-sm);
}

.add input {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text);
  font: inherit;
}

.error {
  color: var(--color-danger);
  font-size: 12px;
}
```

`TagPicker.tsx`:

```tsx
import { useState } from 'react'
import styles from './TagPicker.module.css'
import { useTagsStore } from '../../store/tags'
import { TagPill } from '../TagPill/TagPill'
import { nextTagColor, validateTagInput } from '../../utils/tags'
import { debug } from '../../utils/debug'

interface Props {
  value: string[]
  onChange: (tagIds: string[]) => void
}

// Toggle existing tags, or type a name to create one. A name that matches an
// existing tag (case-insensitively) selects that tag instead of duplicating it.
export function TagPicker({ value, onChange }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const addTag = useTagsStore((s) => s.add)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected = new Set(value)
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])

  const create = async () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    const match = tags.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (match) {
      if (!selected.has(match.id)) onChange([...value, match.id])
      setName('')
      return
    }
    const color = nextTagColor(tags)
    const problem = validateTagInput(trimmed, color, tags)
    if (problem) {
      setError(problem)
      return
    }
    try {
      const tag = await addTag({ name: trimmed, color })
      onChange([...value, tag.id])
      setName('')
      setError(null)
    } catch (err) {
      debug('tag create failed', err)
      setError('Creating the tag failed.')
    }
  }

  return (
    <div className={styles.picker}>
      {sorted.length > 0 && (
        <div className={styles.pills}>
          {sorted.map((tag) => (
            <TagPill key={tag.id} tag={tag} selected={selected.has(tag.id)} onClick={() => toggle(tag.id)} />
          ))}
        </div>
      )}
      <div className={styles.add}>
        <input
          placeholder="New tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <button type="button" onClick={() => void create()} aria-label="Add tag">Add</button>
      </div>
      {error && <span role="alert" className={styles.error}>{error}</span>}
    </div>
  )
}
```

Run the picker tests → PASS.

- [x] **Step 6.1.5: Put the picker in every form**

For each form below, add `const [tags, setTags] = useState<string[]>(…)`. Add `setTags(entity.tags)` to the existing re-sync effect where there is one. Include `tags` in the save payload, and render this section at the end of the form (replacing any read-only Tags section in that form):

```tsx
      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPicker value={tags} onChange={setTags} />
      </section>
```

| File | Component | Initial | Save payload |
|---|---|---|---|
| `RouteDetail.tsx` | `RouteEdit` | `route.tags` | `update(route.id, { …, tags })` |
| `TrackDetail.tsx` | `TrackEdit` | `track.tags` | `update(track.id, { …, tags })` |
| `WaypointDetail.tsx` | `WaypointEdit` | `wp.tags` | `update(wp.id, { …, tags })` |
| `WaypointCreate.tsx` | `WaypointCreate` | `[]` | `add({ …, tags })` (replace `tags: []`) |
| `PhotoDetail.tsx` | `PhotoEdit` | `photo.tags` | `update(photo.id, { ...parsed, lat, lng, tags })` |
| `PhotoCreate.tsx` | `PhotoCreate` | `[]` | `add({ …, tags })` (replace `tags: []`) |

View modes keep their read-only `TagPills`. Delete the "Tag editing lands in Phase 6.1" comments in `WaypointCreate.tsx` (and anywhere else they appear). The route/track/waypoint stores' `update` patch types already accept `tags`, and `PhotoMetadataPatch` includes it.

Add one test per entity type to the existing detail test files, following this route example (pre-seed a tag in `useTagsStore`, enter edit mode, click the pill, save, and assert storage):

```tsx
  it('edit assigns a tag and persists it', async () => {
    act(() => useTagsStore.setState({ tags: [{ id: 't1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    // ...existing setup that renders RouteDetail in edit mode...
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await getStorage().getRoute(route.id))?.tags).toEqual(['t1']))
  })
```

Add one more to `PhotoCreate.test.tsx` and `WaypointCreate.test.tsx` asserting the saved entity carries the picked tag.

- [x] **Step 6.1.6: Deleting a tag — test first, `src/features/tags/deleteTag.test.ts`**

`ON DELETE CASCADE` cleans `entity_tags` in storage, but every loaded entity still has the id in its `tags` array until the slices reload. `deleteTag` mirrors the cascade in memory.

```ts
import { deleteTag } from './deleteTag'
import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { Route } from '../../types'

describe('deleteTag', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
  })
  afterEach(() => clearStorage())

  it('deletes the tag, cascades in storage, and strips it from loaded entities', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#EF4444' })
    const route = await useRoutesStore.getState().add({
      user_id: 'local', name: 'R', description: '',
      geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116.01, 49.51, 1600]] },
      source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
      distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, tags: [tag.id],
    } as Omit<Route, 'id' | 'created_at' | 'updated_at'>)

    await deleteTag(tag.id)

    expect(useTagsStore.getState().tags).toHaveLength(0)
    expect(useRoutesStore.getState().routes.find((r) => r.id === route.id)?.tags).toEqual([])
    expect((await getStorage().getRoute(route.id))?.tags).toEqual([])
  })

  it('drops the tag from every layer filter', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#EF4444' })
    useUiStore.getState().setTagFilter('routes', [tag.id])
    await deleteTag(tag.id)
    expect(useUiStore.getState().tagFilters.routes).toEqual([])
  })
})
```

(Match the `add` input to `useRoutesStore`'s actual `NewRouteInput` type. Remove the cast if it typechecks without one. Reset the slices in `beforeEach` the way the other store tests do.)

The second test needs the tag-filter state from 6.2. Add the minimal piece now in `src/store/ui.ts`. Task 6.2 extends it:

```ts
  // Phase 6 — per-layer tag filters (OR semantics; empty = no filter)
  tagFilters: Record<LayerKey, string[]>
  setTagFilter: (layer: LayerKey, tagIds: string[]) => void
  clearTagFilter: (layer: LayerKey) => void
  pruneTagFromFilters: (tagId: string) => void
```

```ts
    tagFilters: { routes: [], tracks: [], waypoints: [], photos: [] },
    setTagFilter: (layer, tagIds) =>
      set((s) => ({ tagFilters: { ...s.tagFilters, [layer]: tagIds } })),
    clearTagFilter: (layer) =>
      set((s) => ({ tagFilters: { ...s.tagFilters, [layer]: [] } })),
    pruneTagFromFilters: (tagId) =>
      set((s) => ({
        tagFilters: {
          routes: s.tagFilters.routes.filter((t) => t !== tagId),
          tracks: s.tagFilters.tracks.filter((t) => t !== tagId),
          waypoints: s.tagFilters.waypoints.filter((t) => t !== tagId),
          photos: s.tagFilters.photos.filter((t) => t !== tagId),
        },
      })),
```

`src/features/tags/deleteTag.ts`:

```ts
import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'

// Deletes a tag everywhere. Storage drops the entity_tags rows via ON DELETE
// CASCADE; this mirrors that in the loaded slices so pills and filters stop
// referencing the tag without reloading every entity.
export async function deleteTag(tagId: string): Promise<void> {
  await useTagsStore.getState().remove(tagId)
  const strip = <T extends { tags: string[] }>(items: T[]): T[] =>
    items.map((it) => (it.tags.includes(tagId) ? { ...it, tags: it.tags.filter((t) => t !== tagId) } : it))
  useRoutesStore.setState((s) => ({ routes: strip(s.routes) }))
  useTracksStore.setState((s) => ({ tracks: strip(s.tracks) }))
  useWaypointsStore.setState((s) => ({ waypoints: strip(s.waypoints) }))
  usePhotosStore.setState((s) => ({ photos: strip(s.photos) }))
  useUiStore.getState().pruneTagFromFilters(tagId)
}
```

Run → PASS.

- [x] **Step 6.1.7: `TagManager` in Settings — test first, `src/panels/SettingsPanel/TagManager.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { TagManager } from './TagManager'
import { useTagsStore } from '../../store/tags'
import { useWaypointsStore } from '../../store/waypoints'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Waypoint } from '../../types'

const wp = (id: string, tags: string[]) => ({ id, tags }) as Waypoint

describe('TagManager', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => {
      useTagsStore.setState({ tags: [{ id: 't1', name: 'Steep', color: '#EF4444', created_at: '' }] })
      useWaypointsStore.setState({ waypoints: [wp('w1', ['t1']), wp('w2', ['t1'])] })
    })
  })
  afterEach(() => clearStorage())

  it('lists tags with their usage count', () => {
    render(<TagManager />)
    const row = screen.getByRole('listitem')
    expect(within(row).getByDisplayValue('Steep')).toBeInTheDocument()
    expect(within(row).getByText('2 uses')).toBeInTheDocument()
  })

  it('creates a tag', async () => {
    render(<TagManager />)
    fireEvent.change(screen.getByLabelText('New tag name'), { target: { value: 'North' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }))
    await waitFor(() => expect(useTagsStore.getState().tags.map((t) => t.name)).toContain('North'))
  })

  it('rejects a duplicate name', () => {
    render(<TagManager />)
    fireEvent.change(screen.getByLabelText('New tag name'), { target: { value: 'steep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/)
  })

  it('renames on blur', async () => {
    render(<TagManager />)
    const input = screen.getByDisplayValue('Steep')
    fireEvent.change(input, { target: { value: 'Very steep' } })
    fireEvent.blur(input)
    await waitFor(() => expect(useTagsStore.getState().tags[0].name).toBe('Very steep'))
  })

  it('asks before deleting a tag that is in use', async () => {
    render(<TagManager />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Steep' }))
    expect(screen.getByText("Tag 'Steep' is used by 2 entities. Delete?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(useTagsStore.getState().tags).toHaveLength(0))
    expect(useWaypointsStore.getState().waypoints[0].tags).toEqual([])
  })
})
```

`src/panels/SettingsPanel/TagManager.tsx`:

```tsx
import { useEffect, useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { deleteTag } from '../../features/tags/deleteTag'
import { countTagUsage, nextTagColor, validateTagInput } from '../../utils/tags'
import { TAG_PALETTE, type Tag } from '../../types'
import { debug } from '../../utils/debug'

export function TagManager(): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const add = useTagsStore((s) => s.add)
  const routes = useRoutesStore((s) => s.routes)
  const tracks = useTracksStore((s) => s.tracks)
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const photos = usePhotosStore((s) => s.photos)
  const usage = countTagUsage([routes, tracks, waypoints, photos])

  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextTagColor(tags))
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    const problem = validateTagInput(name, color, tags)
    if (problem) {
      setError(problem)
      return
    }
    try {
      await add({ name: name.trim(), color })
      setName('')
      // The store's tag list grows by one; offer the next palette colour.
      setColor(TAG_PALETTE[(tags.length + 1) % TAG_PALETTE.length])
      setError(null)
    } catch (err) {
      debug('tag create failed', err)
      setError('Creating the tag failed.')
    }
  }

  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.column}>
      {sorted.length === 0 ? (
        <p className={styles.subtle}>No tags yet.</p>
      ) : (
        <ul className={styles.tagList}>
          {sorted.map((tag) => (
            <TagRow key={tag.id} tag={tag} uses={usage.get(tag.id) ?? 0} allTags={tags} />
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <input
          type="color"
          aria-label="New tag colour"
          value={color}
          onChange={(e) => setColor(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          aria-label="New tag name"
          placeholder="New tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
        />
        <button type="button" onClick={() => void create()}>Create tag</button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  )
}

function TagRow({ tag, uses, allTags }: { tag: Tag; uses: number; allTags: Tag[] }): JSX.Element {
  const update = useTagsStore((s) => s.update)
  const [name, setName] = useState(tag.name)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setName(tag.name), [tag.name])

  const save = async (patch: { name?: string; color?: string }) => {
    const next = { name: patch.name ?? tag.name, color: patch.color ?? tag.color }
    const problem = validateTagInput(next.name, next.color, allTags, tag.id)
    if (problem) {
      setError(problem)
      setName(tag.name)
      return
    }
    try {
      await update(tag.id, { name: next.name.trim(), color: next.color })
      setError(null)
    } catch (err) {
      debug('tag update failed', err)
      setError('Saving the tag failed.')
    }
  }

  const remove = async () => {
    try {
      await deleteTag(tag.id)
    } catch (err) {
      debug('tag delete failed', err)
      setError('Deleting the tag failed.')
      setConfirming(false)
    }
  }

  return (
    <li className={styles.tagRow}>
      <div className={styles.row}>
        <input
          type="color"
          aria-label={`Colour for ${tag.name}`}
          value={tag.color}
          onChange={(e) => void save({ color: e.target.value.toUpperCase() })}
        />
        <input
          type="text"
          aria-label={`Name for ${tag.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name !== tag.name) void save({ name }) }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <span className={styles.subtle}>{uses === 1 ? '1 use' : `${uses} uses`}</span>
        {!confirming && (
          <button
            type="button"
            aria-label={`Delete ${tag.name}`}
            onClick={() => (uses > 0 ? setConfirming(true) : void remove())}
          >
            Delete
          </button>
        )}
      </div>
      {confirming && (
        <div className={styles.row}>
          <span className={styles.subtle}>{`Tag '${tag.name}' is used by ${uses} entities. Delete?`}</span>
          <button type="button" onClick={() => void remove()}>Confirm delete</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </li>
  )
}
```


Add to `SettingsPanel.module.css`:

```css
.tagList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tagRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tagRow input[type='text'],
.column > .row input[type='text'] {
  flex: 1;
  min-width: 0;
}

.row input[type='color'] {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: none;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
}
```

(Reuse the existing `.field input[type='text']` look for the text inputs by extending that selector to `.row input[type='text']`.)

In `SettingsPanel.tsx`, add a section between "Map defaults" and "About":

```tsx
      <section className={styles.section}>
        <h3>Tags</h3>
        <TagManager />
      </section>
```

Also replace the local `APP_VERSION` const and its TODO with `import { APP_VERSION } from '../../types'`.

Run the TagManager and SettingsPanel tests → PASS.

- [x] **Step 6.1.8: Verify**

`npm run typecheck`, `npm test` → green.

Browser:
- Settings → Tags: create "Steep" with a colour, rename it, change its colour. Pills elsewhere update.
- Edit a route, then a photo: tick "Steep", save, and the view shows the coloured pill with readable text.
- Create a waypoint and type a new tag name in the picker. The tag is created and selected.
- Delete "Steep" from Settings. You're asked to confirm (it's in use). Afterwards the pills disappear without a reload, and reloading confirms the tag is gone from the entities.

- [x] **Step 6.1.9: Docs, ticks, commit**

`TASKS.md` Task 6.1: append "Includes a `TagPicker` in every entity edit form and the waypoint/photo create forms (tag assignment; needed by QA step 7)." Tick 6.1 in Progress.

```
git add -A
git commit -m "feat(tags): tag management in Settings and tag picker in every form"
```

---

## Task 6.2 — Tag filtering

**Files:**
- Modify: `src/utils/tags.ts`, `tags.test.ts` (`filterByTags`)
- Modify: `src/store/ui.test.ts` (filter actions; the state itself landed in 6.1.6)
- Create: `src/panels/LayerPanel/TagFilterMenu.tsx`, `TagFilterMenu.module.css`
- Modify: `src/panels/LayerPanel/LayerPanel.tsx`, `LayerPanel.module.css`, `LayerPanel.test.tsx`
- Modify: `src/map/layers/RoutesLayer.tsx`, `TracksLayer.tsx`, `WaypointsLayer.tsx`, `PhotosLayer.tsx`

Ends with: each layer row has a Filter control (shown when any tags exist) listing every tag as a checkbox. Selecting one or more tags shows only entities with at least one of them (OR). "Clear filter" resets. Each layer's filter is independent. The count badge reads "shown of total" while a filter is active.

- [x] **Step 6.2.1: `filterByTags` — test then implement**

```ts
describe('filterByTags', () => {
  const items = [{ id: 'a', tags: ['t1'] }, { id: 'b', tags: ['t2'] }, { id: 'c', tags: [] }]
  it('returns everything when no tags are selected', () => {
    expect(filterByTags(items, [])).toBe(items)
  })
  it('keeps entities carrying any selected tag (OR)', () => {
    expect(filterByTags(items, ['t1', 't2']).map((i) => i.id)).toEqual(['a', 'b'])
  })
  it('drops untagged entities while a filter is active', () => {
    expect(filterByTags(items, ['t1']).map((i) => i.id)).toEqual(['a'])
  })
})
```

```ts
// OR semantics: an entity shows when it carries any selected tag. An empty
// selection means "no filter" and returns the input array unchanged.
export function filterByTags<T extends { tags: string[] }>(items: T[], tagIds: readonly string[]): T[] {
  if (tagIds.length === 0) return items
  const wanted = new Set(tagIds)
  return items.filter((it) => it.tags.some((t) => wanted.has(t)))
}
```

- [x] **Step 6.2.2: Store tests for the filter actions (`ui.test.ts`)**

```ts
describe('tag filters', () => {
  beforeEach(() => useUiStore.setState({ tagFilters: { routes: [], tracks: [], waypoints: [], photos: [] } }))
  it('sets and clears per layer, independently', () => {
    useUiStore.getState().setTagFilter('routes', ['t1'])
    useUiStore.getState().setTagFilter('photos', ['t2'])
    useUiStore.getState().clearTagFilter('routes')
    expect(useUiStore.getState().tagFilters).toEqual({ routes: [], tracks: [], waypoints: [], photos: ['t2'] })
  })
})
```

- [x] **Step 6.2.3: Apply the filter in each layer component**

The same change goes into all four layer components. Shown for `RoutesLayer.tsx`:

```tsx
import { useMemo } from 'react'
import { filterByTags } from '../../utils/tags'
// ...
  const routes = useRoutesStore((s) => s.routes)
  const tagFilter = useUiStore((s) => s.tagFilters.routes)
  const shown = useMemo(() => filterByTags(routes, tagFilter), [routes, tagFilter])
```

- The data-sync effect uses `shown` instead of `routes` (deps `[map, shown]`).
- The `install()` seed reads `filterByTags(useRoutesStore.getState().routes, useUiStore.getState().tagFilters.routes)`.

Layer-specific notes:
- **WaypointsLayer:** the drag `onMouseMove` rebuild uses `useWaypointsStore.getState().waypoints`. Wrap it in `filterByTags(…, useUiStore.getState().tagFilters.waypoints)` so a drag doesn't briefly show filtered-out waypoints.
- **PhotosLayer:** filter in `setPhotosData` callers (`setPhotosData(map, shown)`, and the post-thumbnail-load call uses `filterByTags(usePhotosStore.getState().photos, useUiStore.getState().tagFilters.photos)`). Keep thumbnail loading keyed off the **unfiltered** `photos`, so clearing a filter shows thumbnails immediately. Split the current effect into a data effect (deps `[map, shown]`) and an icon-loading effect (deps `[map, photos]`).
- Check `RoutesLayer`/`TracksLayer` for other `getState().routes`/`.tracks` reads (e.g. hover/highlight) and filter those too.

There are no new tests here. The layer components are verified in the browser, and `filterByTags` carries the logic. Run the existing layer tests to confirm nothing regressed.

- [x] **Step 6.2.4: `TagFilterMenu` — a native `<details>` popover**

`TagFilterMenu.module.css`:

```css
.menu {
  position: relative;
}

.menu summary {
  list-style: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-dim);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

.menu summary::-webkit-details-marker {
  display: none;
}

.active summary {
  color: var(--color-text);
  background: var(--color-bg-1);
}

.popover {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 180px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tag-color);
}
```

`TagFilterMenu.tsx`:

```tsx
import type { CSSProperties } from 'react'
import styles from './TagFilterMenu.module.css'
import { useTagsStore } from '../../store/tags'
import { useUiStore, type LayerKey } from '../../store/ui'

interface Props {
  layer: LayerKey
  label: string
}

// Per-layer tag filter: a checkbox per tag (OR semantics) and a clear button.
export function TagFilterMenu({ layer, label }: Props): JSX.Element | null {
  const tags = useTagsStore((s) => s.tags)
  const selected = useUiStore((s) => s.tagFilters[layer])
  const setTagFilter = useUiStore((s) => s.setTagFilter)
  const clearTagFilter = useUiStore((s) => s.clearTagFilter)

  if (tags.length === 0) return null
  const active = selected.length > 0
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) =>
    setTagFilter(layer, selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  return (
    <details className={active ? `${styles.menu} ${styles.active}` : styles.menu}>
      <summary aria-label={`Filter ${label} by tag`}>{active ? `Filter (${selected.length})` : 'Filter'}</summary>
      <div className={styles.popover}>
        {sorted.map((tag) => (
          <label key={tag.id} className={styles.option}>
            <input type="checkbox" checked={selected.includes(tag.id)} onChange={() => toggle(tag.id)} />
            <span className={styles.dot} style={{ '--tag-color': tag.color } as CSSProperties} aria-hidden="true" />
            {tag.name}
          </label>
        ))}
        <button type="button" onClick={() => clearTagFilter(layer)} disabled={!active}>
          Clear filter
        </button>
      </div>
    </details>
  )
}
```

- [x] **Step 6.2.5: Layer panel row — test first**

Add to `LayerPanel.test.tsx`:

```tsx
  it('filters a layer by tag and shows "shown of total"', () => {
    act(() => {
      useTagsStore.setState({ tags: [{ id: 't1', name: 'Steep', color: '#EF4444', created_at: '' }] })
      useRoutesStore.setState({ routes: [{ ...fakeRoute('r1'), tags: ['t1'] }, fakeRoute('r2')] })
    })
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const row = screen.getByText('Routes').closest('li')!
    fireEvent.click(within(row).getByText('Filter'))
    fireEvent.click(within(row).getByLabelText('Steep'))
    expect(useUiStore.getState().tagFilters.routes).toEqual(['t1'])
    expect(within(row).getByText('1 of 2')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Clear filter' }))
    expect(useUiStore.getState().tagFilters.routes).toEqual([])
  })

  it('keeps filters independent per layer', () => {
    act(() => useTagsStore.setState({ tags: [{ id: 't1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const photos = screen.getByText('Photos').closest('li')!
    fireEvent.click(within(photos).getByText('Filter'))
    fireEvent.click(within(photos).getByLabelText('Steep'))
    expect(useUiStore.getState().tagFilters).toMatchObject({ routes: [], photos: ['t1'] })
  })
```

(Reset `tagFilters` and `useTagsStore` in the file's `beforeEach`. Import `within`, `fireEvent`, `useTagsStore`.)

`LayerPanel.tsx` changes:
- Subscribe to the four filters and compute shown counts: `const shownCounts = { routes: filterByTags(routes, filters.routes).length, … }`. That means selecting the arrays (`useRoutesStore((s) => s.routes)`) instead of `.length`. Keep each selector separate, with no object-returning selectors.
- Count cell: `{filters[row.key].length > 0 ? `${shownCounts[row.key]} of ${counts[row.key]}` : counts[row.key]}`. Keep `data-count={counts[row.key]}` (the total) so the Phase 3–5 count tests keep passing.
- Insert `<TagFilterMenu layer={row.key} label={row.label} />` between the count and the switch.

`LayerPanel.module.css`: `.row { grid-template-columns: auto 1fr auto auto auto; }`.

Run → PASS.

- [x] **Step 6.2.6: Verify**

`npm run typecheck`, `npm test` → green.

Browser: tag one route "Steep" and another "North". Filter Routes by Steep and only that route shows. Add North and both show. Clear and all show. Filter Photos independently and Routes is unaffected. Count reads "1 of 3" etc.

- [x] **Step 6.2.7: Ticks, commit**

```
git commit -am "feat(layers): per-layer tag filters"
```

(Use `git add -A` first so the new files are included.)

---

## Task 6.3 — Global search

**Files:**
- Create: `src/features/search/search.ts`, `search.test.ts`
- Modify: `src/utils/geo.ts`, `geo.test.ts` (`lineBounds`)
- Create: `src/map/flyToEntity.ts`, `flyToEntity.test.ts`
- Modify: `src/test/mocks/maplibre-gl.ts` (`fitBounds`)
- Create: `src/panels/SearchPanel/SearchPanel.tsx`, `SearchPanel.module.css`, `SearchPanel.test.tsx`
- Modify: `src/App.tsx`

Ends with: the Search tab has a text input. Results across all four types are grouped under Routes / Tracks / Waypoints / Photos with counts. Clicking a result turns its layer on if it was hidden, flies the map to it (route/track: fit bounds; point: fly to), and opens its detail panel. A blank query shows a hint; no matches shows an empty state.

- [x] **Step 6.3.1: Search logic — test first, `src/features/search/search.test.ts`**

```ts
import { searchEntities } from './search'

const e = (id: string, name: string, description = '') => ({ id, name, description })
const data = {
  routes: [e('r1', 'Lone Tree Couloir', 'North-facing chute off the ridge'), e('r2', 'Bootleg Bowl')],
  tracks: [e('t1', 'Tour 2026-02-14', 'Skinned up Lone Tree')],
  waypoints: [e('w1', 'Lone Tree entry gate')],
  photos: [e('p1', 'IMG_0001', 'Couloir from across the valley')],
}

describe('searchEntities', () => {
  it('returns null for a blank query', () => {
    expect(searchEntities('   ', data)).toBeNull()
  })

  it('matches names and descriptions case-insensitively, grouped by type', () => {
    const r = searchEntities('lone tree', data)!
    expect(r.route.map((h) => h.id)).toEqual(['r1'])
    expect(r.track.map((h) => h.id)).toEqual(['t1'])
    expect(r.waypoint.map((h) => h.id)).toEqual(['w1'])
    expect(r.photo).toEqual([])
  })

  it('requires every term to match (AND across terms)', () => {
    expect(searchEntities('couloir valley', data)!.photo.map((h) => h.id)).toEqual(['p1'])
    expect(searchEntities('couloir bowl', data)!.route).toEqual([])
  })

  it('ranks name matches above description-only matches', () => {
    const r = searchEntities('couloir', { ...data, routes: [e('a', 'Bowl', 'a couloir'), e('b', 'Couloir')] })!
    expect(r.route.map((h) => h.id)).toEqual(['b', 'a'])
  })

  it('gives description-only matches a snippet', () => {
    const hit = searchEntities('valley', data)!.photo[0]
    expect(hit.snippet).toMatch(/across the valley/)
  })
})
```

`src/features/search/search.ts`:

```ts
import type { EntityType } from '../../types'

interface Searchable {
  id: string
  name: string
  description: string
}

export interface SearchHit {
  type: EntityType
  id: string
  name: string
  // Excerpt shown when the match is only in the description.
  snippet: string | null
}

export type SearchResults = Record<EntityType, SearchHit[]>

const SNIPPET_RADIUS = 40

// Case-insensitive substring search across name + description. Every
// whitespace-separated term must match somewhere (AND). Name matches rank
// first, then alphabetical. Null for a blank query.
export function searchEntities(
  query: string,
  data: { routes: Searchable[]; tracks: Searchable[]; waypoints: Searchable[]; photos: Searchable[] },
): SearchResults | null {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return null
  return {
    route: match('route', data.routes, terms),
    track: match('track', data.tracks, terms),
    waypoint: match('waypoint', data.waypoints, terms),
    photo: match('photo', data.photos, terms),
  }
}

function match(type: EntityType, items: Searchable[], terms: string[]): SearchHit[] {
  const hits: Array<SearchHit & { inName: boolean }> = []
  for (const item of items) {
    const name = item.name.toLowerCase()
    const haystack = `${name} ${item.description.toLowerCase()}`
    if (!terms.every((t) => haystack.includes(t))) continue
    const inName = terms.some((t) => name.includes(t))
    hits.push({
      type,
      id: item.id,
      name: item.name,
      inName,
      snippet: terms.every((t) => name.includes(t)) ? null : snippet(item.description, terms),
    })
  }
  hits.sort((a, b) => Number(b.inName) - Number(a.inName) || a.name.localeCompare(b.name))
  return hits.map(({ inName: _inName, ...hit }) => hit)
}

function snippet(description: string, terms: string[]): string | null {
  const lower = description.toLowerCase()
  const at = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (at === undefined) return null
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(description.length, at + SNIPPET_RADIUS)
  return `${start > 0 ? '…' : ''}${description.slice(start, end)}${end < description.length ? '…' : ''}`
}
```

(If the project's tsconfig flags `_inName` as unused, use `hits.map((h) => ({ type: h.type, id: h.id, name: h.name, snippet: h.snippet }))` instead.)

- [x] **Step 6.3.2: `lineBounds` and `flyToEntity`**

`geo.test.ts`:

```ts
describe('lineBounds', () => {
  it('returns [[minLng, minLat], [maxLng, maxLat]]', () => {
    expect(lineBounds({ type: 'LineString', coordinates: [[-116, 49.5, 0], [-115.9, 49.4, 0], [-116.1, 49.6, 0]] }))
      .toEqual([[-116.1, 49.4], [-115.9, 49.6]])
  })
})
```

`geo.ts`:

```ts
export function lineBounds(line: LineStringZ): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of line.coordinates) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [[minLng, minLat], [maxLng, maxLat]]
}
```

Add `fitBounds = vi.fn()` to `MockMap`.

`flyToEntity.test.ts`:

```ts
import { __mocks__ } from '../test/mocks/maplibre-gl'
import { flyToEntity, POINT_FLY_ZOOM } from './flyToEntity'

describe('flyToEntity', () => {
  it('fits a line entity to its bounds', () => {
    const map = new __mocks__.MockMap()
    flyToEntity(map as never, { kind: 'line', geojson: { type: 'LineString', coordinates: [[-116, 49.5, 0], [-115.9, 49.6, 0]] } })
    expect(map.fitBounds).toHaveBeenCalledWith([[-116, 49.5], [-115.9, 49.6]], expect.objectContaining({ padding: expect.any(Number) }))
  })
  it('flies to a point entity, never zooming out', () => {
    const map = new __mocks__.MockMap()
    map.getZoom.mockReturnValue(16)
    flyToEntity(map as never, { kind: 'point', lat: 49.5, lng: -116 })
    expect(map.flyTo).toHaveBeenCalledWith({ center: [-116, 49.5], zoom: 16 })
    map.getZoom.mockReturnValue(10)
    flyToEntity(map as never, { kind: 'point', lat: 49.5, lng: -116 })
    expect(map.flyTo).toHaveBeenLastCalledWith({ center: [-116, 49.5], zoom: POINT_FLY_ZOOM })
  })
})
```

`src/map/flyToEntity.ts`:

```ts
import type maplibregl from 'maplibre-gl'
import type { LineStringZ } from '../types'
import { lineBounds } from '../utils/geo'

export const POINT_FLY_ZOOM = 15
const FIT_PADDING_PX = 60

export type FlyTarget =
  | { kind: 'line'; geojson: LineStringZ }
  | { kind: 'point'; lat: number; lng: number }

// Frames an entity: lines fit their bounds, points fly to a working zoom
// without zooming out if the user is already closer.
export function flyToEntity(map: maplibregl.Map, target: FlyTarget): void {
  if (target.kind === 'line') {
    map.fitBounds(lineBounds(target.geojson), { padding: FIT_PADDING_PX, maxZoom: POINT_FLY_ZOOM })
    return
  }
  map.flyTo({ center: [target.lng, target.lat], zoom: Math.max(map.getZoom(), POINT_FLY_ZOOM) })
}
```

- [x] **Step 6.3.3: `SearchPanel` — test first**

`SearchPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { SearchPanel } from './SearchPanel'
import { useRoutesStore } from '../../store/routes'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { setMap } from '../../hooks/useMap'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import type { Route, Waypoint } from '../../types'

describe('SearchPanel', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    map = new __mocks__.MockMap()
    act(() => {
      setMap(map as never)
      useRoutesStore.setState({ routes: [{
        id: 'r1', name: 'Lone Tree Couloir', description: '', tags: [],
        geojson: { type: 'LineString', coordinates: [[-116, 49.5, 0], [-115.9, 49.6, 0]] },
      } as unknown as Route] })
      useWaypointsStore.setState({ waypoints: [{ id: 'w1', name: 'Lone Tree gate', description: '', lat: 49.5, lng: -116, tags: [] } as unknown as Waypoint] })
      useUiStore.setState({ panel: { mode: 'idle' }, layerVisibility: { routes: false, tracks: true, waypoints: true, photos: true } })
    })
  })
  afterEach(() => act(() => setMap(null)))

  it('shows a hint before typing', () => {
    render(<SearchPanel />)
    expect(screen.getByText(/search names and descriptions/i)).toBeInTheDocument()
  })

  it('groups results by type', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lone' } })
    expect(screen.getByRole('heading', { name: 'Routes (1)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Waypoints (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Tracks/ })).toBeNull()
  })

  it('shows an empty state when nothing matches', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches for “zzz”.')).toBeInTheDocument()
  })

  it('clicking a result shows its layer, frames it, and opens it', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'couloir' } })
    fireEvent.click(screen.getByRole('button', { name: /Lone Tree Couloir/ }))
    expect(useUiStore.getState().layerVisibility.routes).toBe(true)
    expect(map.fitBounds).toHaveBeenCalled()
    expect(useUiStore.getState().panel).toEqual({ mode: 'view', entityType: 'route', entityId: 'r1' })
  })
})
```

`SearchPanel.module.css`:

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

.input {
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  color: var(--color-text);
  font: inherit;
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.group h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-dim);
}

.hits {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hit {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.hit:hover,
.hit:focus-visible {
  background: var(--color-bg-2);
  border-color: var(--color-border);
}

.snippet,
.subtle {
  color: var(--color-text-dim);
  font-size: 12px;
}
```

`SearchPanel.tsx`:

```tsx
import { useMemo, useState } from 'react'
import styles from './SearchPanel.module.css'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useUiStore, type LayerKey } from '../../store/ui'
import { getMap } from '../../hooks/useMap'
import { searchEntities, type SearchHit } from '../../features/search/search'
import { flyToEntity, type FlyTarget } from '../../map/flyToEntity'
import type { EntityType } from '../../types'

const GROUPS: ReadonlyArray<{ type: EntityType; label: string; layer: LayerKey }> = [
  { type: 'route', label: 'Routes', layer: 'routes' },
  { type: 'track', label: 'Tracks', layer: 'tracks' },
  { type: 'waypoint', label: 'Waypoints', layer: 'waypoints' },
  { type: 'photo', label: 'Photos', layer: 'photos' },
]

export function SearchPanel(): JSX.Element {
  const [query, setQuery] = useState('')
  const routes = useRoutesStore((s) => s.routes)
  const tracks = useTracksStore((s) => s.tracks)
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const photos = usePhotosStore((s) => s.photos)

  const results = useMemo(
    () => searchEntities(query, { routes, tracks, waypoints, photos }),
    [query, routes, tracks, waypoints, photos],
  )
  const total = results ? GROUPS.reduce((n, g) => n + results[g.type].length, 0) : 0

  const open = (hit: SearchHit, layer: LayerKey) => {
    const ui = useUiStore.getState()
    if (!ui.layerVisibility[layer]) ui.toggleLayer(layer)
    const target = flyTargetFor(hit)
    const map = getMap()
    if (map && target) flyToEntity(map, target)
    ui.openEntity(hit.type, hit.id)
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Search</h2>
      <input
        type="search"
        className={styles.input}
        placeholder="Search…"
        aria-label="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {results === null && (
        <p className={styles.subtle}>Search names and descriptions of routes, tracks, waypoints and photos.</p>
      )}
      {results !== null && total === 0 && <p className={styles.subtle}>{`No matches for “${query.trim()}”.`}</p>}
      {results !== null &&
        GROUPS.filter((g) => results[g.type].length > 0).map((g) => (
          <section key={g.type} className={styles.group}>
            <h3>{`${g.label} (${results[g.type].length})`}</h3>
            <ul className={styles.hits}>
              {results[g.type].map((hit) => (
                <li key={hit.id}>
                  <button type="button" className={styles.hit} onClick={() => open(hit, g.layer)}>
                    <span>{hit.name}</span>
                    {hit.snippet && <span className={styles.snippet}>{hit.snippet}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

// Looked up at click time so the target reflects the latest store state.
function flyTargetFor(hit: SearchHit): FlyTarget | null {
  switch (hit.type) {
    case 'route': {
      const r = useRoutesStore.getState().routes.find((x) => x.id === hit.id)
      return r ? { kind: 'line', geojson: r.geojson } : null
    }
    case 'track': {
      const t = useTracksStore.getState().tracks.find((x) => x.id === hit.id)
      return t ? { kind: 'line', geojson: t.geojson } : null
    }
    case 'waypoint': {
      const w = useWaypointsStore.getState().waypoints.find((x) => x.id === hit.id)
      return w ? { kind: 'point', lat: w.lat, lng: w.lng } : null
    }
    case 'photo': {
      const p = usePhotosStore.getState().photos.find((x) => x.id === hit.id)
      return p ? { kind: 'point', lat: p.lat, lng: p.lng } : null
    }
  }
}
```

The test's heading query `getByRole('heading', { name: 'Routes (1)' })` matches the `<h3>`. A result button's accessible name includes its snippet, so the test matches with a regex.

In `App.tsx`, add `search: <SearchPanel />` to the `Sidebar` `panels` map. If `App.test.tsx` asserts the Search tab renders nothing, update it.

A search hit can be in a layer that's tag-filtered out. Opening it still works (the panel opens, the map frames it), but the entity won't render on the map. That's acceptable for the MVP and is noted in ARCHITECTURE.md (Step 6.3.5).

- [x] **Step 6.3.4: Verify**

`npm run typecheck`, `npm test` → green. Browser: search a route name, click the result, and the map fits the route and the panel opens. Search a description word and the snippet shows. Type nonsense and the empty state shows.

- [x] **Step 6.3.5: Docs, ticks, commit**

`ARCHITECTURE.md` › State Management: add a short "Tag filters" paragraph (`ui.tagFilters`, OR semantics, applied in JS before GeoJSON build; search ignores filters but turns a hidden layer on).

```
git add -A
git commit -m "feat(search): global search with grouped results and fly-to"
```

---

## Task 6.4 — Export and import (ZIP backup)

**Files:**
- `npm install fflate@0.8.3`
- Modify: `src/types/index.ts` (`BUNDLE_VERSION`, `BACKUP_*` names)
- Create: `src/types/fileSystemAccess.d.ts`
- Modify: `src/utils/image.ts` (`makeThumbnail`), `src/utils/format.ts`, `format.test.ts` (`formatBytes`)
- Create: `src/features/backup/writeBackup.ts`, `readBackup.ts`, `prepareImport.ts`, `saveTarget.ts`, `backup.test.ts`
- Create: `src/panels/SettingsPanel/BackupSection.tsx`, `BackupSection.test.tsx`
- Modify: `src/panels/SettingsPanel/SettingsPanel.tsx`
- Modify: `ARCHITECTURE.md` (Backup Format)

Ends with: Settings › Backup has "Export backup…" and "Restore from backup…". Export shows "Backup will be ~N MB. Continue?", then saves `couloir-backup-YYYY-MM-DD.zip` (streamed to disk in Chrome/Edge). Restore reads a ZIP, shows what's in it with the spec's confirmation text, then merges via `importAll`, regenerating any missing thumbnails, and reloads every slice. Importing the same ZIP twice changes nothing the second time.

- [x] **Step 6.4.1: Install and constants**

```bash
npm install fflate@0.8.3
```

`src/types/index.ts`, next to `APP_VERSION`:

```ts
// Backup ZIP format (src/features/backup). Bump BUNDLE_VERSION only for
// breaking changes to metadata.json; readers reject newer versions.
export const BUNDLE_VERSION = 1
export const BACKUP_MANIFEST_FILE = 'manifest.json'
export const BACKUP_METADATA_FILE = 'metadata.json'
```

Replace the literal `bundle_version: 1` in `opfs.ts` and `memory.ts` `exportAll` with `BUNDLE_VERSION`.

- [x] **Step 6.4.2: `formatBytes` and `makeThumbnail`**

`format.test.ts`:

```ts
describe('formatBytes', () => {
  it.each([[512, '512 B'], [2048, '2 KB'], [5_400_000, '5.1 MB'], [3_221_225_472, '3.0 GB']])('%s → %s', (n, out) => {
    expect(formatBytes(n)).toBe(out)
  })
})
```

`format.ts`:

```ts
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}
```

`image.ts` (browser-only, like `encodePhoto`):

```ts
// Regenerates a thumbnail from a stored full-size JPEG (backup restore).
export async function makeThumbnail(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    return await drawToJpeg(bitmap, fitWithin(bitmap.width, bitmap.height, PHOTO_THUMB_EDGE_PX))
  } finally {
    bitmap.close()
  }
}
```

- [x] **Step 6.4.3: Round-trip tests first — `src/features/backup/backup.test.ts`**

These run fully in jsdom: fflate is pure JS, and the thumbnail generator is injected.

```ts
import { strToU8, zipSync } from 'fflate'
import { InMemoryStorageProvider } from '../../storage/memory'
import { writeBackup, estimateBackupBytes, backupFilename, type BackupSink } from './writeBackup'
import { readBackup, BackupFormatError } from './readBackup'
import { prepareImport } from './prepareImport'
import type { Photo, Route } from '../../types'

const ts = '2026-02-14T12:00:00.000Z'
const route: Route = {
  id: 'r1', user_id: 'local', name: 'Lone Tree', description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116.01, 49.51, 1600]] },
  source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
  distance_m: 1, elevation_gain_m: 100, elevation_loss_m: 0, tags: ['t1'], created_at: ts, updated_at: ts,
}
const photo: Photo = {
  id: 'p1', user_id: 'local', name: 'IMG', description: '', lat: 49.5, lng: -116, elevation_m: null,
  bearing: 90, blob_ref: 'photos/p1.jpg', width: 10, height: 10, file_size_bytes: 4, taken_at: null,
  tags: [], created_at: ts, updated_at: ts,
}

async function seeded(): Promise<InMemoryStorageProvider> {
  const s = new InMemoryStorageProvider()
  await s.init()
  await s.saveTag({ id: 't1', name: 'Steep', color: '#EF4444', created_at: ts })
  await s.saveRoute(route)
  await s.savePhoto(photo, new Blob(['full']), new Blob(['thumb']))
  return s
}

function memorySink(): BackupSink & { chunks: Uint8Array[] } {
  const chunks: Uint8Array[] = []
  return { chunks, write: async (c) => { chunks.push(c) }, close: async () => {} }
}

async function* iterate(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const c of chunks) yield c
}

const fakeThumb = vi.fn(async () => new Blob(['regenerated']))

describe('backup', () => {
  it('names the file by local date', () => {
    expect(backupFilename(new Date(2026, 1, 4))).toBe('couloir-backup-2026-02-04.zip')
  })

  it('estimates size from photo bytes plus metadata', () => {
    const est = estimateBackupBytes({ routes: [route], tracks: [], waypoints: [], photos: [photo], tags: [] })
    expect(est).toBeGreaterThan(photo.file_size_bytes)
    expect(est).toBeLessThan(1_000_000)
  })

  it('round-trips entities, tags, blobs and thumbnails into an empty store', async () => {
    const sink = memorySink()
    const manifest = await writeBackup(await seeded(), sink)
    expect(manifest).toMatchObject({ bundle_version: 1, photo_count: 1 })

    const parsed = await readBackup(iterate(sink.chunks))
    const prepared = await prepareImport(parsed, fakeThumb)
    const target = new InMemoryStorageProvider()
    await target.init()
    await target.importAll(prepared.bundle, prepared.photos, prepared.thumbs)

    expect((await target.getRoute('r1'))?.tags).toEqual(['t1'])
    expect(await target.getTags()).toHaveLength(1)
    expect(await (await target.getPhotoBlob('p1'))!.text()).toBe('full')
    expect(await (await target.getPhotoThumb('p1'))!.text()).toBe('thumb')
    expect(fakeThumb).not.toHaveBeenCalled()
  })

  it('is idempotent: importing twice leaves one copy of everything', async () => {
    const sink = memorySink()
    await writeBackup(await seeded(), sink)
    const target = new InMemoryStorageProvider()
    await target.init()
    for (let i = 0; i < 2; i++) {
      const prepared = await prepareImport(await readBackup(iterate(sink.chunks)), fakeThumb)
      await target.importAll(prepared.bundle, prepared.photos, prepared.thumbs)
    }
    expect(await target.getRoutes()).toHaveLength(1)
    expect(await target.getPhotos()).toHaveLength(1)
    expect(await target.getTags()).toHaveLength(1)
  })

  it('regenerates missing thumbnails', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 1, total_size_bytes: 4 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, routes: [], tracks: [], waypoints: [], photos: [photo], tags: [], entity_tags: [] })),
      'photos/p1.jpg': strToU8('full'),
    })
    const prepared = await prepareImport(await readBackup(iterate([zip])), fakeThumb)
    expect(prepared.regeneratedThumbs).toBe(1)
    expect(await prepared.thumbs.get('p1')!.text()).toBe('regenerated')
  })

  it('drops photos whose full-size image is missing', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 1, total_size_bytes: 4 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, routes: [], tracks: [], waypoints: [], photos: [photo], tags: [], entity_tags: [] })),
    })
    const prepared = await prepareImport(await readBackup(iterate([zip])), fakeThumb)
    expect(prepared.bundle.photos).toEqual([])
    expect(prepared.droppedPhotos).toBe(1)
  })

  it('rejects a backup from a newer version', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 2, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8('{}'),
    })
    await expect(readBackup(iterate([zip]))).rejects.toThrow(/newer version/)
  })

  it('rejects a ZIP that is not a Couloir backup', async () => {
    await expect(readBackup(iterate([zipSync({ 'hello.txt': strToU8('hi') })])))
      .rejects.toBeInstanceOf(BackupFormatError)
  })
})
```

Run → FAIL (modules missing).

- [x] **Step 6.4.4: `src/features/backup/writeBackup.ts`**

```ts
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'
import type { StorageProvider } from '../../storage/interface'
import {
  APP_VERSION, BACKUP_MANIFEST_FILE, BACKUP_METADATA_FILE, BUNDLE_VERSION,
  type BackupManifest, type EntityTagRow, type EntityType, type ExportBundle,
  type Photo, type Route, type Tag, type Track, type Waypoint,
} from '../../types'

export interface BackupSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

// Per-photo thumbnail size guess for the pre-export estimate.
const THUMB_ESTIMATE_BYTES = 12_000

export function backupFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `couloir-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`
}

// Photo bytes + a thumbnail guess per photo + the uncompressed metadata
// JSON. Slightly high, since metadata.json is deflated in the ZIP.
export function estimateBackupBytes(data: {
  routes: Route[]; tracks: Track[]; waypoints: Waypoint[]; photos: Photo[]; tags: Tag[]
}): number {
  const photoBytes = data.photos.reduce((sum, p) => sum + p.file_size_bytes, 0)
  return photoBytes + data.photos.length * THUMB_ESTIMATE_BYTES + JSON.stringify(data).length
}

// Streams a backup ZIP into `sink`. Photos are read from storage one at a
// time, and each is flushed to the sink before the next is read, so memory
// stays bounded by one photo regardless of library size.
export async function writeBackup(storage: StorageProvider, sink: BackupSink): Promise<BackupManifest> {
  const [routes, tracks, waypoints, photos, tags] = await Promise.all([
    storage.getRoutes(), storage.getTracks(), storage.getWaypoints(), storage.getPhotos(), storage.getTags(),
  ])
  const exportedAt = new Date().toISOString()
  const bundle: ExportBundle = {
    bundle_version: BUNDLE_VERSION,
    app_version: APP_VERSION,
    exported_at: exportedAt,
    routes, tracks, waypoints, photos, tags,
    // Entities carry their hydrated tag ids, so the junction rows can be
    // rebuilt here without a storage round-trip.
    entity_tags: [
      ...junctionRows('route', routes), ...junctionRows('track', tracks),
      ...junctionRows('waypoint', waypoints), ...junctionRows('photo', photos),
    ],
  }
  const manifest: BackupManifest = {
    bundle_version: BUNDLE_VERSION,
    app_version: APP_VERSION,
    exported_at: exportedAt,
    photo_count: photos.length,
    total_size_bytes: photos.reduce((sum, p) => sum + p.file_size_bytes, 0),
  }

  let writes: Promise<void> = Promise.resolve()
  let zipError: Error | null = null
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      zipError = err
      return
    }
    writes = writes.then(() => sink.write(chunk))
    if (final) writes = writes.then(() => sink.close())
  })

  const add = (name: string, data: Uint8Array, compress: boolean) => {
    // JPEGs are already compressed; deflating them wastes CPU for ~0% gain.
    const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
    zip.add(file)
    file.push(data, true)
  }

  try {
    add(BACKUP_MANIFEST_FILE, strToU8(JSON.stringify(manifest, null, 2)), true)
    add(BACKUP_METADATA_FILE, strToU8(JSON.stringify(bundle)), true)
    for (const p of photos) {
      const full = await storage.getPhotoBlob(p.id)
      if (full) add(`photos/${p.id}.jpg`, new Uint8Array(await full.arrayBuffer()), false)
      const thumb = await storage.getPhotoThumb(p.id)
      if (thumb) add(`photos/${p.id}_thumb.jpg`, new Uint8Array(await thumb.arrayBuffer()), false)
      await writes // backpressure: let the sink drain before reading the next photo
      if (zipError) throw zipError
    }
    zip.end()
    await writes
    if (zipError) throw zipError
  } catch (err) {
    await sink.abort?.()
    throw err
  }
  return manifest
}

function junctionRows(type: EntityType, items: Array<{ id: string; tags: string[] }>): EntityTagRow[] {
  return items.flatMap((it) => it.tags.map((tag_id) => ({ entity_type: type, entity_id: it.id, tag_id })))
}
```

(TypeScript narrows `zipError` to `null` after the assignment in the callback. If it complains `'never'` at the `throw`, declare it `let zipError = null as Error | null`.)

- [x] **Step 6.4.5: `src/features/backup/readBackup.ts`**

```ts
import { Unzip, UnzipInflate, strFromU8 } from 'fflate'
import {
  BACKUP_MANIFEST_FILE, BACKUP_METADATA_FILE, BUNDLE_VERSION,
  type BackupManifest, type ExportBundle,
} from '../../types'

export class BackupFormatError extends Error {
  name = 'BackupFormatError'
}

export interface ParsedBackup {
  manifest: BackupManifest
  bundle: ExportBundle
  photos: Map<string, Blob>
  thumbs: Map<string, Blob>
}

const PHOTO_ENTRY = /^photos\/([^/]+?)(_thumb)?\.jpg$/

// Streams a ZIP through fflate's Unzip, so the archive itself is never held
// in memory — only the extracted entries are.
export async function readBackup(chunks: AsyncIterable<Uint8Array>): Promise<ParsedBackup> {
  const entries = new Map<string, Uint8Array[]>()
  let entryError: Error | null = null
  const unzip = new Unzip((file) => {
    const parts: Uint8Array[] = []
    entries.set(file.name, parts)
    file.ondata = (err, data) => {
      if (err) entryError = err
      else parts.push(data)
    }
    file.start()
  })
  unzip.register(UnzipInflate)

  try {
    for await (const chunk of chunks) unzip.push(chunk)
    unzip.push(new Uint8Array(0), true)
  } catch (err) {
    throw new BackupFormatError(`That file isn't a readable ZIP: ${String(err)}`)
  }
  if (entryError) throw new BackupFormatError(`The backup is damaged: ${String(entryError)}`)

  const manifest = readJson<BackupManifest>(entries, BACKUP_MANIFEST_FILE)
  if (typeof manifest.bundle_version !== 'number') {
    throw new BackupFormatError('Not a Couloir backup: the manifest has no bundle_version.')
  }
  if (manifest.bundle_version > BUNDLE_VERSION) {
    throw new BackupFormatError(
      `This backup was made by a newer version of Couloir (format ${manifest.bundle_version}). Update the app to restore it.`,
    )
  }
  const bundle = readJson<ExportBundle>(entries, BACKUP_METADATA_FILE)
  for (const key of ['routes', 'tracks', 'waypoints', 'photos', 'tags', 'entity_tags'] as const) {
    if (!Array.isArray(bundle[key])) throw new BackupFormatError(`The backup's metadata is missing "${key}".`)
  }

  const photos = new Map<string, Blob>()
  const thumbs = new Map<string, Blob>()
  for (const [name, parts] of entries) {
    const m = PHOTO_ENTRY.exec(name)
    if (!m) continue
    const blob = new Blob(parts as BlobPart[], { type: 'image/jpeg' })
    ;(m[2] ? thumbs : photos).set(m[1], blob)
  }
  return { manifest, bundle, photos, thumbs }
}

function readJson<T>(entries: Map<string, Uint8Array[]>, name: string): T {
  const parts = entries.get(name)
  if (!parts) throw new BackupFormatError(`Not a Couloir backup: ${name} is missing.`)
  const total = parts.reduce((n, p) => n + p.length, 0)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    bytes.set(p, offset)
    offset += p.length
  }
  try {
    return JSON.parse(strFromU8(bytes)) as T
  } catch {
    throw new BackupFormatError(`The backup's ${name} is not valid JSON.`)
  }
}

// Chunks of a user-picked file. Falls back to one chunk where Blob.stream()
// isn't available (jsdom).
export async function* fileChunks(file: Blob): AsyncIterable<Uint8Array> {
  if (typeof file.stream !== 'function') {
    yield new Uint8Array(await file.arrayBuffer())
    return
  }
  const reader = file.stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}
```

The "not a Couloir backup" test expects the missing-manifest error, which the `readJson` path throws as a `BackupFormatError`.

> **Implemented differently:** the shipped `readBackup` collects the chunks and calls `unzipSync` (central directory) instead of the streaming `Unzip` above. `fflate.Zip` writes every entry with a data descriptor, and the streaming `Unzip` ends such an entry at the first `PK` / `PK` byte sequence it sees, so a JPEG containing those bytes was truncated or broke the read. `backup.test.ts` has a regression test ("round-trips photo bytes that contain ZIP signatures"). Same signature and errors; memory was already bounded by the backup size because `importAll` takes Maps.

- [x] **Step 6.4.6: `src/features/backup/prepareImport.ts`**

```ts
import type { ExportBundle } from '../../types'
import type { ParsedBackup } from './readBackup'

export interface PreparedImport {
  bundle: ExportBundle
  photos: Map<string, Blob>
  thumbs: Map<string, Blob>
  regeneratedThumbs: number
  droppedPhotos: number
}

// Makes a parsed backup safe to hand to importAll: photos without a full-size
// image are dropped (with their tag rows); missing thumbnails are rebuilt.
export async function prepareImport(
  parsed: ParsedBackup,
  makeThumbnail: (full: Blob) => Promise<Blob>,
): Promise<PreparedImport> {
  const { bundle, photos } = parsed
  const thumbs = new Map(parsed.thumbs)
  const kept = bundle.photos.filter((p) => photos.has(p.id))
  const keptIds = new Set(kept.map((p) => p.id))
  let regeneratedThumbs = 0
  for (const p of kept) {
    if (thumbs.has(p.id)) continue
    thumbs.set(p.id, await makeThumbnail(photos.get(p.id)!))
    regeneratedThumbs++
  }
  return {
    bundle: {
      ...bundle,
      photos: kept,
      entity_tags: bundle.entity_tags.filter((r) => r.entity_type !== 'photo' || keptIds.has(r.entity_id)),
    },
    photos,
    thumbs,
    regeneratedThumbs,
    droppedPhotos: bundle.photos.length - kept.length,
  }
}

export function summarizeBundle(b: ExportBundle): string {
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  return [
    part(b.routes.length, 'route'), part(b.tracks.length, 'track'),
    part(b.waypoints.length, 'waypoint'), part(b.photos.length, 'photo'), part(b.tags.length, 'tag'),
  ].join(', ')
}
```

Run `backup.test.ts` → PASS.

- [x] **Step 6.4.7: Save target — `src/types/fileSystemAccess.d.ts` + `src/features/backup/saveTarget.ts`**

`src/types/fileSystemAccess.d.ts` (TS 5.6's `lib.dom` lacks the picker):

```ts
// Minimal File System Access API surface used by backup export. Chrome/Edge
// only; callers feature-detect `window.showSaveFilePicker`.
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
```

If `FileSystemFileHandle.createWritable` is missing from the lib types, add:

```ts
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
}
```

and the stream interface if needed. Check what TS 5.6 provides first, and only add what's missing.

`src/features/backup/saveTarget.ts`:

```ts
import type { BackupSink } from './writeBackup'

// Where an export goes. With the File System Access API (Chrome/Edge) the ZIP
// streams straight to the chosen file; otherwise chunks collect into a Blob
// that downloads when the sink closes. Returns null if the user cancels the
// save dialog. Must be called from a user gesture (the picker requires one).
export async function openSaveTarget(filename: string): Promise<BackupSink | null> {
  if (window.showSaveFilePicker) {
    let handle: FileSystemFileHandle
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Couloir backup', accept: { 'application/zip': ['.zip'] } }],
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
      throw err
    }
    const writable = await handle.createWritable()
    return {
      write: (chunk) => writable.write(chunk),
      close: () => writable.close(),
      abort: () => writable.abort(),
    }
  }

  const parts: Uint8Array[] = []
  return {
    write: async (chunk) => { parts.push(chunk) },
    close: async () => {
      const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      // Give the download a moment to start before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
  }
}
```

- [x] **Step 6.4.8: `BackupSection` — test first**

`BackupSection.test.tsx` covers the confirmation flows. The real file I/O is covered by `backup.test.ts`.

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { strToU8, zipSync } from 'fflate'
import { BackupSection } from './BackupSection'
import { usePhotosStore } from '../../store/photos'
import { useRoutesStore } from '../../store/routes'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import * as saveTarget from '../../features/backup/saveTarget'
import type { Photo } from '../../types'

describe('BackupSection', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => usePhotosStore.setState({ photos: [{ id: 'p1', file_size_bytes: 5_000_000, tags: [] } as unknown as Photo] }))
  })
  afterEach(() => { clearStorage(); vi.restoreAllMocks() })

  it('shows the size estimate before exporting', () => {
    render(<BackupSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    expect(screen.getByText(/Backup will be ~4\.\d MB\. Continue\?/)).toBeInTheDocument()
  })

  it('cancelling the save dialog returns to idle', async () => {
    vi.spyOn(saveTarget, 'openSaveTarget').mockResolvedValue(null)
    render(<BackupSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export backup…' })).toBeInTheDocument())
  })

  it('confirms before restoring, then reloads the slices', async () => {
    const ts = '2026-02-14T12:00:00.000Z'
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8(JSON.stringify({
        bundle_version: 1, app_version: 'x', exported_at: ts,
        routes: [{ id: 'r1', user_id: 'local', name: 'Restored', description: '', geojson: { type: 'LineString', coordinates: [] },
          source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
          distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, tags: [], created_at: ts, updated_at: ts }],
        tracks: [], waypoints: [], photos: [], tags: [], entity_tags: [],
      })),
    })
    render(<BackupSection />)
    const input = screen.getByTestId('restore-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([zip], 'b.zip', { type: 'application/zip' })] } })
    expect(await screen.findByText(/Restore from backup\? Existing entities will be updated/)).toBeInTheDocument()
    expect(screen.getByText(/1 route/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(useRoutesStore.getState().routes.map((r) => r.name)).toEqual(['Restored']))
  })
})
```

(`vi.spyOn` on an ES module namespace works under Vitest's default module interop. If it doesn't in this setup, pass `openSaveTarget` as an optional prop defaulting to the real one, and inject the stub in the test. Note the deviation.)

`BackupSection.tsx`:

```tsx
import { useRef, useState } from 'react'
import styles from './SettingsPanel.module.css'
import { getStorage } from '../../storage/provider'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useTagsStore } from '../../store/tags'
import { backupFilename, estimateBackupBytes, writeBackup } from '../../features/backup/writeBackup'
import { fileChunks, readBackup } from '../../features/backup/readBackup'
import { prepareImport, summarizeBundle, type PreparedImport } from '../../features/backup/prepareImport'
import { openSaveTarget } from '../../features/backup/saveTarget'
import { makeThumbnail } from '../../utils/image'
import { formatBytes } from '../../utils/format'
import { debug } from '../../utils/debug'

type State =
  | { step: 'idle'; message?: string }
  | { step: 'confirm-export'; estimate: number }
  | { step: 'working'; label: string }
  | { step: 'confirm-import'; prepared: PreparedImport; filename: string }

export function BackupSection(): JSX.Element {
  const [state, setState] = useState<State>({ step: 'idle' })
  const fileRef = useRef<HTMLInputElement | null>(null)

  const askExport = () =>
    setState({
      step: 'confirm-export',
      estimate: estimateBackupBytes({
        routes: useRoutesStore.getState().routes,
        tracks: useTracksStore.getState().tracks,
        waypoints: useWaypointsStore.getState().waypoints,
        photos: usePhotosStore.getState().photos,
        tags: useTagsStore.getState().tags,
      }),
    })

  const runExport = async () => {
    const filename = backupFilename(new Date())
    try {
      // Open the save dialog first, while the click still counts as a user gesture.
      const sink = await openSaveTarget(filename)
      if (!sink) {
        setState({ step: 'idle' })
        return
      }
      setState({ step: 'working', label: 'Exporting…' })
      const manifest = await writeBackup(getStorage(), sink)
      setState({ step: 'idle', message: `Saved ${filename} (${manifest.photo_count} photos).` })
    } catch (err) {
      debug('backup export failed', err)
      setState({ step: 'idle', message: `Export failed: ${String(err)}` })
    }
  }

  const pickFile = async (file: File) => {
    setState({ step: 'working', label: 'Reading backup…' })
    try {
      const prepared = await prepareImport(await readBackup(fileChunks(file)), makeThumbnail)
      setState({ step: 'confirm-import', prepared, filename: file.name })
    } catch (err) {
      debug('backup read failed', err)
      setState({ step: 'idle', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const runImport = async (prepared: PreparedImport) => {
    setState({ step: 'working', label: 'Restoring…' })
    try {
      await getStorage().importAll(prepared.bundle, prepared.photos, prepared.thumbs)
      await Promise.all([
        useRoutesStore.getState().load(), useTracksStore.getState().load(),
        useWaypointsStore.getState().load(), usePhotosStore.getState().load(), useTagsStore.getState().load(),
      ])
      const notes = [
        prepared.regeneratedThumbs > 0 ? `${prepared.regeneratedThumbs} thumbnails rebuilt` : '',
        prepared.droppedPhotos > 0 ? `${prepared.droppedPhotos} photos skipped (image missing)` : '',
      ].filter(Boolean)
      setState({ step: 'idle', message: `Restore complete.${notes.length ? ` ${notes.join('; ')}.` : ''}` })
    } catch (err) {
      debug('backup restore failed', err)
      setState({ step: 'idle', message: `Restore failed: ${String(err)}` })
    }
  }

  return (
    <div className={styles.column}>
      {state.step === 'idle' && (
        <>
          <div className={styles.row}>
            <button type="button" onClick={askExport}>Export backup…</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          </div>
          {state.message && <p role="status" className={styles.subtle}>{state.message}</p>}
        </>
      )}
      {state.step === 'confirm-export' && (
        <div className={styles.column}>
          <p className={styles.subtle}>{`Backup will be ~${formatBytes(state.estimate)}. Continue?`}</p>
          <div className={styles.row}>
            <button type="button" onClick={() => void runExport()}>Continue</button>
            <button type="button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      {state.step === 'working' && <p role="status" className={styles.subtle}>{state.label}</p>}
      {state.step === 'confirm-import' && (
        <div className={styles.column}>
          <p className={styles.subtle}>
            {`${state.filename}: ${summarizeBundle(state.prepared.bundle)}.`}
          </p>
          <p className={styles.subtle}>
            Restore from backup? Existing entities will be updated when the backup&apos;s data is newer; new entities will be added.
          </p>
          <div className={styles.row}>
            <button type="button" onClick={() => void runImport(state.prepared)}>Restore</button>
            <button type="button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: 'none' }}
        data-testid="restore-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pickFile(file)
        }}
      />
    </div>
  )
}
```

Mount it in `SettingsPanel.tsx` as a "Backup" section after "Tags". Add a one-line note under the buttons: "Backups are your only protection if the browser clears site storage." (`styles.subtle`).

Run all → PASS.

- [x] **Step 6.4.9: Verify**

`npm run typecheck`, `npm test`, `npm run build` → green.

Browser (Chrome):
- With a few routes and photos: Export → the estimate shows → Continue → the save dialog → the ZIP is written. Open it in Explorer: `manifest.json`, `metadata.json`, `photos/{id}.jpg`, `photos/{id}_thumb.jpg`. The estimate is within ~10 % of the real size.
- Delete a route and a photo, then restore. The confirm text shows, and after restoring both are back with their thumbnails.
- Restore the same ZIP again and nothing duplicates.
- Firefox (or Chrome with `delete window.showSaveFilePicker` in DevTools first): export falls back to a normal download.

- [x] **Step 6.4.10: Docs, ticks, commit**

`ARCHITECTURE.md` › Backup Format: replace the "fflate's streaming API…" paragraph with: export builds `metadata.json` from the entity getters, reads photos one at a time, and streams through `fflate.Zip` to either a File System Access writable (Chrome/Edge) or an in-memory Blob download (others). Import streams through `fflate.Unzip` and holds the extracted entries in memory, because `importAll` takes Maps. Note that `StorageProvider.exportAll` remains for the dev console but the UI doesn't use it.

```
git add -A
git commit -m "feat(backup): streaming ZIP export and restore with thumbnail regeneration"
```

---

## Task 6.5 — PWA manifest and icons

**Files:**
- `npm install -D vite-plugin-pwa@1.3.0`
- Create: `public/icons/icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`, `ARCHITECTURE.md`

Ends with: `npm run build && npm run preview` serves an installable app (Chrome shows the install icon, and the Lighthouse/DevTools manifest pane shows no errors). After one online visit, a reload with the network offline still opens the app and its data.

- [x] **Step 6.5.1: Install**

```bash
npm install -D vite-plugin-pwa@1.3.0
```

If npm reports a peer conflict with Vite 5, stop and report. Don't force it.

- [x] **Step 6.5.2: Icon source — `public/icons/icon.svg`**

Full-bleed dark square, so it also works as a maskable icon. The glyph stays inside the central 80 % safe zone.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e1014"/>
  <path d="M96 368 L208 184 L256 248 L304 152 L416 368 Z" fill="#e6e8ec"/>
  <path d="M304 152 L284 236 L298 286 L276 368" fill="none" stroke="#e05c2a"
        stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [x] **Step 6.5.3: Render the PNGs once through Playwright**

> Done differently: Playwright's Chrome isn't installed on this machine, so the coordinator rasterised the SVG's geometry (one polygon, one round-capped polyline) with a throwaway Node script using only `node:zlib` (4×4 supersampling). Nothing was added to the repo besides the PNGs. To regenerate after changing `icon.svg`, any SVG→PNG tool works.

This uses the Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_evaluate`). **If you don't have those tools, stop after Step 6.5.2 and report.** The coordinator will render the PNGs.

1. `browser_navigate` to `about:blank`.
2. `browser_evaluate` with the SVG text inlined (read `public/icons/icon.svg` and embed it as a JS string):

```js
async () => {
  const svg = `<!-- paste icon.svg here -->`
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(svg)
  await img.decode()
  const out = {}
  for (const size of [180, 192, 512]) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    c.getContext('2d').drawImage(img, 0, 0, size, size)
    out[size] = c.toDataURL('image/png').split(',')[1]
  }
  return out
}
```

3. Write each base64 string to disk (save the returned JSON to a scratch file first, then decode it with Node):

```bash
node -e "const o=require(process.argv[1]);const fs=require('fs');fs.writeFileSync('public/icons/apple-touch-icon.png',Buffer.from(o['180'],'base64'));fs.writeFileSync('public/icons/icon-192.png',Buffer.from(o['192'],'base64'));fs.writeFileSync('public/icons/icon-512.png',Buffer.from(o['512'],'base64'))" <scratch>/icons.json
```

4. Open one PNG with the Read tool to eyeball it.

- [x] **Step 6.5.4: `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The service worker is only built for production; dev stays SW-free so
      // HMR and the storage worker never fight a stale cache.
      devOptions: { enabled: false },
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Couloir',
        short_name: 'Couloir',
        description: 'Personal backcountry ski route library',
        theme_color: '#0e1014',
        background_color: '#0e1014',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + every emitted chunk, including the storage worker and
        // the wa-sqlite .wasm. Map tiles are deliberately not cached (post-MVP).
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,webmanifest}'],
        // The main chunk is ~1.5 MB and the wasm is large; Workbox's 2 MB
        // default would silently skip them.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { port: 5173 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['wa-sqlite'] },
})
```

- [x] **Step 6.5.5: Register the service worker and add head tags**

`src/vite-env.d.ts`: add `/// <reference types="vite-plugin-pwa/client" />`.

`src/main.tsx`, inside `bootstrap()` after render:

```ts
  if (import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }
```

(A dynamic import keeps the virtual module out of the dev graph and out of Vitest, which never loads `main.tsx` anyway.)

`index.html` `<head>`:

```html
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [x] **Step 6.5.6: Verify**

`npm run typecheck`, `npm test`, `npm run build` → green. The build log lists `sw.js` and a precache count. Confirm the `.wasm` file and the storage worker chunk are included: `dist/sw.js` contains their filenames.

Browser: `npm run preview`.
- DevTools › Application › Manifest has no errors, and the icons render.
- The install icon appears in the address bar. Install it, and the app opens in its own window with the Couloir icon.
- Application › Service Workers shows it activated. Network › Offline, then reload: the app loads and the layer counts show your data. The map tiles are blank (expected).

- [x] **Step 6.5.7: Docs, ticks, commit**

`ARCHITECTURE.md` › PWA Configuration: replace the bullets with the actual setup (plugin `generateSW`, precache list including wasm and worker, no tile caching yet, SW only in production builds, icons from `public/icons/icon.svg`). Delete `public/manifest.json` from the Project Structure tree (the plugin emits `manifest.webmanifest`).

```
git add -A
git commit -m "feat(pwa): installable app with offline app shell and icons"
```

---

## Task 6.6 — Mobile layout

**Files:**
- Create: `src/hooks/useMediaQuery.ts`, `useMediaQuery.test.tsx`
- Modify: `src/store/ui.ts`, `ui.test.ts` (`setSidebarCollapsed`)
- Modify: `src/panels/Sidebar.tsx`, `Sidebar.module.css`, `Sidebar.test.tsx`
- Modify: `src/App.tsx`, `App.module.css`, `App.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.module.css`, `src/map/controls/TerrainControl.module.css`, `src/theme.css`

Breakpoint: `(max-width: 640px)`. Ends with: on a 375 px screen the map fills the viewport. The sidebar is a bottom sheet: a tab bar is always visible, and tapping a tab slides the panel up (tapping the active tab or the handle closes it). The detail panel is a bottom sheet above it. The terrain control sits above the tab bar. Nothing scrolls horizontally.

- [x] **Step 6.6.1: `useMediaQuery` — test then implement**

```tsx
import { renderHook } from '@testing-library/react'
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery'

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is false where matchMedia is unavailable (jsdom)', () => {
    expect(renderHook(() => useMediaQuery(MOBILE_QUERY)).result.current).toBe(false)
  })

  it('reflects matchMedia', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === MOBILE_QUERY, media: q,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }))
    expect(renderHook(() => useMediaQuery(MOBILE_QUERY)).result.current).toBe(true)
  })
})
```

`src/hooks/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react'

// Must match the @media breakpoint used in the CSS modules.
export const MOBILE_QUERY = '(max-width: 640px)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  )
}
```

- [x] **Step 6.6.2: `setSidebarCollapsed` in the UI store**

Add `setSidebarCollapsed: (collapsed: boolean) => void` → `set({ sidebarCollapsed: collapsed })`, plus a one-line test.

- [x] **Step 6.6.3: Sidebar behaviour — test first (`Sidebar.test.tsx`)**

```tsx
  it('clicking a tab while collapsed expands the sidebar', () => {
    act(() => useUiStore.setState({ sidebarCollapsed: true, activeTab: 'layers' }))
    render(<Sidebar panels={{ layers: <div>L</div>, search: <div>S</div> }} />)
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(useUiStore.getState()).toMatchObject({ sidebarCollapsed: false, activeTab: 'search' })
  })

  it('on mobile, tapping the active tab collapses the sheet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    act(() => useUiStore.setState({ sidebarCollapsed: false, activeTab: 'layers' }))
    render(<Sidebar panels={{ layers: <div>L</div> }} />)
    fireEvent.click(screen.getByRole('button', { name: /layers/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    vi.unstubAllGlobals()
  })
```

`Sidebar.tsx`: replace the tab `onClick` with:

```tsx
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  const onTab = (tab: SidebarTab) => {
    // Mobile bottom sheet: the active tab doubles as the close control.
    if (isMobile && !sidebarCollapsed && tab === activeTab) {
      setSidebarCollapsed(true)
      return
    }
    setActiveTab(tab)
    if (sidebarCollapsed) setSidebarCollapsed(false)
  }
```

Also add `data-mobile={isMobile ? 'true' : 'false'}` to the `<aside>`. The CSS uses media queries, so this attribute is only a test hook.

- [x] **Step 6.6.4: Bottom-sheet CSS**

`src/theme.css` `:root`: `--mobile-tabbar-h: 56px;`

Append to `Sidebar.module.css`:

```css
@media (max-width: 640px) {
  .sidebar,
  .sidebar[data-collapsed='true'] {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    min-width: 0;
    max-height: 65vh;
    border-right: none;
    border-top: 1px solid var(--color-border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    z-index: 45;
    /* Tab bar last, so the content sits above it like a sheet. */
    flex-direction: column-reverse;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .tabs {
    flex-direction: row;
    justify-content: space-around;
    height: var(--mobile-tabbar-h);
    padding: var(--space-xs);
  }

  .tabButton {
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: var(--space-xs);
    font-size: 11px;
  }

  .sidebar[data-collapsed='true'] .tabLabel {
    display: inline;
  }

  .content {
    border-top: none;
    border-bottom: 1px solid var(--color-border);
    animation: sheet-up 160ms ease-out;
  }

  /* The desktop collapse chevron has no role in the sheet; tabs toggle it. */
  .collapseButton {
    display: none;
  }
}

@keyframes sheet-up {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
```

Append to `App.module.css`:

```css
@media (max-width: 640px) {
  /* The sidebar is a fixed overlay on mobile, so the map takes the whole screen. */
  .mapArea {
    height: 100%;
  }

  .toast {
    bottom: calc(var(--mobile-tabbar-h) + var(--space-md));
    max-width: calc(100% - 2 * var(--space-md));
  }
}
```

Append to `DetailPanel.module.css`:

```css
@media (max-width: 640px) {
  .panel {
    position: fixed;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 70vh;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    padding: var(--space-md) var(--space-md) calc(var(--space-md) + env(safe-area-inset-bottom));
    z-index: 50;
    animation: sheet-up 160ms ease-out;
  }
}

@keyframes sheet-up {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
```

Append to `TerrainControl.module.css`:

```css
@media (max-width: 640px) {
  .control {
    bottom: calc(var(--mobile-tabbar-h) + var(--space-md));
  }
}
```

Check `BasemapControl` (top-right) against MapLibre's NavigationControl (top-left) at 375 px. If they collide, shrink `.button` padding inside the same media query. Also add `overflow: hidden` to `html, body` in `theme.css` (the app is a fixed-viewport map; nothing should scroll the page).

- [x] **Step 6.6.5: App-level mobile effects — test first (`App.test.tsx`)**

```tsx
  it('on mobile, opening the detail panel closes the sidebar sheet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    act(() => useUiStore.setState({ sidebarCollapsed: false, panel: { mode: 'idle' } }))
    render(<App />)
    act(() => useUiStore.getState().openEntity('route', 'r1'))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    vi.unstubAllGlobals()
  })

  it('on mobile, the sheet starts closed', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    act(() => useUiStore.setState({ sidebarCollapsed: false }))
    render(<App />)
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    vi.unstubAllGlobals()
  })
```

`App.tsx`:

```tsx
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const panelOpen = useUiStore((s) => s.panel.mode !== 'idle')
  const placementActive = useUiStore((s) => s.placement.mode !== 'idle')
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  // Phone: start with the sheet closed so the map is unobstructed, and close
  // it whenever the detail sheet opens or placement starts, so sheets never
  // stack and the placement banner and map stay clear.
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true)
  }, [isMobile, setSidebarCollapsed])
  useEffect(() => {
    if (isMobile && (panelOpen || placementActive)) setSidebarCollapsed(true)
  }, [isMobile, panelOpen, placementActive, setSidebarCollapsed])
```

Placement on mobile works as is: tapping the map is a click. The photo cursor preview never shows because there is no mousemove, and that's fine.

- [x] **Step 6.6.6: Verify**

`npm run typecheck`, `npm test` → green.

Browser at 375×667 (DevTools device mode, or Playwright `browser_resize` + `browser_take_screenshot`):
- The map fills the screen, and the tab bar sits at the bottom.
- Tap Layers: the sheet slides up. Tap Layers again: it closes.
- Tap a route on the map: the detail sheet rises and the layer sheet closes.
- Add Waypoint: the sheet closes, the banner shows, and tapping the map opens the create sheet.
- The terrain control isn't covered by the tab bar.
- Nothing scrolls horizontally (`document.documentElement.scrollWidth === 375`).
- Desktop width is unchanged.

- [x] **Step 6.6.7: Ticks, commit**

```
git add -A
git commit -m "feat(mobile): bottom-sheet sidebar and detail panel on narrow screens"
```

---

## Task 6.7 — Empty states and onboarding

**Files:**
- Modify: `src/panels/LayerPanel/LayerPanel.tsx`, `LayerPanel.module.css`, `LayerPanel.test.tsx`
- Create: `src/panels/Welcome/WelcomeScreen.tsx`, `WelcomeScreen.module.css`, `WelcomeScreen.test.tsx`
- Modify: `src/map/MapView.tsx`, `MapView.module.css`, `MapView.test.tsx`

Ends with: each layer row with a count of 0 shows a one-line hint. A first launch without an API key shows a welcome overlay with two numbered steps: an inline key form and a link to sign up, then "import your first GPX". Saving the key dismisses it, and the map loads.

- [x] **Step 6.7.1: Layer empty hints — test first**

```tsx
  it('shows a hint under empty layers', () => {
    act(() => {
      useRoutesStore.setState({ routes: [] })
      useWaypointsStore.setState({ waypoints: [] })
    })
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    expect(screen.getByText('Import a GPX route to get started.')).toBeInTheDocument()
    expect(screen.getByText('Use Add Waypoint, then click the map.')).toBeInTheDocument()
  })

  it('hides the hint once the layer has data', () => {
    act(() => useRoutesStore.setState({ routes: [fakeRoute('r1')] }))
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    expect(screen.queryByText('Import a GPX route to get started.')).toBeNull()
  })
```

`LayerPanel.tsx`:

```tsx
const EMPTY_HINTS: Record<LayerKey, string> = {
  routes: 'Import a GPX route to get started.',
  tracks: 'Import a recorded GPX track.',
  waypoints: 'Use Add Waypoint, then click the map.',
  photos: 'Use Add Photo to pin a recon photo.',
}
```

Inside each `<li>`, after the switch: `{counts[row.key] === 0 && <span className={styles.hint}>{EMPTY_HINTS[row.key]}</span>}`.

CSS:

```css
.hint {
  grid-column: 1 / -1;
  color: var(--color-text-dim);
  font-size: 12px;
}
```

- [x] **Step 6.7.2: `WelcomeScreen` — test first**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'
import { useSettingsStore } from '../../store/settings'

describe('WelcomeScreen', () => {
  it('walks through the two steps and links to Maptiler signup', () => {
    render(<WelcomeScreen />)
    expect(screen.getByRole('heading', { name: 'Welcome to Couloir' })).toBeInTheDocument()
    expect(screen.getByText(/import your first gpx/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /free maptiler account/i })).toHaveAttribute('href', expect.stringContaining('maptiler.com'))
  })

  it('saves the key, trimmed of whitespace', () => {
    const set = vi.spyOn(useSettingsStore.getState(), 'setMaptilerKey')
    render(<WelcomeScreen />)
    fireEvent.change(screen.getByLabelText('Maptiler API key'), { target: { value: ' abc 123 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
    expect(set).toHaveBeenCalledWith('abc123')
  })
})
```

(If spying on the store action doesn't intercept, because the component captured it via a selector, assert `useSettingsStore.getState().maptilerKey === 'abc123'` instead, and reset it in `afterEach`.)

`WelcomeScreen.module.css`:

```css
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-lg);
  background: var(--color-bg-0);
  overflow-y: auto;
}

.card {
  width: min(440px, 100%);
  background: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.card h2 {
  margin: 0;
  font-size: 20px;
}

.steps {
  margin: 0;
  padding-left: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.step {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.row {
  display: flex;
  gap: var(--space-sm);
}

.row input {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  color: var(--color-text);
  font: inherit;
}

.subtle {
  color: var(--color-text-dim);
  font-size: 13px;
}
```

`WelcomeScreen.tsx`:

```tsx
import { useState } from 'react'
import styles from './WelcomeScreen.module.css'
import { useSettingsStore } from '../../store/settings'

const MAPTILER_SIGNUP_URL = 'https://cloud.maptiler.com/account/keys/'

// First-run overlay shown in place of the map until a Maptiler key exists.
export function WelcomeScreen(): JSX.Element {
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const [key, setKey] = useState('')

  const save = () => {
    const trimmed = key.replace(/\s/g, '')
    if (trimmed) setMaptilerKey(trimmed)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2>Welcome to Couloir</h2>
        <p className={styles.subtle}>Your private library of backcountry routes, tracks, waypoints and recon photos.</p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <strong>Add a Maptiler API key</strong>
            <span className={styles.subtle}>Couloir uses Maptiler for 3D terrain and basemaps. The free tier is plenty.</span>
            <div className={styles.row}>
              <input
                aria-label="Maptiler API key"
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save() }}
              />
              <button type="button" onClick={save}>Save key</button>
            </div>
            <a href={MAPTILER_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className={styles.subtle}>
              Create a free Maptiler account →
            </a>
          </li>
          <li className={styles.step}>
            <strong>Import your first GPX</strong>
            <span className={styles.subtle}>
              Once the map loads, use Import GPX in the Layers panel, or drop a .gpx file onto the map.
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
```

- [x] **Step 6.7.3: Use it in `MapView`**

Replace the `if (!maptilerKey) return (<div className={styles.empty}>…</div>)` block with `if (!maptilerKey) return <WelcomeScreen />`. Delete the now-unused `.empty` rule from `MapView.module.css`. Update `MapView.test.tsx`: the no-key test now asserts the "Welcome to Couloir" heading, and a new test asserts that setting the key (`act(() => useSettingsStore.getState().setMaptilerKey('k'))`) removes it.

- [x] **Step 6.7.4: Verify**

`npm run typecheck`, `npm test` → green.

Browser: in DevTools run `localStorage.removeItem('couloir_maptiler_key')` and reload. The welcome screen shows. Paste the key and save: the map loads in 3D, and the welcome screen is gone after a reload. With an empty database (or a fresh profile), each layer row shows its hint.

- [x] **Step 6.7.5: Ticks, commit**

```
git add -A
git commit -m "feat(onboarding): welcome screen and empty-layer hints"
```

---

## Task 6.8 — Final QA pass

This task is run with the user (who has the Maptiler key and real data), and Playwright can be used where it helps. Each defect found gets its own test-first fix and commit. Nothing here is pre-written code.

- [x] **Step 6.8.1: Run the TASKS.md 6.8 script end to end** on a production build (`npm run build && npm run preview`) in a fresh browser profile. Record each step's result in a scratch checklist. Watch the console the whole time: any error or unhandled rejection is a defect.

1. Fresh install shows the welcome screen.
2. Enter the API key and the map loads in 3D.
3. Import a GPX route: it appears, the detail panel opens, and the elevation profile renders.
4. Import a GPX track: it uses the track style.
5. Add a waypoint by clicking: the form opens and the icon is correct.
6. Add a photo: it's pinned, the thumbnail is on the map, and the viewer opens on click.
7. Create a tag and apply it to a route and a photo.
8. Filter Routes by that tag: only the tagged route shows.
9. Search the route by name: clicking the result flies there.
10. Export: the ZIP contains manifest, metadata, photos and thumbnails.
11. Delete all data (Application › Storage › Clear site data, then add the key again), import the ZIP, and everything is restored.
12. Terrain off and on.
13. All three basemaps load without errors.
14. Resize to 375 px: the layout adapts.

Also run the outstanding Phase 5 checks: cluster counts with `__couloir.createDummyPhotos(120)` (dev build), and `inspectPhotoExif` returning `undefined`.

- [x] **Step 6.8.2: Fix defects.** One commit per fix, each with a regression test where the logic is testable.
- [x] **Step 6.8.3: Final gates.** `npm run typecheck`, `npm test` and `npm run build` are green, and there's no `console.log` in `src/` outside `debug.ts` (`grep -rn "console\.log" src --include=*.ts --include=*.tsx`).
- [x] **Step 6.8.4: Docs.** Tick 6.8 in TASKS.md. Update the "Current Phase" note in AGENTS.md if needed (the MVP is complete; next work comes from the Post-MVP Backlog).

```
git commit -am "chore: phase 6 QA complete; MVP done"
```

---

## Self-review

| TASKS.md acceptance criterion | Where |
|---|---|
| Tags created, renamed, deleted from Settings; invalid hex rejected; confirm before deleting an in-use tag | 6.1 `TagManager` + `validateTagInput` (tested) |
| Deleting a tag removes `entity_tags` rows (verified by re-reading entities) | 6.1 `deleteTag.test.ts` re-reads from storage |
| Tag colours render as pills throughout | 6.1 `TagPill` used by `TagPills`, `TagPicker`; readable text colour |
| *(Added)* tags can be assigned to every entity type | 6.1 `TagPicker` in all edit forms + waypoint/photo create |
| Filter shows/hides; OR logic; clear restores; independent per layer | 6.2 `filterByTags` (tested), `ui.tagFilters` (tested), `TagFilterMenu` (tested via LayerPanel) |
| Search across all types, grouped, click centres the map, empty state | 6.3 `searchEntities` (tested), `flyToEntity` (tested), `SearchPanel` (tested) |
| Export ZIP contents; size estimate; import restores; idempotent; missing thumbnails regenerated; confirm before applying | 6.4 `backup.test.ts` round-trip / idempotence / thumbnail regeneration / version check; `BackupSection.test.tsx` confirmations |
| Installable; icon on home screen; loads offline | 6.5 (browser-verified) |
| Usable at 375 px; bottom sheets; map unobstructed; no horizontal scroll | 6.6 (logic tested; layout browser-verified) |
| Empty-state hints; welcome on first launch only | 6.7 (tested) |
| End-to-end QA | 6.8 |

**Type consistency:** `LayerKey` drives `tagFilters`, the `TagFilterMenu` prop and `SearchPanel`'s group→layer map. `EntityType` keys `SearchResults`. `BackupSink` is shared by `writeBackup` and `openSaveTarget`. `ParsedBackup` → `prepareImport` → `PreparedImport` → `importAll`. `BUNDLE_VERSION` is the single source for writers (the `exportAll` implementations and `writeBackup`) and the reader check.

**Risks:**
- `vite-plugin-pwa` 1.3.0 peer range vs Vite 5: verified at install time (6.5.1).
- Workbox skipping large files: `maximumFileSizeToCacheInBytes` is raised, and 6.5.6 checks that the wasm and worker are in `sw.js`.
- `showSaveFilePicker` typing gaps in TS 5.6: an ambient file adds only what's missing.
- Search hits in a tag-filtered-out layer open but don't render. This is documented in ARCHITECTURE.md (6.3.5).
- Import holds all extracted photos in memory (the `importAll` signature takes Maps). Acceptable at personal scale. A streaming import would need an interface change and is out of scope.
