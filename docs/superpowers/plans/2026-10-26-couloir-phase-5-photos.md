# Couloir Phase 5 — Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a JPEG/PNG, read its EXIF, re-encode it without metadata, pin it on the map **where it was taken**, fill in a creation form, and save the photo and its thumbnail to OPFS. Saved photos render as framed thumbnails that cluster at low zoom. Clicking one opens a viewer with the full image, metadata, edit and delete.

**Design decisions taken in planning (2026-10-26)** — these override the original `SPEC.md` / `TASKS.md` wording, and Task 5.0 updates those docs:

1. **One position per photo, the camera position.** The subject/camera split is removed. `lat`/`lng`/`elevation_m` now mean "where the photo was taken". Migration `2.sql` copies any `camera_*` values into `lat`/`lng`/`elevation_m` and drops the `camera_*` columns. `bearing` stays, so a future direction arrow on the pin has its data.
2. **Bearing comes from EXIF `GPSImgDirection` when present.** iPhones usually write it; many Android phones and standalone cameras don't. The form prefills it when available and accepts manual input otherwise. A compass rose shows the value, and clicking the rose sets it.
3. **The pin can be dragged in create and edit modes only.** While a photo's panel is in `create` or `edit`, a draggable `maplibregl.Marker` sits at the draft position, and edit mode also takes typed lat/lng. In view mode the position is locked. Thumbnails in the clustered layer can be clicked but not dragged.
4. **Stored full-size JPEG is capped at 4096 px on the longest edge**, at quality 0.9 (`PHOTO_MAX_EDGE_PX`, `PHOTO_JPEG_QUALITY`).
5. **New `StorageProvider.updatePhotoMetadata(photo)`.** It rewrites only the row and tags. `usePhotosStore.update()` stops re-reading and re-writing the blobs.
6. **New dependency: `exifr@7.1.3`.** It's MIT-licensed with zero runtime dependencies, and ARCHITECTURE.md already names it. The user approved adding it on 2026-10-26.

**Architecture:** The pending photo (re-encoded blob, thumbnail, preview URL, dimensions, EXIF) lives in the UI store as a typed `PendingPhoto`. `startPhotoPlacement(pending)` puts it in `placement.photo`. `completePlacement(lat, lng)` moves it onto a new `panel.create` photo variant (`{ entityType: 'photo'; draft; pending }`), so the blob survives the placement→create transition. That resolves the Phase 2 FIXME. The UI store owns the preview object URL and revokes it on whichever transition drops the last reference.

The import pipeline is a dependency-injected orchestrator (`importPhotoFile`), shaped like `gpxImport`, so it can be unit-tested without canvas or EXIF fixtures. With EXIF GPS, it flies the map and immediately calls `completePlacement`. Without GPS, placement mode stays active: the photo's thumbnail follows the cursor, and the existing `usePlacementMapBinding` click calls `completePlacement`.

`PhotosLayer` follows the existing layer shape: a pure GeoJSON builder plus a thin component. It adds a clustered GeoJSON source and three layers. Thumbnail icons are decoded from OPFS on demand, framed on a canvas, cached in a ref (so a basemap swap re-registers them without another OPFS read), and registered with `map.addImage`. Until a thumbnail's icon is ready, a placeholder tile is shown through a `coalesce` image expression.

The detail panel gets `PhotoCreate` and `PhotoDetail` (view + edit). Their form fields are shared in `PhotoFields` and `PhotoPositionFields`, with pure parsing in `photoForm.ts`.

**Tech Stack:** `exifr` (new), browser `createImageBitmap` + 2D canvas for re-encoding and icon framing, MapLibre clustered GeoJSON source + `maplibregl.Marker`, Vitest + React Testing Library.

**Spec references:** `SPEC.md` (Photo concept, Photos feature), `ARCHITECTURE.md` (Photo Import Pipeline, Map Layer Architecture, Panel and placement state, Photo Storage Detail), `DATA-MODEL.md` (`Photo`, `photos` table, `PHOTO_CLUSTER`), `TASKS.md` Tasks 5.0–5.5.

**Out of scope for this phase:**
- Direction arrow / bearing cone on the map pin (future; the bearing data is captured now).
- Tag editing (Phase 6.1). Forms render read-only `TagPills`, as in Phase 4.
- ZIP import/export (Phase 6.4). No backup bundles exist yet, so the Photo shape change needs no `bundle_version` bump.
- Dropping image files onto the map. `FileDropzone` stays GPX-only.
- Multi-file photo import. One photo per Add Photo click.
- Re-querying terrain elevation when the pin is dragged. Elevation autofills once, when the field is blank.

---

## File Structure

```
couloir/
├── package.json                                         Task 5.0 (+ exifr)
├── SPEC.md, DATA-MODEL.md, ARCHITECTURE.md, AGENTS.md   Task 5.0 (single-position model, updatePhotoMetadata)
├── TASKS.md                                             Task 5.0 (rewrite Phase 5 task text), each task (tick)
├── src/
│   ├── theme.css                                        Task 5.1 (--color-photo-frame)
│   ├── types/index.ts                                   Task 5.0 (Photo, PhotoMetadataPatch), 5.1 (PhotoExif, PendingPhoto, PHOTO_* consts)
│   ├── storage/
│   │   ├── interface.ts                                 Task 5.0 (+ updatePhotoMetadata)
│   │   ├── memory.ts / memory.test.ts                   Task 5.0
│   │   ├── opfs.ts                                      Task 5.0 (row mapping, updatePhotoMetadata)
│   │   └── migrations/
│   │       ├── 2.sql                                    Task 5.0
│   │       ├── index.ts                                 Task 5.0 (SCHEMA_VERSION = 2)
│   │       └── index.test.ts                            Task 5.0
│   ├── store/
│   │   ├── photos.ts / photos.test.ts                   Task 5.0 (update → updatePhotoMetadata)
│   │   └── ui.ts / ui.test.ts                           Task 5.1 (PendingPhoto, create-photo variant, preview revocation, draftNumber)
│   ├── dev/devConsole.ts                                Task 5.0 (fields, createDummyPhotos), 5.2 (inspectPhotoExif)
│   ├── test/
│   │   ├── setup.ts                                     Task 5.1 (object-URL stand-ins)
│   │   └── mocks/maplibre-gl.ts                         Task 5.1 (Marker, getZoom, easeTo, queryTerrainElevation, removeImage)
│   ├── utils/
│   │   ├── exif.ts / exif.test.ts                       Task 5.1
│   │   ├── image.ts / image.test.ts                     Task 5.1
│   │   ├── geo.ts / geo.test.ts                         Task 5.1 (normalizeBearing), 5.2 (bearingFromVector)
│   │   ├── time.ts / time.test.ts                       Task 5.2 (datetime-local helpers)
│   │   └── format.ts / format.test.ts                   Task 5.4 (formatBearing, formatDateTime)
│   ├── hooks/
│   │   ├── useMap.ts                                    Task 5.1 (+ getMap)
│   │   ├── useObjectUrl.ts / useObjectUrl.test.tsx      Task 5.2
│   │   └── usePhotoBlobUrl.ts / usePhotoBlobUrl.test.tsx Task 5.4
│   ├── features/
│   │   ├── import/importToast.ts                        Task 5.1 (+ showToast)
│   │   └── photos/
│   │       ├── photoImport.ts / photoImport.test.ts     Task 5.1
│   │       └── AddPhotoButton.tsx                       Task 5.1
│   ├── components/CompassRose/
│   │   ├── CompassRose.tsx / .module.css / .test.tsx    Task 5.2
│   ├── map/
│   │   ├── MapView.tsx                                  Tasks 5.1, 5.2, 5.3 (mount hooks/components)
│   │   ├── terrain.ts / terrain.test.ts                 Task 5.2 (queryElevation, shared with WaypointCreate)
│   │   ├── placement/
│   │   │   ├── photoCursorPreview.ts / .test.ts         Task 5.1
│   │   │   ├── PhotoCursorPreview.module.css            Task 5.1
│   │   │   └── PhotoPositionMarker.tsx / .test.tsx      Task 5.2
│   │   └── layers/
│   │       ├── layerStyles.ts                           Tasks 5.2 (PHOTO_PIN_COLOR), 5.3
│   │       ├── wpIcons.ts                               Task 5.3 (export makeEmptyImageData)
│   │       ├── photosLayerData.ts / .test.ts            Task 5.3
│   │       ├── photoIcons.ts / .test.ts                 Task 5.3
│   │       └── PhotosLayer.tsx / PhotosLayer.test.tsx   Task 5.3
│   └── panels/
│       ├── PlacementBanner/PlacementBanner.tsx / .test  Task 5.1 (photo branch)
│       ├── LayerPanel/LayerPanel.tsx / .test            Tasks 5.1 (Add Photo), 5.5 (count)
│       └── DetailPanel/
│           ├── DetailPanel.tsx                          Tasks 5.2, 5.4 (routing)
│           ├── DetailPanel.shared.module.css            Tasks 5.2, 5.4 (photo preview/frame)
│           ├── photoForm.ts / photoForm.test.ts         Task 5.2
│           ├── PhotoFields.tsx                          Task 5.2
│           ├── PhotoPositionFields.tsx                  Task 5.2
│           ├── PhotoCreate.tsx / PhotoCreate.test.tsx   Task 5.2
│           ├── WaypointCreate.tsx                       Task 5.2 (use queryElevation)
│           └── PhotoDetail.tsx / PhotoDetail.test.tsx   Task 5.4
```

**Test conventions** (carried forward from Phase 4):
- Vitest globals are enabled, so test files don't import `describe`/`it`/`expect`/`vi`.
- `InMemoryStorageProvider` backs the storage layer in tests (`setStorage` / `clearStorage`).
- jsdom has no canvas, `createImageBitmap`, or MapLibre rendering. Canvas and EXIF code is split so the pure parts (size math, EXIF normalisation, crop math, orchestration) are unit-tested, and the canvas/exifr calls are thin wrappers verified in the browser.
- If `npm test` hangs on Windows: `npx vitest run --pool=forks --poolOptions.forks.singleFork=true`.

**Branch:** before Step 5.0.1, create `phase-5-photos` from `main` (PowerShell: `git switch -c phase-5-photos`). All `git` commands in this plan run through the PowerShell tool (see AGENTS.md › Tooling).

---

## Task 5.0 — Photo model simplification and storage prep

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `src/storage/migrations/2.sql`
- Modify: `src/storage/migrations/index.ts`
- Create: `src/storage/migrations/index.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/storage/interface.ts`, `src/storage/memory.ts`, `src/storage/opfs.ts`
- Modify: `src/storage/memory.test.ts`, `src/store/photos.ts`, `src/store/photos.test.ts`
- Modify: `src/dev/devConsole.ts`
- Modify: `SPEC.md`, `DATA-MODEL.md`, `ARCHITECTURE.md`, `AGENTS.md`, `TASKS.md`

This task ends with: `exifr` installed; `Photo` has no `camera_*` fields; the DB migrates to v2; `updatePhotoMetadata` exists on both providers; `usePhotosStore.update()` no longer touches blobs; docs describe the single-position model. `npm test` and `npm run typecheck` pass.

- [x] **Step 5.0.1: Install exifr**

```bash
npm install exifr@7.1.3
```

Expected: `package.json` gains `"exifr": "^7.1.3"` under `dependencies`. No other dependency changes.

- [x] **Step 5.0.2: Write the failing migration test — `src/storage/migrations/index.test.ts`**

```ts
import { MIGRATIONS, SCHEMA_VERSION } from './index'

describe('MIGRATIONS', () => {
  it('is contiguous from 1 and ends at SCHEMA_VERSION', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1),
    )
  })

  it('migration 2 moves camera_* into lat/lng/elevation_m and drops the columns', () => {
    const sql = MIGRATIONS.find((m) => m.version === 2)?.sql ?? ''
    expect(sql).toMatch(/SET\s+lat\s*=\s*camera_lat/i)
    for (const col of ['camera_lat', 'camera_lng', 'camera_elevation_m']) {
      expect(sql).toMatch(new RegExp(`DROP COLUMN ${col}\\b`, 'i'))
    }
  })
})
```

Run: `npm test -- src/storage/migrations/index.test.ts`. Expected: FAIL, because there's no version 2.

- [x] **Step 5.0.3: Create `src/storage/migrations/2.sql`**

The bundled SQLite is 3.44, and `ALTER TABLE … DROP COLUMN` needs 3.35+. The runner wraps the file in one transaction.

```sql
-- Migration 2: a photo has one position — where it was taken.
-- Rows that carried an EXIF camera position adopt it; rows without one keep
-- their user-placed lat/lng. elevation_m follows the position it describes.
UPDATE photos
   SET lat         = camera_lat,
       lng         = camera_lng,
       elevation_m = camera_elevation_m
 WHERE camera_lat IS NOT NULL
   AND camera_lng IS NOT NULL;

ALTER TABLE photos DROP COLUMN camera_lat;
ALTER TABLE photos DROP COLUMN camera_lng;
ALTER TABLE photos DROP COLUMN camera_elevation_m;
```

- [x] **Step 5.0.4: Register it in `src/storage/migrations/index.ts`**

```ts
import sql1 from './1.sql?raw'
import sql2 from './2.sql?raw'

export const SCHEMA_VERSION = 2

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: sql1 },
  { version: 2, sql: sql2 },
]
```

Run the test from 5.0.2. Expected: PASS.

- [x] **Step 5.0.5: Update the `Photo` type in `src/types/index.ts`**

Replace the `Photo` interface with:

```ts
export interface Photo {
  id: string
  user_id: string
  name: string
  description: string

  // Where the photo was taken. Seeded from EXIF GPS when present, otherwise
  // placed by the user; draggable while the photo is being created or edited.
  lat: number
  lng: number
  elevation_m: number | null            // EXIF GPSAltitude, else terrain lookup
  bearing: number | null                // 0-359, compass direction the camera faced

  blob_ref: string                      // 'photos/{id}.jpg'
  width: number
  height: number
  file_size_bytes: number
  taken_at: string | null

  tags: string[]
  created_at: string
  updated_at: string
}

// Fields a photo edit may change. File metadata (blob_ref, dimensions, size)
// is fixed at import.
export type PhotoMetadataPatch = Partial<Pick<
  Photo,
  'name' | 'description' | 'lat' | 'lng' | 'elevation_m' | 'bearing' | 'taken_at' | 'tags'
>>
```

Run `npm run typecheck`. Expected: errors in `opfs.ts`, `devConsole.ts`, `memory.test.ts`, `photos.test.ts` (the remaining `camera_*` references). The next steps fix them.

- [x] **Step 5.0.6: Add `updatePhotoMetadata` to `src/storage/interface.ts`**

In the Photos block, after `savePhoto`:

```ts
  /** Rewrite a photo's metadata row and tags. Blobs are untouched. Throws if the photo doesn't exist. */
  updatePhotoMetadata(photo: Photo): Promise<void>
```

- [x] **Step 5.0.7: Write failing provider tests in `src/storage/memory.test.ts`**

1. In the photo fixture near line 228, delete the three `camera_*` lines.
2. Replace the test `'preserves all camera_* fields including null values'` (near line 306) with:

```ts
  it('preserves null elevation_m and bearing', async () => {
    await storage.savePhoto(
      { ...samplePhoto, elevation_m: null, bearing: null },
      new Blob(['x']), new Blob(['y']),
    )
    const fetched = await storage.getPhoto(samplePhoto.id)
    expect(fetched?.elevation_m).toBeNull()
    expect(fetched?.bearing).toBeNull()
  })
```

(Use the fixture variable name that the surrounding photo tests already use. `samplePhoto` above stands in for it.)

3. Add a `describe('updatePhotoMetadata', …)` block next to the other photo tests:

```ts
  describe('updatePhotoMetadata', () => {
    it('rewrites the row and tags but keeps the stored blobs', async () => {
      const blob = new Blob(['full'])
      const thumb = new Blob(['thumb'])
      await storage.savePhoto(samplePhoto, blob, thumb)
      await storage.saveTag({ id: 't1', name: 'Recon', color: '#888888', created_at: samplePhoto.created_at })

      await storage.updatePhotoMetadata({ ...samplePhoto, name: 'Renamed', lat: 49.6, tags: ['t1'] })

      const fetched = await storage.getPhoto(samplePhoto.id)
      expect(fetched?.name).toBe('Renamed')
      expect(fetched?.lat).toBe(49.6)
      expect(fetched?.tags).toEqual(['t1'])
      expect(await storage.getPhotoBlob(samplePhoto.id)).toBe(blob)
      expect(await storage.getPhotoThumb(samplePhoto.id)).toBe(thumb)
    })

    it('throws when the photo does not exist', async () => {
      await expect(storage.updatePhotoMetadata(samplePhoto)).rejects.toThrow(/not found/)
    })
  })
```

Run: `npm test -- src/storage/memory.test.ts`. Expected: FAIL, because `updatePhotoMetadata` isn't implemented.

- [x] **Step 5.0.8: Implement in `src/storage/memory.ts`**

After `savePhoto`:

```ts
  async updatePhotoMetadata(photo: Photo): Promise<void> {
    if (!this.photos.has(photo.id)) throw new Error(`photo ${photo.id} not found`)
    this.photos.set(photo.id, JSON.parse(JSON.stringify(photo)) as Photo)
    this.replaceEntityTags('photo', photo.id, photo.tags)
  }
```

Run the memory tests. Expected: PASS.

- [x] **Step 5.0.9: Update `src/storage/opfs.ts`**

1. In `savePhoto`, replace the INSERT with the 15-column version:

```ts
          sql: `INSERT OR REPLACE INTO photos (
                  id, user_id, name, description,
                  lat, lng, elevation_m, bearing,
                  blob_ref,
                  width, height, file_size_bytes,
                  taken_at,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
```

2. Add `updatePhotoMetadata` after `savePhoto`:

```ts
  async updatePhotoMetadata(photo: Photo): Promise<void> {
    const existing = await this.client.one(`SELECT id FROM photos WHERE id = ?`, [photo.id])
    if (!existing) throw new Error(`photo ${photo.id} not found`)
    // Only user-editable columns. blob_ref / dimensions / size are fixed at
    // import, so the OPFS files are never rewritten on a metadata edit.
    await this.client.tx([
      {
        sql: `UPDATE photos
                 SET name = ?, description = ?,
                     lat = ?, lng = ?, elevation_m = ?, bearing = ?,
                     taken_at = ?, updated_at = ?
               WHERE id = ?`,
        params: [
          photo.name, photo.description,
          photo.lat, photo.lng, photo.elevation_m, photo.bearing,
          photo.taken_at, photo.updated_at,
          photo.id,
        ],
      },
      ...this.replaceTagsOps('photo', photo.id, photo.tags),
    ])
  }
```

3. `photoToRow`: replace the position line pair with `p.lat, p.lng, p.elevation_m, p.bearing,`, which removes the `camera_*` line.
4. `rowToPhoto`: delete the three `camera_*` properties.

- [x] **Step 5.0.10: Switch `usePhotosStore.update` to the metadata path — test first**

In `src/store/photos.test.ts`, remove the three `camera_*` lines from `baseInput`, then add:

```ts
  it('update() writes metadata only — blobs are not re-read or re-written', async () => {
    const p = await usePhotosStore.getState().add(baseInput, new Blob(['x']), new Blob(['y']))
    const storage = getStorage()
    const saveSpy = vi.spyOn(storage, 'savePhoto')
    const blobSpy = vi.spyOn(storage, 'getPhotoBlob')
    await usePhotosStore.getState().update(p.id, { lat: 49.7, bearing: 200 })
    expect(saveSpy).not.toHaveBeenCalled()
    expect(blobSpy).not.toHaveBeenCalled()
    expect((await storage.getPhoto(p.id))?.lat).toBe(49.7)
  })
```

(Import `getStorage` from `'../storage/provider'`.) Run it. Expected: FAIL.

Then in `src/store/photos.ts`:

```ts
import type { Photo, PhotoMetadataPatch } from '../types'
// ...
  update: (id: string, patch: PhotoMetadataPatch) => Promise<Photo>
// ...
  update: async (id, patch) => {
    const existing = get().photos.find((p) => p.id === id)
    if (!existing) throw new Error(`photo ${id} not found`)
    const updated: Photo = { ...existing, ...patch, updated_at: now() }
    await getStorage().updatePhotoMetadata(updated)
    set((s) => ({ photos: s.photos.map((p) => (p.id === id ? updated : p)) }))
    return updated
  },
```

Delete the old "Re-save with the same blob" comment. Run the photos tests. Expected: PASS.

- [x] **Step 5.0.11: Update `src/dev/devConsole.ts`**

1. In `createDummyPhoto`, delete the three `camera_*` properties.
2. Add a bulk helper for the Task 5.3 performance check, next to `createDummyPhoto`:

```ts
    // Scatters `count` dummy photos within ~±0.15° of `center` (default
    // Fernie). Reload the page afterwards: this writes through storage, not
    // the Zustand slices.
    async createDummyPhotos(count = 120, center: [number, number] = [-115.06, 49.5]): Promise<number> {
      for (let i = 0; i < count; i++) {
        const p = await helper.createDummyPhoto(`Dummy Photo ${i + 1}`)
        await storage.savePhoto(
          {
            ...p,
            lng: center[0] + (Math.random() - 0.5) * 0.3,
            lat: center[1] + (Math.random() - 0.5) * 0.3,
          },
          (await storage.getPhotoBlob(p.id))!,
          (await storage.getPhotoThumb(p.id))!,
        )
      }
      return count
    },
```

(`helper` is the object literal `installDevConsole` builds and assigns to `window.__couloir`.)

- [x] **Step 5.0.12: Update the docs**

`SPEC.md`:
- **Core Concepts › Photo**: replace the paragraph with: "A geolocated photograph for recon photography: photos taken from across the valley looking at potential ski lines, used for navigation and route assessment. A photo is pinned to the map **where it was taken**: from EXIF GPS when present, otherwise placed by the user. It can be repositioned while being created or edited. Has name, description, bearing (the compass direction the camera faced, prefilled from EXIF `GPSImgDirection` when present), elevation, capture date, and tags. Photos relate to nearby routes, tracks, and waypoints by spatial proximity on the map; there are no explicit links."
- **Feature Set › Photos**: replace the "Subject pin placement" and "camera position" bullets with:
  - "Placement: if the photo has EXIF GPS, the map flies there and the pin is dropped at that position. Without EXIF GPS, the photo's thumbnail follows the cursor and the user clicks the map where the photo was taken."
  - "The pin is draggable while the photo is being created or edited; coordinates can also be typed in edit mode. In view mode the position is locked."
  - Change "Thumbnail visible as a map pin at the subject location" to "…at the photo's location", and "reposition pin (drag subject pin on the map, or edit camera position fields directly)" to "reposition the pin (drag it in edit mode, or type coordinates)".
- **Future Considerations**: change "Bearing cone visualization on photo pins (FOV footprint on map)" to "Direction arrow / bearing cone on photo pins (from the stored `bearing`)".

`DATA-MODEL.md`:
- Replace the `Photo` interface with the one from Step 5.0.5, and add `PhotoMetadataPatch`.
- In the `photos` table DDL, delete the `camera_*` columns and the "Camera (capture) metadata" comment, put `bearing REAL` under `elevation_m`, and change the position comment to `-- Where the photo was taken`.
- Under **Schema Versioning**, add: "Migration `2.sql` (Phase 5) collapses the photo subject/camera split into a single position: rows with `camera_lat`/`camera_lng` adopt them as `lat`/`lng` (and `camera_elevation_m` as `elevation_m`), then the three `camera_*` columns are dropped."
- After `PHOTO_CLUSTER` under constants, add the `PHOTO_MAX_EDGE_PX`, `PHOTO_THUMB_EDGE_PX`, `PHOTO_JPEG_QUALITY` constants from Step 5.1.1.

`ARCHITECTURE.md`:
- **Storage Interface**: add `updatePhotoMetadata(photo: Photo): Promise<void>` after `savePhoto`, and add this note: "`updatePhotoMetadata` rewrites only the row and tag junction rows; it never touches OPFS blobs. All photo edits (including drag-to-reposition) use it."
- **Panel and placement state**: replace the two type blocks with the `PanelState` / `PlacementState` from Step 5.1.6, and add: "The pending photo moves from `placement.photo` to the `create` photo panel on `completePlacement`. The UI store owns its `preview` object URL and revokes it on the transition that drops the last reference."
- **Photo Import Pipeline**: replace the diagram with:

```
file picked (Add Photo)
  → classify: HEIC/HEIF → guidance message, abort; not JPEG/PNG → message, abort
  → in parallel:
      • read EXIF from the original file: GPS lat/lng, GPSAltitude(+Ref), GPSImgDirection, DateTimeOriginal
      • createImageBitmap(file, { imageOrientation: 'from-image' })  — the browser applies EXIF orientation
        → canvas → JPEG (longest edge ≤ 4096 px, q 0.9) — drawing through canvas strips all EXIF
        → canvas → thumbnail JPEG (longest edge ≤ 128 px)
  → startPhotoPlacement(pending)
  → if EXIF GPS present:
      • map flies to the GPS position
      • completePlacement(lat, lng) immediately → panel.create (pin draggable)
  → else:
      • placement.photo stays active; thumbnail follows the cursor
      • click map → completePlacement(lat, lng) → panel.create
  → create form: bearing / elevation / taken_at prefilled from EXIF; elevation falls back to terrain
  → on save: storage.savePhoto writes photos/{id}.jpg + photos/{id}_thumb.jpg, then the row
```

  and add: "Orientation is not applied manually. `createImageBitmap` with `imageOrientation: 'from-image'` already returns upright pixels, so rotating by the EXIF tag again would double-rotate."
- **Map Layer Architecture**: change "Thumbnails are placed at the subject coordinate" wording (if present) to "at the photo's position". Add: "Photo thumbnail icons are decoded from OPFS on demand, framed on a canvas, and registered as `photo-{id}`; until ready, a `photo-placeholder` tile is shown via `['coalesce', ['image', ['get','icon']], ['image','photo-placeholder']]`. Cluster click eases to `getClusterExpansionZoom`."

`AGENTS.md` › **Key Conventions**: add the bullet "Photo metadata edits go through `StorageProvider.updatePhotoMetadata` (row + tags only); `savePhoto` is for new photos and writes the blobs."

`TASKS.md`:
- In **Progress**, the Phase 5 line already links this plan, and `5.0` is listed. Leave both as they are.
- Add a `### Task 5.0 - Photo model simplification and storage prep` section before Task 5.1. Body: the six design decisions from this plan's header, plus acceptance criteria: "DB migrates v1→v2 preserving photos; `Photo` has no `camera_*` fields; `updatePhotoMetadata` exists on both providers; `exifr` installed."
- **Task 5.1**: replace "fly the map to the GPS coordinates, then immediately dispatch `completePlacement(camera_lat, camera_lng)` so the subject pin is seeded at the camera location. The detail panel opens in `create` mode with the camera fields populated and the subject pin draggable" with "fly the map to the GPS position, then immediately dispatch `completePlacement(lat, lng)`. The detail panel opens in `create` mode with the pin draggable". Change the no-GPS banner text to "Click the map where this photo was taken. Press Escape to cancel." In acceptance, change "drops the subject pin at the camera location" to "drops the pin at the GPS position". Change step 2 "apply orientation" to "decode with the browser applying EXIF orientation".
- **Task 5.2**: replace the "Camera coordinates…" bullet with "Elevation (prefilled from EXIF altitude, else terrain)" and "Location: lat/lng of the pin (drag the pin to adjust)". Change "drag the subject pin" to "drag the pin". Change "including camera_* fields when present" to "including bearing, elevation and taken_at".
- **Task 5.3**: change "at the photo's **subject** coordinates (`lat`/`lng`), not the camera coordinates" to "at the photo's position (`lat`/`lng`)". Change "flies the map to the cluster's bounds" to "eases the map to the cluster's expansion zoom". In acceptance, change "at the subject coordinate" to "at the photo's position".
- **Task 5.4**: replace the subject-coordinate and camera bullets with "Location (lat/lng; editable in edit mode by typing or dragging the pin)" and "Elevation". In acceptance, delete the "no camera location recorded" clause, and change "Subject pin drag on the map updates `lat`/`lng` in storage" to "Dragging the pin in edit mode and saving updates `lat`/`lng` in storage".

- [x] **Step 5.0.13: Verify**

Run: `npm run typecheck` → clean. `npm test` → all pass.

Browser check (`npm run dev`, against an existing v1 database): the app loads without a `SchemaVersionError`. In DevTools, `await __couloir.listAll()` returns photos with no `camera_*` keys. `await __couloir.createDummyPhoto()` succeeds.

- [x] **Step 5.0.14: Commit**

```bash
git add package.json package-lock.json src SPEC.md DATA-MODEL.md ARCHITECTURE.md AGENTS.md TASKS.md
git commit -m "feat(photos): single-position photo model, updatePhotoMetadata, add exifr"
```

Tick 5.0 in `TASKS.md` Progress and commit: `chore(tasks): tick 5.0`.

---

## Task 5.1 — Photo placement mode and EXIF processing

**Files:**
- Modify: `src/types/index.ts`, `src/theme.css`, `src/test/setup.ts`, `src/test/mocks/maplibre-gl.ts`
- Create: `src/utils/exif.ts`, `src/utils/exif.test.ts`
- Create: `src/utils/image.ts`, `src/utils/image.test.ts`
- Modify: `src/utils/geo.ts`, `src/utils/geo.test.ts`
- Modify: `src/hooks/useMap.ts`, `src/features/import/importToast.ts`
- Create: `src/features/photos/photoImport.ts`, `src/features/photos/photoImport.test.ts`, `src/features/photos/AddPhotoButton.tsx`
- Modify: `src/store/ui.ts`, `src/store/ui.test.ts`
- Modify: `src/panels/PlacementBanner/PlacementBanner.tsx`, `PlacementBanner.test.tsx`
- Create: `src/map/placement/photoCursorPreview.ts`, `photoCursorPreview.test.ts`, `PhotoCursorPreview.module.css`
- Modify: `src/map/MapView.tsx`, `src/panels/LayerPanel/LayerPanel.tsx`, `LayerPanel.test.tsx`

This task ends with: an "Add Photo" button in the Layer panel. HEIC files are rejected with the guidance toast. A JPEG with GPS flies the map there and opens the panel in `create` mode (still the placeholder body until 5.2). A JPEG without GPS shows the photo banner and a thumbnail that follows the cursor until the user clicks. ESC cancels and revokes the preview URL.

- [x] **Step 5.1.1: Add photo types and constants to `src/types/index.ts`**

After `PhotoMetadataPatch`:

```ts
// EXIF fields Couloir reads at import (src/utils/exif.ts). Any of them can be
// absent from a file, so every field is nullable.
export interface PhotoExif {
  lat: number | null
  lng: number | null
  altitude_m: number | null
  bearing: number | null     // GPSImgDirection, normalised to 0-359
  taken_at: string | null    // DateTimeOriginal as ISO 8601
}

// A photo that has been read and re-encoded but not yet saved. Lives in the
// UI store from startPhotoPlacement until the create form saves or cancels.
export interface PendingPhoto {
  blob: Blob            // full-size JPEG, EXIF stripped
  thumb: Blob           // thumbnail JPEG
  preview: string       // object URL of `thumb`; owned and revoked by the UI store
  width: number
  height: number
  filename: string      // original file name, seeds the Name field
  exif: PhotoExif
}
```

Next to `PHOTO_CLUSTER`:

```ts
// Photo re-encoding (src/utils/image.ts). The full-size cap keeps a 24 MP
// phone photo around 2-3 MB in OPFS while leaving plenty of zoom detail.
export const PHOTO_MAX_EDGE_PX = 4096
export const PHOTO_THUMB_EDGE_PX = 128
export const PHOTO_JPEG_QUALITY = 0.9
```

- [x] **Step 5.1.2: `normalizeBearing` — test first in `src/utils/geo.test.ts`**

```ts
describe('normalizeBearing', () => {
  it.each([
    [0, 0], [90, 90], [359.4, 359], [359.6, 0], [360, 0], [725, 5], [-90, 270],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBearing(input)).toBe(expected)
  })
})
```

Add `normalizeBearing` to the import and run. Expected: FAIL. Then add to `src/utils/geo.ts`:

```ts
// Wraps any finite angle into the integer compass range 0-359.
export function normalizeBearing(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360
}
```

Run again. Expected: PASS.

- [x] **Step 5.1.3: EXIF normalisation — test first, `src/utils/exif.test.ts`**

```ts
import { normalizeExif } from './exif'

describe('normalizeExif', () => {
  it('returns all nulls for a file with no EXIF', () => {
    expect(normalizeExif(undefined)).toEqual({
      lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null,
    })
  })

  it('reads GPS position, altitude, bearing and capture time', () => {
    const taken = new Date(2026, 1, 14, 9, 31, 5)
    expect(normalizeExif({
      latitude: 49.4621, longitude: -115.0832,
      GPSAltitude: 1834.6, GPSAltitudeRef: 0,
      GPSImgDirection: 271.53,
      DateTimeOriginal: taken,
    })).toEqual({
      lat: 49.4621, lng: -115.0832, altitude_m: 1834.6, bearing: 272,
      taken_at: taken.toISOString(),
    })
  })

  it('treats a 0,0 fix as no GPS (cameras write it when they have no fix)', () => {
    const r = normalizeExif({ latitude: 0, longitude: 0 })
    expect(r.lat).toBeNull()
    expect(r.lng).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(normalizeExif({ latitude: 91, longitude: 10 }).lat).toBeNull()
  })

  it.each([1, new Uint8Array([1]), 'Below Sea Level'])(
    'negates altitude when GPSAltitudeRef is below sea level (%s)',
    (ref) => {
      expect(normalizeExif({ GPSAltitude: 12, GPSAltitudeRef: ref }).altitude_m).toBe(-12)
    },
  )

  it('parses EXIF-format date strings as local time', () => {
    expect(normalizeExif({ DateTimeOriginal: '2026:02:14 09:31:05' }).taken_at)
      .toBe(new Date(2026, 1, 14, 9, 31, 5).toISOString())
  })

  it('drops unparseable dates and non-numeric values', () => {
    expect(normalizeExif({ DateTimeOriginal: 'garbage', GPSImgDirection: 'N' })).toMatchObject({
      taken_at: null, bearing: null,
    })
  })
})
```

Run. Expected: FAIL (module missing).

- [x] **Step 5.1.4: Implement `src/utils/exif.ts`**

```ts
import exifr from 'exifr'
import type { PhotoExif } from '../types'
import { normalizeBearing } from './geo'
import { debug } from './debug'

// The subset of exifr's (loosely typed) output that we read. exifr computes
// `latitude`/`longitude` as signed decimals from the GPS IFD.
export interface RawExif {
  latitude?: unknown
  longitude?: unknown
  GPSAltitude?: unknown
  GPSAltitudeRef?: unknown
  GPSImgDirection?: unknown
  DateTimeOriginal?: unknown
}

const EMPTY: PhotoExif = { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null }

// Never throws: a file with unreadable EXIF imports as if it had none.
export async function readPhotoExif(file: Blob): Promise<PhotoExif> {
  try {
    const raw = (await exifr.parse(file, {
      tiff: true, exif: true, gps: true,
      ifd1: false, interop: false, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false,
    })) as RawExif | undefined
    return normalizeExif(raw)
  } catch (err) {
    debug('exif read failed', err)
    return EMPTY
  }
}

export function normalizeExif(raw: RawExif | undefined): PhotoExif {
  if (!raw) return EMPTY
  const lat = finite(raw.latitude)
  const lng = finite(raw.longitude)
  const hasFix =
    lat !== null && lng !== null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)

  const altitude = finite(raw.GPSAltitude)
  const bearing = finite(raw.GPSImgDirection)

  return {
    lat: hasFix ? lat : null,
    lng: hasFix ? lng : null,
    altitude_m: altitude === null ? null : isBelowSeaLevel(raw.GPSAltitudeRef) ? -altitude : altitude,
    bearing: bearing === null ? null : normalizeBearing(bearing),
    taken_at: toIso(raw.DateTimeOriginal),
  }
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// exifr may hand GPSAltitudeRef back raw (1 / Uint8Array[1]) or translated.
function isBelowSeaLevel(ref: unknown): boolean {
  if (ref === 1) return true
  if (ref instanceof Uint8Array) return ref[0] === 1
  return typeof ref === 'string' && /below/i.test(ref)
}

// EXIF dates carry no zone; exifr revives them as local-time Dates. A raw
// 'YYYY:MM:DD HH:MM:SS' string is interpreted the same way.
function toIso(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
  if (typeof v !== 'string') return null
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
```

Run the exif tests. Expected: PASS. If `tsc` complains that `exifr` lacks types: it ships `index.d.ts`, so the error means the import path is wrong. Use `import exifr from 'exifr'` exactly.

- [x] **Step 5.1.5: Image re-encoding — test the pure size math, `src/utils/image.test.ts`**

```ts
import { fitWithin } from './image'

describe('fitWithin', () => {
  it('leaves images within the cap untouched (never upscales)', () => {
    expect(fitWithin(800, 600, 4096)).toEqual({ width: 800, height: 600 })
  })
  it('scales landscape images by the long edge', () => {
    expect(fitWithin(6000, 4000, 4096)).toEqual({ width: 4096, height: 2731 })
  })
  it('scales portrait images by the long edge', () => {
    expect(fitWithin(3000, 4000, 128)).toEqual({ width: 96, height: 128 })
  })
  it('never returns a zero dimension', () => {
    expect(fitWithin(10000, 10, 128)).toEqual({ width: 128, height: 1 })
  })
})
```

Then `src/utils/image.ts`:

```ts
import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE_PX, PHOTO_THUMB_EDGE_PX } from '../types'

export interface Size {
  width: number
  height: number
}

// Scales (width, height) so the longest edge is at most maxEdge, preserving
// aspect ratio. Never upscales.
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export interface EncodedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

// Decodes with EXIF orientation applied by the browser, then re-encodes as
// JPEG. Drawing through a canvas drops every metadata segment, so the output
// carries no EXIF (GPS, device serials, etc.). Do not also rotate by the EXIF
// Orientation tag — 'from-image' has already done it.
export async function encodePhoto(file: Blob): Promise<EncodedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const full = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE_PX)
    const thumbSize = fitWithin(bitmap.width, bitmap.height, PHOTO_THUMB_EDGE_PX)
    const blob = await drawToJpeg(bitmap, full)
    const thumb = await drawToJpeg(bitmap, thumbSize)
    return { blob, thumb, width: full.width, height: full.height }
  } finally {
    bitmap.close()
  }
}

async function drawToJpeg(source: CanvasImageSource, size: Size): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  // JPEG has no alpha channel; flatten transparent PNG pixels onto white.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      PHOTO_JPEG_QUALITY,
    )
  })
}
```

Run: `npm test -- src/utils/image.test.ts`. Expected: PASS.

- [x] **Step 5.1.6: UI store — pending photo + preview ownership. Tests first in `src/store/ui.test.ts`**

Replace the existing `'startPhotoPlacement carries blob/exif/preview through to create draft'` test and add the revocation tests:

```ts
const pendingPhoto = (preview = 'blob:test/p1'): PendingPhoto => ({
  blob: new Blob(['full']),
  thumb: new Blob(['thumb']),
  preview,
  width: 4000,
  height: 3000,
  filename: 'IMG_0001.jpg',
  exif: { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null },
})

describe('photo placement', () => {
  let revoke: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
    revoke = vi.spyOn(URL, 'revokeObjectURL')
  })
  afterEach(() => revoke.mockRestore())

  it('carries the pending photo from placement onto the create panel', () => {
    const pending = pendingPhoto()
    useUiStore.getState().startPhotoPlacement(pending)
    expect(useUiStore.getState().placement).toEqual({ mode: 'photo', pending })
    useUiStore.getState().completePlacement(49.5, -116.0)
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'create' || panel.entityType !== 'photo') throw new Error('expected photo create')
    expect(panel.pending).toBe(pending)
    expect(panel.draft).toEqual({ lat: 49.5, lng: -116.0 })
    expect(useUiStore.getState().placement.mode).toBe('idle')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('revokes the preview when placement is cancelled', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/a'))
    useUiStore.getState().cancelPlacement()
    expect(revoke).toHaveBeenCalledWith('blob:test/a')
  })

  it('revokes the preview when the create panel closes', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/b'))
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().closePanel()
    expect(revoke).toHaveBeenCalledWith('blob:test/b')
  })

  it('revokes the preview when save transitions to view', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/c'))
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().openEntity('photo', 'p1')
    expect(revoke).toHaveBeenCalledWith('blob:test/c')
  })

  it('updateDraft keeps the pending photo', () => {
    const pending = pendingPhoto()
    useUiStore.getState().startPhotoPlacement(pending)
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().updateDraft({ lat: 3 })
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'create' || panel.entityType !== 'photo') throw new Error('expected photo create')
    expect(panel.pending).toBe(pending)
    expect(panel.draft).toEqual({ lat: 3, lng: 2 })
  })
})

describe('draftNumber', () => {
  it('reads numeric draft fields from create/edit panels only', () => {
    expect(draftNumber({ mode: 'idle' }, 'lat')).toBeNull()
    expect(draftNumber({ mode: 'edit', entityType: 'photo', entityId: 'p', draft: { lat: 4 } }, 'lat')).toBe(4)
    expect(draftNumber({ mode: 'edit', entityType: 'photo', entityId: 'p', draft: {} }, 'lng')).toBeNull()
  })
})
```

Import `draftNumber` from `./ui` and `PendingPhoto` from `../types`. Add the object-URL stand-ins to `src/test/setup.ts` (jsdom implements neither):

```ts
// jsdom doesn't implement object URLs. Inert stand-ins let code that mints
// and revokes previews run under test; tests spy on them where it matters.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0
  URL.createObjectURL = () => `blob:test/${++n}`
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}
```

Run: `npm test -- src/store/ui.test.ts`. Expected: FAIL (type and behaviour).

- [x] **Step 5.1.7: Implement in `src/store/ui.ts`**

1. Imports: `import type { Basemap, EntityDraft, EntityType, PendingPhoto } from '../types'`.
2. Replace the panel/placement types. Delete `PhotoPlacementContext`:

```ts
export type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint'; draft: EntityDraft }
  | { mode: 'create'; entityType: 'photo'; draft: EntityDraft; pending: PendingPhoto }

export type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; pending: PendingPhoto }
```

3. In `UiState`: `startPhotoPlacement: (pending: PendingPhoto) => void`.
4. Add helpers above the store:

```ts
// The in-flight photo's preview object URL is owned by this store: whichever
// transition drops the last reference to a pending photo revokes its URL.
function pendingPreview(s: { panel: PanelState; placement: PlacementState }): string | null {
  if (s.placement.mode === 'photo') return s.placement.pending.preview
  if (s.panel.mode === 'create' && s.panel.entityType === 'photo') return s.panel.pending.preview
  return null
}

// Reads a numeric field from the create/edit draft, or null. Selectors use
// this to subscribe to primitives (lat/lng) rather than a fresh object.
export function draftNumber(panel: PanelState, key: 'lat' | 'lng'): number | null {
  if (panel.mode !== 'create' && panel.mode !== 'edit') return null
  const v = (panel.draft as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : null
}
```

5. Change `create<UiState>((set, get) => ({ … }))` to a block body so the actions can share a `transition` helper:

```ts
export const useUiStore = create<UiState>((set, get) => {
  const transition = (next: Partial<Pick<UiState, 'panel' | 'placement'>>) => {
    const before = pendingPreview(get())
    set(next)
    const after = pendingPreview(get())
    if (before !== null && before !== after) URL.revokeObjectURL(before)
  }

  return {
    // ...Phase 1 fields unchanged...
```

6. Route these actions through `transition`:

```ts
    openEntity: (entityType, entityId) => {
      // Opening an entity always cancels any in-flight placement.
      transition({ panel: { mode: 'view', entityType, entityId }, placement: { mode: 'idle' } })
    },
    closePanel: () => transition({ panel: { mode: 'idle' } }),
    startWaypointPlacement: () => transition({ placement: { mode: 'waypoint' } }),
    startPhotoPlacement: (pending) => transition({ placement: { mode: 'photo', pending } }),
    completePlacement: (lat, lng) => {
      const cur = get().placement
      if (cur.mode === 'idle') return
      const panel: PanelState =
        cur.mode === 'waypoint'
          ? { mode: 'create', entityType: 'waypoint', draft: { lat, lng } }
          : { mode: 'create', entityType: 'photo', draft: { lat, lng }, pending: cur.pending }
      transition({ placement: { mode: 'idle' }, panel })
    },
    cancelPlacement: () => transition({ placement: { mode: 'idle' } }),
```

Delete the `FIXME(phase 5)` comment. `editCurrent` and `updateDraft` keep using `set` (they never drop a pending photo). In `updateDraft`, the create branch `{ ...cur, draft: … }` preserves `pending` as written.

Run the ui tests, `npm run typecheck`. Expected: PASS / clean. (`DetailPanel.tsx`'s create-branch narrowing still compiles: `panel.entityType` is `'waypoint' | 'photo'`.)

- [x] **Step 5.1.8: `getMap()` and `showToast()`**

`src/hooks/useMap.ts`: rename `getSnapshot` to an exported `getMap` and use it in `useSyncExternalStore`:

```ts
// Non-hook accessor for imperative callers (e.g. the photo import flow).
export function getMap(): maplibregl.Map | null {
  return current
}
// ...
  return useSyncExternalStore(subscribe, getMap, () => null)
```

`src/features/import/importToast.ts`: extract the display/timer half into a generic export and call it from `showImportSummaryToast`:

```ts
export function showToast(message: string, durationMs = 4000): void {
  if (!listener) return
  listener(message)
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    if (listener) listener(null)
    timer = null
  }, durationMs)
}
```

`showImportSummaryToast` keeps building `message` and ends with `showToast(message, durationMs)`. Existing `importToast.test.tsx` must still pass unchanged.

- [x] **Step 5.1.9: Import orchestrator — test first, `src/features/photos/photoImport.test.ts`**

```ts
import { classifyPhotoFile, importPhotoFile, HEIC_MESSAGE, type PhotoImportDeps } from './photoImport'
import type { PhotoExif } from '../../types'

const noExif: PhotoExif = { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null }

function deps(overrides: Partial<PhotoImportDeps> = {}): PhotoImportDeps {
  return {
    readExif: vi.fn(async () => noExif),
    encode: vi.fn(async () => ({ blob: new Blob(['f']), thumb: new Blob(['t']), width: 40, height: 30 })),
    createPreviewUrl: vi.fn(() => 'blob:test/preview'),
    startPhotoPlacement: vi.fn(),
    completePlacement: vi.fn(),
    flyTo: vi.fn(),
    notify: vi.fn(),
    ...overrides,
  }
}

const file = (name: string, type: string) => new File(['x'], name, { type })

describe('classifyPhotoFile', () => {
  it.each([
    ['a.jpg', 'image/jpeg', 'jpeg'],
    ['a.JPEG', '', 'jpeg'],
    ['a.png', 'image/png', 'png'],
    ['a.heic', '', 'heic'],
    ['a.jpg', 'image/heif', 'heic'],
    ['a.gif', 'image/gif', 'unsupported'],
  ])('%s (%s) → %s', (name, type, kind) => {
    expect(classifyPhotoFile({ name, type })).toBe(kind)
  })
})

describe('importPhotoFile', () => {
  it('rejects HEIC with the guidance message and does no work', async () => {
    const d = deps()
    expect(await importPhotoFile(file('IMG.HEIC', 'image/heic'), d)).toBe('rejected')
    expect(d.notify).toHaveBeenCalledWith(HEIC_MESSAGE)
    expect(d.encode).not.toHaveBeenCalled()
    expect(d.startPhotoPlacement).not.toHaveBeenCalled()
  })

  it('with EXIF GPS: starts placement, flies there, completes placement at the GPS fix', async () => {
    const d = deps({ readExif: vi.fn(async () => ({ ...noExif, lat: 49.46, lng: -115.08, bearing: 270 })) })
    expect(await importPhotoFile(file('a.jpg', 'image/jpeg'), d)).toBe('placed')
    expect(d.startPhotoPlacement).toHaveBeenCalledWith(expect.objectContaining({
      preview: 'blob:test/preview', filename: 'a.jpg', width: 40, height: 30,
      exif: expect.objectContaining({ bearing: 270 }),
    }))
    expect(d.flyTo).toHaveBeenCalledWith(49.46, -115.08)
    expect(d.completePlacement).toHaveBeenCalledWith(49.46, -115.08)
  })

  it('without EXIF GPS: starts placement and waits for a map click', async () => {
    const d = deps()
    expect(await importPhotoFile(file('a.png', 'image/png'), d)).toBe('awaiting-click')
    expect(d.startPhotoPlacement).toHaveBeenCalled()
    expect(d.flyTo).not.toHaveBeenCalled()
    expect(d.completePlacement).not.toHaveBeenCalled()
  })

  it('reports a decode failure and does not start placement', async () => {
    const d = deps({ encode: vi.fn(async () => { throw new Error('bad') }) })
    expect(await importPhotoFile(file('a.jpg', 'image/jpeg'), d)).toBe('failed')
    expect(d.notify).toHaveBeenCalledWith(expect.stringMatching(/a\.jpg/))
    expect(d.startPhotoPlacement).not.toHaveBeenCalled()
  })
})
```

Run. Expected: FAIL.

- [x] **Step 5.1.10: Implement `src/features/photos/photoImport.ts`**

```ts
import type { PendingPhoto, PhotoExif } from '../../types'
import type { EncodedPhoto } from '../../utils/image'
import { debug } from '../../utils/debug'

export type PhotoFileKind = 'jpeg' | 'png' | 'heic' | 'unsupported'

export const HEIC_MESSAGE =
  'HEIC is not supported. On iPhone: Settings → Camera → Formats → Most Compatible.'
export const UNSUPPORTED_MESSAGE = 'Only JPEG and PNG photos can be imported.'

// MIME type is often empty for HEIC on Windows, so the extension is checked too.
export function classifyPhotoFile(file: Pick<File, 'name' | 'type'>): PhotoFileKind {
  const type = file.type.toLowerCase()
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif') return 'heic'
  if (type === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (type === 'image/png' || ext === 'png') return 'png'
  return 'unsupported'
}

export interface PhotoImportDeps {
  readExif: (file: Blob) => Promise<PhotoExif>
  encode: (file: Blob) => Promise<EncodedPhoto>
  createPreviewUrl: (blob: Blob) => string
  startPhotoPlacement: (pending: PendingPhoto) => void
  completePlacement: (lat: number, lng: number) => void
  flyTo: (lat: number, lng: number) => void
  notify: (message: string) => void
}

export type PhotoImportOutcome = 'rejected' | 'failed' | 'placed' | 'awaiting-click'

export async function importPhotoFile(
  file: File,
  deps: PhotoImportDeps,
): Promise<PhotoImportOutcome> {
  const kind = classifyPhotoFile(file)
  if (kind === 'heic') {
    deps.notify(HEIC_MESSAGE)
    return 'rejected'
  }
  if (kind === 'unsupported') {
    deps.notify(UNSUPPORTED_MESSAGE)
    return 'rejected'
  }

  let exif: PhotoExif
  let encoded: EncodedPhoto
  try {
    // EXIF must be read from the original — the re-encoded JPEG has none.
    ;[exif, encoded] = await Promise.all([deps.readExif(file), deps.encode(file)])
  } catch (err) {
    debug('photo import failed', err)
    deps.notify(`Couldn't read ${file.name}.`)
    return 'failed'
  }

  deps.startPhotoPlacement({
    ...encoded,
    preview: deps.createPreviewUrl(encoded.thumb),
    filename: file.name,
    exif,
  })

  if (exif.lat !== null && exif.lng !== null) {
    deps.flyTo(exif.lat, exif.lng)
    deps.completePlacement(exif.lat, exif.lng)
    return 'placed'
  }
  return 'awaiting-click'
}
```

Run. Expected: PASS.

- [x] **Step 5.1.11: `src/features/photos/AddPhotoButton.tsx`**

```tsx
import { useRef } from 'react'
import { importPhotoFile, type PhotoImportOutcome } from './photoImport'
import { readPhotoExif } from '../../utils/exif'
import { encodePhoto } from '../../utils/image'
import { useUiStore } from '../../store/ui'
import { getMap } from '../../hooks/useMap'
import { showToast } from '../import/importToast'

// Zoom the map flies to for a photo with GPS — close enough to judge the
// position against terrain, without losing context if already zoomed in.
const PHOTO_FLY_ZOOM = 14

export function AddPhotoButton(): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}>
        Add Photo
      </button>
      <input
        ref={inputRef}
        type="file"
        // HEIC is listed so it isn't greyed out — picking one shows guidance.
        accept="image/jpeg,image/png,.jpg,.jpeg,.png,.heic,.heif"
        style={{ display: 'none' }}
        data-testid="add-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset so picking the same file twice fires onChange again.
          e.target.value = ''
          if (file) void runPhotoImport(file)
        }}
      />
    </>
  )
}

export function runPhotoImport(file: File): Promise<PhotoImportOutcome> {
  const ui = useUiStore.getState()
  return importPhotoFile(file, {
    readExif: readPhotoExif,
    encode: encodePhoto,
    createPreviewUrl: (blob) => URL.createObjectURL(blob),
    startPhotoPlacement: ui.startPhotoPlacement,
    completePlacement: ui.completePlacement,
    flyTo: (lat, lng) => {
      const map = getMap()
      map?.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), PHOTO_FLY_ZOOM) })
    },
    notify: (message) => showToast(message, 8000),
  })
}
```

- [x] **Step 5.1.12: Layer panel button — test first**

In `src/panels/LayerPanel/LayerPanel.test.tsx` add:

```tsx
  it('renders an Add Photo button', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    expect(screen.getByRole('button', { name: /add photo/i })).toBeInTheDocument()
  })
```

Then in `LayerPanel.tsx`, import `AddPhotoButton` from `'../../features/photos/AddPhotoButton'` and render `<AddPhotoButton />` after the Add Waypoint button inside `.actions`. Run the test. Expected: PASS.

- [x] **Step 5.1.13: Placement banner photo branch — test first**

In `PlacementBanner.test.tsx`:

```tsx
  it('shows the photo prompt when placement.mode === "photo"', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.setState({
        placement: {
          mode: 'photo',
          pending: {
            blob: new Blob(), thumb: new Blob(), preview: 'blob:test/x', width: 1, height: 1,
            filename: 'a.jpg', exif: { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null },
          },
        },
      })
    })
    expect(screen.getByRole('status')).toHaveTextContent(/where this photo was taken/i)
  })
```

Then `PlacementBanner.tsx`:

```tsx
// Subscribes to the placement state machine. Renders nothing in idle mode;
// otherwise shows the click-the-map prompt for the active placement and a
// Cancel button.
export function PlacementBanner(): JSX.Element | null {
  const mode = useUiStore((s) => s.placement.mode)
  const cancelPlacement = useUiStore((s) => s.cancelPlacement)

  if (mode === 'idle') return null

  const message =
    mode === 'waypoint'
      ? 'Click the map to place a waypoint. Press Escape to cancel.'
      : 'Click the map where this photo was taken. Press Escape to cancel.'

  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      <span>{message}</span>
      <button type="button" onClick={cancelPlacement}>Cancel</button>
    </div>
  )
}
```

Run. Expected: PASS (existing waypoint tests too).

- [x] **Step 5.1.14: Extend the MapLibre mock — `src/test/mocks/maplibre-gl.ts`**

Add to `MockMap`:

```ts
  getZoom = vi.fn(() => 11)
  easeTo = vi.fn()
  removeImage = vi.fn()
  queryTerrainElevation = vi.fn((): number | null => null)
```

Add a marker mock and export it:

```ts
type LngLatLike = [number, number] | { lng: number; lat: number }

export class MockMarker {
  private listeners = new EventMap<string, Set<(...args: unknown[]) => void>>()
  private lngLat: { lng: number; lat: number } | null = null
  constructor(public options: Record<string, unknown> = {}) {}
  setLngLat = vi.fn((ll: LngLatLike) => {
    this.lngLat = Array.isArray(ll) ? { lng: ll[0], lat: ll[1] } : { lng: ll.lng, lat: ll.lat }
    return this
  })
  getLngLat = vi.fn(() => this.lngLat)
  addTo = vi.fn(() => this)
  remove = vi.fn(() => this)
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  })
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
}

export const Marker = vi.fn().mockImplementation((opts?: Record<string, unknown>) => new MockMarker(opts))
```

Update the exports: `export const __mocks__ = { MockMap, MockMarker }` and `export default { Map, NavigationControl, Marker }`.

- [x] **Step 5.1.15: Cursor-follow thumbnail — test first, `src/map/placement/photoCursorPreview.test.ts`**

```ts
import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { applyPhotoCursorPreview } from './photoCursorPreview'

describe('applyPhotoCursorPreview', () => {
  beforeEach(() => vi.mocked(maplibregl.Marker).mockClear())

  it('adds a pointer-transparent thumbnail marker that follows the cursor', () => {
    const map = new __mocks__.MockMap()
    const teardown = applyPhotoCursorPreview(map as never, 'blob:test/thumb')
    const marker = vi.mocked(maplibregl.Marker).mock.results[0].value as InstanceType<typeof __mocks__.MockMarker>
    const el = marker.options.element as HTMLImageElement
    expect(el.src).toBe('blob:test/thumb')
    expect(el.style.pointerEvents).toBe('none')
    expect(marker.addTo).not.toHaveBeenCalled()

    map.emit('mousemove', { lngLat: { lng: -115, lat: 49.5 } })
    map.emit('mousemove', { lngLat: { lng: -115.1, lat: 49.6 } })
    expect(marker.addTo).toHaveBeenCalledTimes(1)
    expect(marker.setLngLat).toHaveBeenLastCalledWith({ lng: -115.1, lat: 49.6 })

    teardown()
    expect(marker.remove).toHaveBeenCalled()
    expect(map.off).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })
})
```

Then `src/map/placement/PhotoCursorPreview.module.css`:

```css
.preview {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: 2px solid var(--color-photo-frame);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  opacity: 0.9;
  pointer-events: none;
}
```

Add `--color-photo-frame: #ffffff;` to `:root` in `src/theme.css`, after `--color-ok`.

Then `src/map/placement/photoCursorPreview.ts`:

```ts
import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import styles from './PhotoCursorPreview.module.css'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'

// While a photo without GPS awaits placement, its thumbnail follows the
// cursor. The element ignores pointer events so the click falls through to
// the map, where usePlacementMapBinding turns it into completePlacement.
export function applyPhotoCursorPreview(map: maplibregl.Map, previewUrl: string): () => void {
  const el = document.createElement('img')
  el.src = previewUrl
  el.alt = ''
  el.className = styles.preview
  // Set inline too: CSS-module class names are not applied under jsdom tests.
  el.style.pointerEvents = 'none'

  const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [12, -12] })
  let shown = false

  const onMove = (e: maplibregl.MapMouseEvent) => {
    marker.setLngLat(e.lngLat)
    if (!shown) {
      marker.addTo(map)
      shown = true
    }
  }
  const onOut = () => {
    marker.remove()
    shown = false
  }
  map.on('mousemove', onMove)
  map.on('mouseout', onOut)

  return () => {
    map.off('mousemove', onMove)
    map.off('mouseout', onOut)
    marker.remove()
  }
}

export function usePhotoCursorPreview(): void {
  const map = useMap()
  const preview = useUiStore((s) => (s.placement.mode === 'photo' ? s.placement.pending.preview : null))
  useEffect(() => {
    if (!map || !preview) return
    return applyPhotoCursorPreview(map, preview)
  }, [map, preview])
}
```

Run. Expected: PASS. In `MapView.tsx`, call `usePhotoCursorPreview()` directly under `usePlacementMapBinding()`. In `usePlacementMapBinding.ts`, delete the stale "Photo placement (Phase 5) will need a different click payload" comment: both modes complete with `(lat, lng)`.

- [x] **Step 5.1.16: Verify**

`npm run typecheck` → clean. `npm test` → all pass.

Browser (`npm run dev`):
- Add Photo → pick a `.heic` → toast with the iPhone guidance; nothing else happens.
- Pick an iPhone JPEG with location → the map flies to it, the panel opens in create mode (placeholder text until 5.2), no banner.
- Pick a JPEG without GPS (for example, a screenshot saved as JPEG, or one run through `exiftool -gps:all=`) → banner "Click the map where this photo was taken…", the thumbnail follows the cursor, clicking opens create mode.
- Repeat the no-GPS case and press ESC → banner and cursor thumbnail disappear.
- Portrait iPhone JPEG (EXIF Orientation 6) without GPS: the cursor thumbnail is upright. (The full preview is checked in 5.2.)

- [x] **Step 5.1.17: Commit and tick**

```bash
git add src TASKS.md
git commit -m "feat(photos): add-photo import, EXIF read, re-encode, placement mode"
```

Tick 5.1 in `TASKS.md` Progress → commit `chore(tasks): tick 5.1`.

---

## Task 5.2 — Photo creation form

**Files:**
- Modify: `src/utils/geo.ts`, `geo.test.ts` (bearingFromVector); `src/utils/time.ts`, `time.test.ts`
- Create: `src/components/CompassRose/CompassRose.tsx`, `.module.css`, `.test.tsx`
- Create: `src/hooks/useObjectUrl.ts`, `useObjectUrl.test.tsx`
- Create: `src/map/terrain.ts`, `terrain.test.ts`; Modify: `src/panels/DetailPanel/WaypointCreate.tsx`
- Create: `src/map/placement/PhotoPositionMarker.tsx`, `PhotoPositionMarker.test.tsx`
- Modify: `src/map/layers/layerStyles.ts` (PHOTO_PIN_COLOR), `src/map/MapView.tsx`
- Create: `src/panels/DetailPanel/photoForm.ts`, `photoForm.test.ts`, `PhotoFields.tsx`, `PhotoPositionFields.tsx`, `PhotoCreate.tsx`, `PhotoCreate.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.tsx`, `DetailPanel.shared.module.css`, `src/dev/devConsole.ts`

This task ends with: the create panel shows a full preview, name (from the filename), description, bearing with a compass rose, taken-at, elevation, location and tags. A draggable pin sits on the map and the lat/lng follow it. Save writes the blob, thumbnail and row, then switches to view mode (the placeholder until 5.4). Cancel discards everything.

- [x] **Step 5.2.1: `bearingFromVector` — test then implement**

`geo.test.ts`:

```ts
describe('bearingFromVector', () => {
  it.each([
    [0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270], [1, -1, 45],
  ])('(%s, %s) → %s°', (dx, dy, expected) => {
    expect(bearingFromVector(dx, dy)).toBe(expected)
  })
})
```

`geo.ts`:

```ts
// Compass bearing (0 = north, clockwise) of a screen-space vector. dy grows
// downward, as in DOM/SVG coordinates.
export function bearingFromVector(dx: number, dy: number): number {
  return normalizeBearing((Math.atan2(dx, -dy) * 180) / Math.PI)
}
```

- [x] **Step 5.2.2: datetime-local helpers — test then implement**

`time.test.ts`:

```ts
describe('isoToLocalInput / localInputToIso', () => {
  it('round-trips a local wall-clock time to the second', () => {
    const iso = new Date(2026, 1, 14, 9, 31, 5).toISOString()
    expect(isoToLocalInput(iso)).toBe('2026-02-14T09:31:05')
    expect(localInputToIso('2026-02-14T09:31:05')).toBe(iso)
  })
  it('maps empty / invalid to empty / null', () => {
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('nope')).toBe('')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('nope')).toBeNull()
  })
})
```

`time.ts`:

```ts
// <input type="datetime-local"> works in zone-less local wall-clock time.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function localInputToIso(value: string): string | null {
  if (value.trim() === '') return null
  const d = new Date(value) // 'YYYY-MM-DDTHH:mm[:ss]' without a zone parses as local
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
```

- [x] **Step 5.2.3: `CompassRose` — test first**

`src/components/CompassRose/CompassRose.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { CompassRose } from './CompassRose'

describe('CompassRose', () => {
  it('labels and rotates the needle to the bearing', () => {
    render(<CompassRose bearing={120} />)
    expect(screen.getByRole('img', { name: 'Bearing: 120°' })).toBeInTheDocument()
    expect(screen.getByTestId('compass-needle')).toHaveAttribute('transform', 'rotate(120)')
  })

  it('shows no needle when the bearing is unknown', () => {
    render(<CompassRose bearing={null} />)
    expect(screen.getByRole('img', { name: 'Bearing: not set' })).toBeInTheDocument()
    expect(screen.queryByTestId('compass-needle')).toBeNull()
  })

  it('sets the bearing from a click when interactive', () => {
    const onChange = vi.fn()
    render(<CompassRose bearing={null} onChange={onChange} />)
    const svg = screen.getByRole('img')
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    fireEvent.click(svg, { clientX: 100, clientY: 50 }) // due east of centre
    expect(onChange).toHaveBeenCalledWith(90)
  })
})
```

`CompassRose.module.css`:

```css
.rose { display: block; flex: none; }
.interactive { cursor: crosshair; }
.ring { fill: var(--color-bg-2); stroke: var(--color-border); stroke-width: 2; }
.tick { stroke: var(--color-text-dim); stroke-width: 2; }
.north { fill: var(--color-text-dim); font-size: 12px; text-anchor: middle; dominant-baseline: middle; }
.needle { fill: var(--color-accent); }
.tail { fill: var(--color-text-dim); }
```

`CompassRose.tsx`:

```tsx
import type { MouseEvent } from 'react'
import styles from './CompassRose.module.css'
import { bearingFromVector } from '../../utils/geo'

interface Props {
  bearing: number | null
  size?: number
  // When set, clicking the rose sets the bearing to the clicked direction.
  onChange?: (bearing: number) => void
}

export function CompassRose({ bearing, size = 96, onChange }: Props): JSX.Element {
  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onChange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    if (dx === 0 && dy === 0) return
    onChange(bearingFromVector(dx, dy))
  }

  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={bearing === null ? 'Bearing: not set' : `Bearing: ${bearing}°`}
      className={onChange ? `${styles.rose} ${styles.interactive}` : styles.rose}
      onClick={onChange ? handleClick : undefined}
    >
      <circle r="46" className={styles.ring} />
      {[0, 90, 180, 270].map((deg) => (
        <line key={deg} x1="0" y1="-46" x2="0" y2="-38" className={styles.tick} transform={`rotate(${deg})`} />
      ))}
      <text y="-28" className={styles.north}>N</text>
      {bearing !== null && (
        <g transform={`rotate(${bearing})`} data-testid="compass-needle">
          <polygon points="0,-40 6,0 -6,0" className={styles.needle} />
          <polygon points="0,40 6,0 -6,0" className={styles.tail} />
        </g>
      )}
    </svg>
  )
}
```

Run. Expected: PASS.

- [x] **Step 5.2.4: `useObjectUrl` — test then implement**

`src/hooks/useObjectUrl.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { useObjectUrl } from './useObjectUrl'

describe('useObjectUrl', () => {
  it('mints a URL for the blob and revokes it on unmount', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    // Hoisted: a blob created inside the callback would change every render.
    const blob = new Blob(['x'])
    const { result, unmount } = renderHook(() => useObjectUrl(blob))
    const url = result.current
    expect(url).toMatch(/^blob:/)
    unmount()
    expect(revoke).toHaveBeenCalledWith(url)
    revoke.mockRestore()
  })

  it('returns null for a null blob', () => {
    expect(renderHook(() => useObjectUrl(null)).result.current).toBeNull()
  })
})
```

`src/hooks/useObjectUrl.ts`:

```ts
import { useEffect, useState } from 'react'

// Object URL for a blob, revoked when the blob changes or the caller unmounts.
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
```

- [x] **Step 5.2.5: Shared terrain lookup — `src/map/terrain.ts`**

Test (`terrain.test.ts`):

```ts
import { queryElevation } from './terrain'

describe('queryElevation', () => {
  it('returns the DEM value when available', () => {
    const map = { queryTerrainElevation: vi.fn(() => 1834.4) }
    expect(queryElevation(map as never, 49.5, -115)).toBe(1834.4)
    expect(map.queryTerrainElevation).toHaveBeenCalledWith({ lng: -115, lat: 49.5 })
  })
  it('returns null when terrain is off or tiles are not loaded', () => {
    expect(queryElevation({ queryTerrainElevation: () => null } as never, 0, 0)).toBeNull()
    expect(queryElevation({} as never, 0, 0)).toBeNull()
  })
})
```

Implementation:

```ts
import type maplibregl from 'maplibre-gl'

// Terrain elevation (metres) at a point, or null when terrain is disabled or
// the DEM tile hasn't loaded. Callers leave the field blank rather than guess.
export function queryElevation(map: maplibregl.Map, lat: number, lng: number): number | null {
  const m = map as unknown as {
    queryTerrainElevation?: (lngLat: { lng: number; lat: number }) => number | null
  }
  const elev = m.queryTerrainElevation?.({ lng, lat }) ?? null
  return typeof elev === 'number' && Number.isFinite(elev) ? elev : null
}
```

In `WaypointCreate.tsx`, replace the inline cast and lookup in the autofill effect with `const elev = queryElevation(map, seedLat, seedLng)` and `if (elev !== null) setElevation(String(Math.round(elev)))`. The existing `WaypointCreate` tests must still pass.

- [x] **Step 5.2.6: Form parsing — test first, `src/panels/DetailPanel/photoForm.test.ts`**

```ts
import { parsePhotoForm, valuesFromPhoto, type PhotoFormValues } from './photoForm'

const base: PhotoFormValues = { name: 'Lone Tree', description: '', bearing: '', takenAt: '', elevation: '' }

describe('parsePhotoForm', () => {
  it('requires a non-blank name', () => {
    expect(parsePhotoForm({ ...base, name: '  ' })).toBeNull()
  })
  it('maps blank optional fields to null', () => {
    expect(parsePhotoForm(base)).toEqual({
      name: 'Lone Tree', description: '', bearing: null, taken_at: null, elevation_m: null,
    })
  })
  it('parses bearing, elevation and taken-at', () => {
    expect(parsePhotoForm({ ...base, bearing: '271', elevation: '1834', takenAt: '2026-02-14T09:31:05' }))
      .toMatchObject({ bearing: 271, elevation_m: 1834, taken_at: new Date(2026, 1, 14, 9, 31, 5).toISOString() })
  })
  it.each(['360', '-1', 'abc'])('rejects bearing %s', (bearing) => {
    expect(parsePhotoForm({ ...base, bearing })).toBeNull()
  })
  it('rejects a non-numeric elevation', () => {
    expect(parsePhotoForm({ ...base, elevation: 'high' })).toBeNull()
  })
  it('wraps 359.6 to 0', () => {
    expect(parsePhotoForm({ ...base, bearing: '359.6' })?.bearing).toBe(0)
  })
})

describe('valuesFromPhoto', () => {
  it('formats stored values for the inputs', () => {
    expect(valuesFromPhoto({
      name: 'A', description: 'd', bearing: 90, elevation_m: 1500.4,
      taken_at: new Date(2026, 1, 14, 9, 31, 5).toISOString(),
    })).toEqual({ name: 'A', description: 'd', bearing: '90', elevation: '1500', takenAt: '2026-02-14T09:31:05' })
  })
})
```

`src/panels/DetailPanel/photoForm.ts`:

```ts
import type { Photo } from '../../types'
import { normalizeBearing } from '../../utils/geo'
import { isoToLocalInput, localInputToIso } from '../../utils/time'

// Raw input text for the photo form. Parsed by parsePhotoForm on save.
export interface PhotoFormValues {
  name: string
  description: string
  bearing: string
  takenAt: string     // datetime-local value
  elevation: string
}

export interface ParsedPhotoForm {
  name: string
  description: string
  bearing: number | null
  taken_at: string | null
  elevation_m: number | null
}

// Null when any field is invalid — the Save button stays disabled.
export function parsePhotoForm(v: PhotoFormValues): ParsedPhotoForm | null {
  const name = v.name.trim()
  if (name === '') return null
  const bearing = parseOptionalNumber(v.bearing)
  if (bearing === undefined || (bearing !== null && (bearing < 0 || bearing >= 360))) return null
  const elevation = parseOptionalNumber(v.elevation)
  if (elevation === undefined) return null
  return {
    name,
    description: v.description,
    bearing: bearing === null ? null : normalizeBearing(bearing),
    taken_at: localInputToIso(v.takenAt),
    elevation_m: elevation,
  }
}

export function valuesFromPhoto(
  p: Pick<Photo, 'name' | 'description' | 'bearing' | 'elevation_m' | 'taken_at'>,
): PhotoFormValues {
  return {
    name: p.name,
    description: p.description,
    bearing: p.bearing === null ? '' : String(p.bearing),
    elevation: p.elevation_m === null ? '' : String(Math.round(p.elevation_m)),
    takenAt: isoToLocalInput(p.taken_at),
  }
}

// '' → null (not set), numeric → number, anything else → undefined (invalid).
function parseOptionalNumber(raw: string): number | null | undefined {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}
```


- [x] **Step 5.2.7: `PhotoFields` and `PhotoPositionFields`**

`src/panels/DetailPanel/PhotoFields.tsx`:

```tsx
import { useId } from 'react'
import shared from './DetailPanel.shared.module.css'
import { CompassRose } from '../../components/CompassRose/CompassRose'
import { normalizeBearing } from '../../utils/geo'
import type { PhotoFormValues } from './photoForm'

interface Props {
  values: PhotoFormValues
  onChange: (patch: Partial<PhotoFormValues>) => void
}

// Metadata fields shared by the photo create and edit forms.
export function PhotoFields({ values, onChange }: Props): JSX.Element {
  const bearingId = useId()
  const typed = values.bearing.trim() === '' ? null : Number(values.bearing)
  const roseBearing = typed !== null && Number.isFinite(typed) ? normalizeBearing(typed) : null

  return (
    <section className={shared.section}>
      <label className={shared.field}>
        <span>Name</span>
        <input value={values.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label className={shared.field}>
        <span>Description</span>
        <textarea rows={3} value={values.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      <div className={shared.field}>
        <label htmlFor={bearingId}>Bearing (°)</label>
        <div className={shared.row}>
          <input
            id={bearingId}
            type="number"
            min={0}
            max={359}
            step={1}
            inputMode="numeric"
            placeholder="unknown"
            value={values.bearing}
            onChange={(e) => onChange({ bearing: e.target.value })}
          />
          <CompassRose bearing={roseBearing} size={72} onChange={(b) => onChange({ bearing: String(b) })} />
        </div>
      </div>
      <label className={shared.field}>
        <span>Taken</span>
        <input
          type="datetime-local"
          step={1}
          value={values.takenAt}
          onChange={(e) => onChange({ takenAt: e.target.value })}
        />
      </label>
      <label className={shared.field}>
        <span>Elevation (m)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="optional"
          value={values.elevation}
          onChange={(e) => onChange({ elevation: e.target.value })}
        />
      </label>
    </section>
  )
}
```

`src/panels/DetailPanel/PhotoPositionFields.tsx`:

```tsx
import { useEffect, useState } from 'react'
import shared from './DetailPanel.shared.module.css'
import { draftNumber, useUiStore } from '../../store/ui'

const fmt = (n: number | null) => (n === null ? '' : n.toFixed(6))

// Lat/lng inputs bound to panel.draft — the same values the draggable map pin
// reads and writes. Typed values commit on blur so partial input ("49.") is
// never pushed to the pin; invalid input reverts to the draft.
export function PhotoPositionFields(): JSX.Element {
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const updateDraft = useUiStore((s) => s.updateDraft)
  const [latText, setLatText] = useState(fmt(lat))
  const [lngText, setLngText] = useState(fmt(lng))

  // A pin drag rewrites the draft; mirror it into the inputs.
  useEffect(() => setLatText(fmt(lat)), [lat])
  useEffect(() => setLngText(fmt(lng)), [lng])

  const commit = (key: 'lat' | 'lng', text: string, limit: number) => {
    const n = Number(text)
    if (text.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit) {
      updateDraft({ [key]: n })
    } else if (key === 'lat') {
      setLatText(fmt(lat))
    } else {
      setLngText(fmt(lng))
    }
  }

  return (
    <div className={shared.row}>
      <label className={shared.field}>
        <span>Latitude</span>
        <input
          inputMode="decimal"
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
          onBlur={(e) => commit('lat', e.target.value, 90)}
        />
      </label>
      <label className={shared.field}>
        <span>Longitude</span>
        <input
          inputMode="decimal"
          value={lngText}
          onChange={(e) => setLngText(e.target.value)}
          onBlur={(e) => commit('lng', e.target.value, 180)}
        />
      </label>
    </div>
  )
}
```

(`updateDraft({ [key]: n })` creates an object with a computed key. If TS rejects it as an `EntityDraft`, use `key === 'lat' ? updateDraft({ lat: n }) : updateDraft({ lng: n })`.)

- [x] **Step 5.2.8: Draggable position pin — test first, `src/map/placement/PhotoPositionMarker.test.tsx`**

```tsx
import { render } from '@testing-library/react'
import { act } from 'react'
import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { PhotoPositionMarker } from './PhotoPositionMarker'

type Marker = InstanceType<typeof __mocks__.MockMarker>
const lastMarker = () => vi.mocked(maplibregl.Marker).mock.results.at(-1)!.value as Marker

describe('PhotoPositionMarker', () => {
  beforeEach(() => {
    vi.mocked(maplibregl.Marker).mockClear()
    act(() => setMap(new __mocks__.MockMap() as never))
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
  })
  afterEach(() => act(() => setMap(null)))

  it('shows a draggable pin at the draft position while editing a photo', () => {
    render(<PhotoPositionMarker />)
    expect(maplibregl.Marker).not.toHaveBeenCalled()
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    expect(marker.options).toMatchObject({ draggable: true })
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-115, 49.5])
    expect(marker.addTo).toHaveBeenCalled()
  })

  it('writes the dropped position into the draft', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    marker.setLngLat({ lng: -115.2, lat: 49.7 })
    act(() => marker.emit('dragend'))
    expect(useUiStore.getState().panel).toMatchObject({ draft: { lat: 49.7, lng: -115.2 } })
  })

  it('removes the pin when the panel leaves edit mode', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    act(() => useUiStore.getState().openEntity('photo', 'p1'))
    expect(marker.remove).toHaveBeenCalled()
  })

  it('ignores waypoint edits', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'waypoint', entityId: 'w1', draft: { lat: 1, lng: 2 } },
    }))
    expect(maplibregl.Marker).not.toHaveBeenCalled()
  })
})
```

`src/map/layers/layerStyles.ts`: add

```ts
// Draggable pin shown while a photo is created or edited. A literal hex
// because maplibregl.Marker paints it into an SVG fill attribute.
export const PHOTO_PIN_COLOR = '#F472B6'
```

`src/map/placement/PhotoPositionMarker.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { draftNumber, useUiStore, type PanelState } from '../../store/ui'
import { PHOTO_PIN_COLOR } from '../layers/layerStyles'

function isPhotoDraft(panel: PanelState): boolean {
  return (panel.mode === 'create' || panel.mode === 'edit') && panel.entityType === 'photo'
}

// While a photo is being created or edited, a draggable pin marks its
// position. Dropping the pin writes lat/lng into the panel draft, which the
// form saves. View mode shows no pin — the position is locked.
export function PhotoPositionMarker(): null {
  const map = useMap()
  const active = useUiStore((s) => isPhotoDraft(s.panel))
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!map || !active) return
    const marker = new maplibregl.Marker({ draggable: true, color: PHOTO_PIN_COLOR })
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      useUiStore.getState().updateDraft({ lat: p.lat, lng: p.lng })
    })
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map, active])

  // Follow the draft: the initial seed, typed coordinates, or a drag commit.
  // Declared after the effect above so the marker exists when this runs.
  useEffect(() => {
    const marker = markerRef.current
    if (!map || !marker) return
    if (lat === null || lng === null) {
      marker.remove()
      return
    }
    marker.setLngLat([lng, lat]).addTo(map)
  }, [map, active, lat, lng])

  return null
}
```

Mount `<PhotoPositionMarker />` in `MapView.tsx` after `<WaypointsLayer />`. Run the test. Expected: PASS.

- [x] **Step 5.2.9: `PhotoCreate` — test first, `src/panels/DetailPanel/PhotoCreate.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { PhotoCreate } from './PhotoCreate'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { PendingPhoto } from '../../types'

const taken = new Date(2026, 1, 14, 9, 31, 5).toISOString()
const pending = (): PendingPhoto => ({
  blob: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
  preview: 'blob:test/preview',
  width: 4096, height: 3072,
  filename: 'IMG_0001.jpg',
  exif: { lat: 49.46, lng: -115.08, altitude_m: 1834.6, bearing: 271, taken_at: taken },
})

function openCreate() {
  act(() => {
    useUiStore.getState().startPhotoPlacement(pending())
    useUiStore.getState().completePlacement(49.46, -115.08)
  })
}

describe('PhotoCreate', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
  })
  afterEach(() => clearStorage())

  it('prefills name from the filename and fields from EXIF', () => {
    openCreate()
    render(<PhotoCreate />)
    expect(screen.getByLabelText('Name')).toHaveValue('IMG_0001')
    expect(screen.getByLabelText('Bearing (°)')).toHaveValue(271)
    expect(screen.getByLabelText('Elevation (m)')).toHaveValue(1835)
    expect(screen.getByLabelText('Taken')).toHaveValue('2026-02-14T09:31:05')
    expect(screen.getByLabelText('Latitude')).toHaveValue('49.460000')
    expect(screen.getByText(/from the photo’s gps/i)).toBeInTheDocument()
  })

  it('saves blob, thumb and row, then opens the new photo in view mode', async () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lone Tree couloir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(usePhotosStore.getState().photos).toHaveLength(1))
    const saved = usePhotosStore.getState().photos[0]
    expect(saved).toMatchObject({
      name: 'Lone Tree couloir', lat: 49.46, lng: -115.08, bearing: 271,
      elevation_m: 1835, taken_at: taken, width: 4096, height: 3072, file_size_bytes: 4,
    })
    expect(await getStorage().getPhotoBlob(saved.id)).not.toBeNull()
    expect(await getStorage().getPhotoThumb(saved.id)).not.toBeNull()
    expect(useUiStore.getState().panel).toEqual({ mode: 'view', entityType: 'photo', entityId: saved.id })
  })

  it('saves the dragged position from the draft', async () => {
    openCreate()
    render(<PhotoCreate />)
    act(() => useUiStore.getState().updateDraft({ lat: 49.5, lng: -115.1 }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(usePhotosStore.getState().photos).toHaveLength(1))
    expect(usePhotosStore.getState().photos[0]).toMatchObject({ lat: 49.5, lng: -115.1 })
  })

  it('disables Save without a name', () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Cancel discards the pending photo', () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useUiStore.getState().panel.mode).toBe('idle')
    expect(usePhotosStore.getState().photos).toHaveLength(0)
  })

  it('shows an error and stays open when saving fails', async () => {
    openCreate()
    render(<PhotoCreate />)
    vi.spyOn(getStorage(), 'savePhoto').mockRejectedValueOnce(new Error('quota'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/saving the photo failed/i)
    expect(useUiStore.getState().panel.mode).toBe('create')
  })
})
```

Run. Expected: FAIL (module missing).

- [x] **Step 5.2.10: Implement `src/panels/DetailPanel/PhotoCreate.tsx`**

```tsx
import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { draftNumber, useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { useMap } from '../../hooks/useMap'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { queryElevation } from '../../map/terrain'
import type { PendingPhoto } from '../../types'
import { isoToLocalInput } from '../../utils/time'
import { parsePhotoForm, type PhotoFormValues } from './photoForm'
import { PhotoFields } from './PhotoFields'
import { PhotoPositionFields } from './PhotoPositionFields'
import { TagPills } from './TagPills'
import { debug } from '../../utils/debug'

function initialValues(pending: PendingPhoto | null): PhotoFormValues {
  const exif = pending?.exif
  return {
    name: pending ? pending.filename.replace(/\.[^.]+$/, '') : '',
    description: '',
    bearing: exif?.bearing == null ? '' : String(exif.bearing),
    takenAt: isoToLocalInput(exif?.taken_at ?? null),
    elevation: exif?.altitude_m == null ? '' : String(Math.round(exif.altitude_m)),
  }
}

// Photo creation form. The pending photo (blobs + EXIF) rides on the create
// panel; lat/lng live in panel.draft so the draggable map pin and the
// coordinate inputs share one source of truth.
export function PhotoCreate(): JSX.Element {
  const pending = useUiStore((s) =>
    s.panel.mode === 'create' && s.panel.entityType === 'photo' ? s.panel.pending : null,
  )
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const closePanel = useUiStore((s) => s.closePanel)
  const openEntity = useUiStore((s) => s.openEntity)
  const add = usePhotosStore((s) => s.add)
  const map = useMap()

  const [values, setValues] = useState<PhotoFormValues>(() => initialValues(pending))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewUrl = useObjectUrl(pending?.blob ?? null)

  // Without EXIF altitude, fall back to the terrain at the pin — once, and
  // only while the field is still blank, so user input is never overwritten.
  useEffect(() => {
    if (!map || lat === null || lng === null) return
    const elev = queryElevation(map, lat, lng)
    if (elev === null) return
    setValues((v) => (v.elevation === '' ? { ...v, elevation: String(Math.round(elev)) } : v))
  }, [map, lat, lng])

  // Guard after all hooks (rules of hooks).
  if (!pending) return <div className={styles.subtle}>Photo placement not active.</div>

  const parsed = parsePhotoForm(values)
  const canSave = parsed !== null && lat !== null && lng !== null && !saving

  const onSave = async () => {
    if (!parsed || lat === null || lng === null) return
    setSaving(true)
    setError(null)
    try {
      const photo = await add(
        {
          user_id: 'local',
          ...parsed,
          lat,
          lng,
          width: pending.width,
          height: pending.height,
          file_size_bytes: pending.blob.size,
          tags: [],
        },
        pending.blob,
        pending.thumb,
      )
      openEntity('photo', photo.id)
    } catch (err) {
      debug('photo create failed', err)
      setError('Saving the photo failed. Check available storage and try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>New photo</h2>
        <div className={styles.actions}>
          <button type="button" onClick={closePanel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {previewUrl && <img src={previewUrl} alt="Photo preview" className={shared.photoPreview} />}
      {error && <p role="alert" className={styles.subtle}>{error}</p>}

      <PhotoFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>
          {pending.exif.lat !== null ? 'From the photo’s GPS.' : 'Placed on the map.'} Drag the pin to adjust.
        </p>
        <PhotoPositionFields />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={[]} />
      </section>
    </>
  )
}
```

Add to `DetailPanel.shared.module.css`:

```css
.photoPreview {
  display: block;
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  background: var(--color-bg-0);
  border-radius: var(--radius-sm);
}
```

`DetailPanel.tsx`: import `PhotoCreate` and replace the photo-create placeholder branch:

```tsx
  } else if (panel.entityType === 'waypoint') {
    body = <WaypointCreate />
  } else {
    body = <PhotoCreate />
  }
```

Run `PhotoCreate.test.tsx` and `DetailPanel.test.tsx`. Expected: PASS. (If `DetailPanel.test.tsx` asserts the old photo-create placeholder text, update it to assert the "New photo" heading, using a full `pending`.)

- [x] **Step 5.2.11: Dev helper to prove EXIF is stripped — `src/dev/devConsole.ts`**

```ts
    // Expected to resolve undefined: stored JPEGs are re-encoded without EXIF.
    async inspectPhotoExif(id: string): Promise<unknown> {
      const blob = await storage.getPhotoBlob(id)
      if (!blob) throw new Error(`no blob for ${id}`)
      return exifr.parse(blob, true)
    },
```

with `import exifr from 'exifr'` at the top. Dev-only, so the `import.meta.env.DEV` guard keeps it out of production builds.

- [x] **Step 5.2.12: Verify**

`npm run typecheck`, `npm test` → green.

Browser:
- Import an iPhone JPEG with GPS. The form shows the preview, IMG_xxxx name, bearing and needle, taken time and elevation. The pink pin sits on the map. Drag it and watch Latitude/Longitude update. Type a longitude and blur, and the pin moves.
- Import a **portrait** iPhone JPEG. The preview is upright.
- Save. The panel switches to view mode (placeholder until 5.4). In DevTools: `await __couloir.listAll()` shows the photo with the dragged lat/lng, and `await __couloir.inspectPhotoExif('<id>')` → `undefined`.
- Import again and press Cancel or ESC. `listAll()` shows no new photo.
- In the no-GPS path, after clicking the map the text reads "Placed on the map", and elevation comes from terrain (with 3D terrain on).

- [x] **Step 5.2.13: Commit and tick**

```bash
git add src TASKS.md
git commit -m "feat(photos): photo creation form with compass rose and draggable pin"
```

Tick 5.2 → `chore(tasks): tick 5.2`.

---

## Task 5.3 — Photos layer with clustering

**Files:**
- Modify: `src/map/layers/layerStyles.ts`, `src/map/layers/wpIcons.ts`
- Create: `src/map/layers/photosLayerData.ts`, `photosLayerData.test.ts`
- Create: `src/map/layers/photoIcons.ts`, `photoIcons.test.ts`
- Create: `src/map/layers/PhotosLayer.tsx`, `PhotosLayer.test.tsx`
- Modify: `src/map/MapView.tsx`

This task ends with: saved photos on the map. At zoom ≤ 13 they show as count circles; above that, or when un-clustered, as framed 48 px thumbnails at their position. Clicking a cluster zooms in until it splits. Clicking a thumbnail opens the photo. The Photos toggle hides all three layers. 100+ photos stay smooth.

- [ ] **Step 5.3.1: Constants in `layerStyles.ts`**

```ts
export const PHOTOS_SOURCE_ID = 'photos-source'
export const PHOTOS_CLUSTERS_LAYER_ID = 'photos-clusters'
export const PHOTOS_CLUSTER_COUNT_LAYER_ID = 'photos-cluster-count'
export const PHOTOS_THUMBNAILS_LAYER_ID = 'photos-thumbnails'
export const PHOTOS_LAYER_IDS = [
  PHOTOS_CLUSTERS_LAYER_ID,
  PHOTOS_CLUSTER_COUNT_LAYER_ID,
  PHOTOS_THUMBNAILS_LAYER_ID,
] as const

// Thumbnail icons are drawn at PHOTO_ICON_PIXEL_RATIO× and registered with
// that pixelRatio, so they render at PHOTO_ICON_PX CSS pixels and stay crisp
// on high-DPI screens.
export const PHOTO_ICON_PX = 48
export const PHOTO_ICON_PIXEL_RATIO = 2
export const PHOTO_PLACEHOLDER_ICON = 'photo-placeholder'

// Cluster circles step from light to deep blue as the count grows.
export const PHOTO_CLUSTER_STEPS = {
  colors: ['#60A5FA', '#3B82F6', '#1D4ED8'] as const,
  radii: [16, 20, 26] as const,
  thresholds: [10, 50] as const,
}
// Maptiler styles serve this glyph stack; the count label needs a font.
export const PHOTO_CLUSTER_FONT = ['Noto Sans Bold']
```

- [ ] **Step 5.3.2: GeoJSON builder — test then implement**

`photosLayerData.test.ts`:

```ts
import { buildPhotosGeoJson, photoIconName } from './photosLayerData'
import type { Photo } from '../../types'

const photo = (id: string, lat: number, lng: number) => ({ id, lat, lng }) as Photo

describe('buildPhotosGeoJson', () => {
  it('emits one point per photo at its position, with id and icon name', () => {
    expect(buildPhotosGeoJson([photo('a', 49.5, -115)])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-115, 49.5] },
        properties: { id: 'a', icon: 'photo-a' },
      }],
    })
  })
  it('names icons by photo id', () => {
    expect(photoIconName('xyz')).toBe('photo-xyz')
  })
})
```

`photosLayerData.ts`:

```ts
import type { Photo } from '../../types'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; icon: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function photoIconName(photoId: string): string {
  return `photo-${photoId}`
}

export function buildPhotosGeoJson(photos: Photo[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: photos.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, icon: photoIconName(p.id) },
    })),
  }
}
```

- [ ] **Step 5.3.3: Framed thumbnail icons — test then implement**

In `wpIcons.ts`, change `function makeEmptyImageData` to `export function makeEmptyImageData` so photo icons share the jsdom fallback.

`photoIcons.test.ts`:

```ts
import { buildPhotoIcon, coverCrop, photoIconSizePx } from './photoIcons'

describe('coverCrop', () => {
  it('centre-crops landscape images to a square', () => {
    expect(coverCrop(128, 96)).toEqual({ sx: 16, sy: 0, size: 96 })
  })
  it('centre-crops portrait images to a square', () => {
    expect(coverCrop(96, 128)).toEqual({ sx: 0, sy: 16, size: 96 })
  })
})

describe('buildPhotoIcon', () => {
  it('returns ImageData sized for the frame + shadow at the icon pixel ratio', () => {
    const img = buildPhotoIcon(null)
    expect(img.width).toBe(photoIconSizePx())
    expect(img.height).toBe(photoIconSizePx())
  })
})
```

`photoIcons.ts`:

```ts
import { PHOTO_ICON_PIXEL_RATIO, PHOTO_ICON_PX } from './layerStyles'
import { makeEmptyImageData } from './wpIcons'

const FRAME_PX = 2   // white border, CSS px
const SHADOW_PX = 3  // room around the tile for the drop shadow, CSS px

export function photoIconSizePx(): number {
  return (PHOTO_ICON_PX + SHADOW_PX * 2) * PHOTO_ICON_PIXEL_RATIO
}

// Centre-crops a width×height image to its largest square.
export function coverCrop(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size }
}

interface IconSource {
  image: CanvasImageSource
  width: number
  height: number
}

// Draws the thumbnail as a square tile with a white frame and drop shadow and
// returns pixels for map.addImage (register with pixelRatio
// PHOTO_ICON_PIXEL_RATIO). A null source draws the placeholder tile shown
// while a thumbnail is still loading. Canvas colours are literals: canvas
// can't read CSS custom properties.
export function buildPhotoIcon(source: IconSource | null): ImageData {
  const px = photoIconSizePx()
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return makeEmptyImageData(px)
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeEmptyImageData(px)

  ctx.scale(PHOTO_ICON_PIXEL_RATIO, PHOTO_ICON_PIXEL_RATIO)
  const o = SHADOW_PX
  const box = PHOTO_ICON_PX
  const inner = box - FRAME_PX * 2

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = SHADOW_PX
  ctx.shadowOffsetY = 1
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(o, o, box, box)
  ctx.shadowColor = 'transparent'

  if (source) {
    const { sx, sy, size } = coverCrop(source.width, source.height)
    ctx.drawImage(source.image, sx, sy, size, size, o + FRAME_PX, o + FRAME_PX, inner, inner)
  } else {
    ctx.fillStyle = '#475569'
    ctx.fillRect(o + FRAME_PX, o + FRAME_PX, inner, inner)
  }
  return ctx.getImageData(0, 0, px, px)
}

// Decodes a stored thumbnail JPEG into a framed map icon.
export async function loadPhotoIcon(thumb: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(thumb)
  try {
    return buildPhotoIcon({ image: bitmap, width: bitmap.width, height: bitmap.height })
  } finally {
    bitmap.close()
  }
}
```

Run both test files. Expected: PASS.

- [ ] **Step 5.3.4: `PhotosLayer` — test first, `PhotosLayer.test.tsx`**

The mock map doesn't render. This test pins down the source config, layer IDs and filters, and the visibility wiring.

```tsx
import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { PhotosLayer } from './PhotosLayer'
import { PHOTO_CLUSTER } from '../../types'

describe('PhotosLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
    usePhotosStore.setState({ photos: [] })
  })
  afterEach(() => act(() => setMap(null)))

  it('adds a clustered source and the three photo layers', () => {
    render(<PhotosLayer />)
    expect(map.addSource).toHaveBeenCalledWith('photos-source', expect.objectContaining({
      type: 'geojson', cluster: true,
      clusterMaxZoom: PHOTO_CLUSTER.clusterMaxZoom, clusterRadius: PHOTO_CLUSTER.clusterRadius,
    }))
    const layers = map.addLayer.mock.calls.map(([l]) => l as { id: string; filter?: unknown })
    expect(layers.map((l) => l.id)).toEqual(['photos-clusters', 'photos-cluster-count', 'photos-thumbnails'])
    expect(layers[0].filter).toEqual(['has', 'point_count'])
    expect(layers[2].filter).toEqual(['!', ['has', 'point_count']])
    expect(map.addImage).toHaveBeenCalledWith('photo-placeholder', expect.anything(), { pixelRatio: 2 })
  })

  it('toggles visibility on every photos-* layer together', () => {
    map.getLayer.mockReturnValue({} as never)
    render(<PhotosLayer />)
    map.setLayoutProperty.mockClear()
    act(() => useUiStore.getState().toggleLayer('photos'))
    for (const id of ['photos-clusters', 'photos-cluster-count', 'photos-thumbnails']) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'none')
    }
    act(() => useUiStore.getState().toggleLayer('photos'))
  })
})
```

(If `map.getLayer.mockReturnValue` is rejected by the `vi.fn(() => null)` type, cast: `(map.getLayer as unknown as ReturnType<typeof vi.fn>).mockReturnValue({})`.)

- [ ] **Step 5.3.5: Implement `src/map/layers/PhotosLayer.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'
import { getStorage } from '../../storage/provider'
import { PHOTO_CLUSTER, type Photo } from '../../types'
import { buildPhotosGeoJson, photoIconName } from './photosLayerData'
import { buildPhotoIcon, loadPhotoIcon } from './photoIcons'
import {
  PHOTO_CLUSTER_FONT,
  PHOTO_CLUSTER_STEPS,
  PHOTO_ICON_PIXEL_RATIO,
  PHOTO_PLACEHOLDER_ICON,
  PHOTOS_CLUSTER_COUNT_LAYER_ID,
  PHOTOS_CLUSTERS_LAYER_ID,
  PHOTOS_LAYER_IDS,
  PHOTOS_SOURCE_ID,
  PHOTOS_THUMBNAILS_LAYER_ID,
} from './layerStyles'
import { debug } from '../../utils/debug'

const ICON_OPTS = { pixelRatio: PHOTO_ICON_PIXEL_RATIO }

function addImageOnce(map: maplibregl.Map, name: string, data: ImageData): void {
  if (!map.hasImage(name)) map.addImage(name, data, ICON_OPTS)
}

function setPhotosData(map: maplibregl.Map, photos: Photo[]): void {
  const src = map.getSource(PHOTOS_SOURCE_ID)
  if (!src || src.type !== 'geojson') return
  ;(src as GeoJSONSource).setData(buildPhotosGeoJson(photos) as never)
}

export function PhotosLayer(): null {
  const map = useMap()
  const photos = usePhotosStore((s) => s.photos)
  const visible = useUiStore((s) => s.layerVisibility.photos)

  // Framed thumbnail pixels by photo id. Survives style swaps (which wipe
  // every map image), so re-registering after a basemap change is
  // synchronous and doesn't re-read OPFS.
  const icons = useRef(new Map<string, ImageData>())

  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(PHOTOS_SOURCE_ID)) return
      addImageOnce(map, PHOTO_PLACEHOLDER_ICON, buildPhotoIcon(null))
      for (const [id, data] of icons.current) addImageOnce(map, photoIconName(id), data)

      const visibility = useUiStore.getState().layerVisibility.photos ? 'visible' : 'none'
      const { colors, radii, thresholds } = PHOTO_CLUSTER_STEPS

      map.addSource(PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: buildPhotosGeoJson(usePhotosStore.getState().photos) as never,
        cluster: true,
        clusterMaxZoom: PHOTO_CLUSTER.clusterMaxZoom,
        clusterRadius: PHOTO_CLUSTER.clusterRadius,
      })
      map.addLayer({
        id: PHOTOS_CLUSTERS_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { visibility },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], colors[0], thresholds[0], colors[1], thresholds[1], colors[2]],
          'circle-radius': ['step', ['get', 'point_count'], radii[0], thresholds[0], radii[1], thresholds[1], radii[2]],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      })
      map.addLayer({
        id: PHOTOS_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': PHOTO_CLUSTER_FONT,
          'text-size': 12,
          'text-allow-overlap': true,
          visibility,
        },
        paint: { 'text-color': '#FFFFFF' },
      })
      map.addLayer({
        id: PHOTOS_THUMBNAILS_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          // Placeholder until the thumbnail is decoded and registered.
          'icon-image': ['coalesce', ['image', ['get', 'icon']], ['image', PHOTO_PLACEHOLDER_ICON]],
          'icon-allow-overlap': true,
          visibility,
        },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    const onClusterClick = async (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const feature = e.features?.[0]
      const clusterId = feature?.properties?.cluster_id
      if (typeof clusterId !== 'number' || feature?.geometry.type !== 'Point') return
      const src = map.getSource(PHOTOS_SOURCE_ID) as GeoJSONSource | undefined
      if (!src) return
      try {
        // The zoom at which this cluster splits — easing there satisfies
        // "click zooms in and the cluster splits naturally".
        const zoom = await src.getClusterExpansionZoom(clusterId)
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
      } catch (err) {
        debug('cluster expansion failed', err)
      }
    }

    const onThumbClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') useUiStore.getState().openEntity('photo', id)
    }

    const onEnter = () => {
      if (useUiStore.getState().placement.mode === 'idle') map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      // Don't clobber the placement-mode crosshair.
      if (useUiStore.getState().placement.mode === 'idle') map.getCanvas().style.cursor = ''
    }

    map.on('click', PHOTOS_CLUSTERS_LAYER_ID, onClusterClick)
    map.on('click', PHOTOS_THUMBNAILS_LAYER_ID, onThumbClick)
    for (const id of [PHOTOS_CLUSTERS_LAYER_ID, PHOTOS_THUMBNAILS_LAYER_ID]) {
      map.on('mouseenter', id, onEnter)
      map.on('mouseleave', id, onLeave)
    }

    return () => {
      map.off('style.load', install)
      map.off('click', PHOTOS_CLUSTERS_LAYER_ID, onClusterClick)
      map.off('click', PHOTOS_THUMBNAILS_LAYER_ID, onThumbClick)
      for (const id of [PHOTOS_CLUSTERS_LAYER_ID, PHOTOS_THUMBNAILS_LAYER_ID]) {
        map.off('mouseenter', id, onEnter)
        map.off('mouseleave', id, onLeave)
      }
    }
  }, [map])

  // Sync data, then decode any thumbnails not yet cached. Each icon is
  // registered as it lands; a final setData forces symbol re-placement so the
  // coalesce expression picks up the new images.
  useEffect(() => {
    if (!map) return
    setPhotosData(map, photos)

    const live = new Set(photos.map((p) => p.id))
    for (const id of [...icons.current.keys()]) {
      if (live.has(id)) continue
      icons.current.delete(id)
      if (map.hasImage(photoIconName(id))) map.removeImage(photoIconName(id))
    }

    const missing = photos.filter((p) => !icons.current.has(p.id))
    if (missing.length === 0) return
    let cancelled = false
    void Promise.allSettled(
      missing.map(async (p) => {
        const thumb = await getStorage().getPhotoThumb(p.id)
        if (!thumb || cancelled) return
        const data = await loadPhotoIcon(thumb)
        if (cancelled) return
        icons.current.set(p.id, data)
        addImageOnce(map, photoIconName(p.id), data)
      }),
    ).then((results) => {
      for (const r of results) if (r.status === 'rejected') debug('photo thumb load failed', r.reason)
      if (!cancelled) setPhotosData(map, usePhotosStore.getState().photos)
    })
    return () => {
      cancelled = true
    }
  }, [map, photos])

  useEffect(() => {
    if (!map) return
    for (const id of PHOTOS_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  return null
}
```

Mount `<PhotosLayer />` in `MapView.tsx` after `<WaypointsLayer />` and before `<PhotoPositionMarker />`. Run the layer tests and the full suite. Expected: PASS. In jsdom, `loadPhotoIcon` rejects (there's no `createImageBitmap`), and `allSettled` absorbs it.

- [ ] **Step 5.3.6: Verify**

`npm run typecheck`, `npm test` → green.

Browser:
- Photos saved in 5.2 show as framed thumbnails at their position when zoomed past 13.
- `await __couloir.createDummyPhotos(120)`, then reload. At zoom 11 you see blue count circles with white numbers. **If the numbers don't render**, the Maptiler style doesn't serve `Noto Sans Bold`. Switch `PHOTO_CLUSTER_FONT` to `['Noto Sans Regular']`, and if that fails too, check the font names in the style's `glyphs` URL.
- Click a cluster → the map eases in and the cluster splits. Click a thumbnail → panel opens (placeholder until 5.4).
- Toggle Photos off and on → all three layers hide and show together.
- Switch basemap → thumbnails come straight back (from the cache), not placeholders.
- With 120+ photos, panning and zooming stay smooth (Performance panel: no long tasks after the initial thumbnail decode).
- Optional cleanup: delete the dummy photos via the viewer after 5.4, or clear site data.

- [ ] **Step 5.3.7: Commit and tick**

```bash
git add src TASKS.md
git commit -m "feat(photos): clustered photos layer with framed thumbnail icons"
```

Tick 5.3 → `chore(tasks): tick 5.3`.

---

## Task 5.4 — Photo viewer

**Files:**
- Modify: `src/utils/format.ts`, `format.test.ts`
- Create: `src/hooks/usePhotoBlobUrl.ts`, `usePhotoBlobUrl.test.tsx`
- Create: `src/panels/DetailPanel/PhotoDetail.tsx`, `PhotoDetail.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.tsx`, `DetailPanel.shared.module.css`

This task ends with: clicking a thumbnail shows the full photo (fit to width, click to toggle actual size with scrolling), name, description, taken date, elevation, bearing with compass, dimensions, location and tags. Edit changes the metadata and position, with the draggable pin. Delete removes the blob, thumbnail and row after confirmation.

- [ ] **Step 5.4.1: Formatters — test then implement**

`format.test.ts`:

```ts
describe('formatBearing', () => {
  it.each([[0, '0° N'], [120, '120° ESE'], [271, '271° W'], [349, '349° N']])('%s → %s', (deg, out) => {
    expect(formatBearing(deg)).toBe(out)
  })
})

describe('formatDateTime', () => {
  it('renders a human date including the year', () => {
    expect(formatDateTime(new Date(2026, 1, 14, 9, 31).toISOString())).toMatch(/2026/)
  })
})
```

`format.ts`:

```ts
const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

// 120 → "120° ESE"
export function formatBearing(degrees: number): string {
  const point = COMPASS_POINTS[Math.round(degrees / 22.5) % 16]
  return `${degrees}° ${point}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
```

- [ ] **Step 5.4.2: `usePhotoBlobUrl` — test then implement**

`usePhotoBlobUrl.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { usePhotoBlobUrl } from './usePhotoBlobUrl'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'

describe('usePhotoBlobUrl', () => {
  let storage: InMemoryStorageProvider
  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
  })
  afterEach(() => clearStorage())

  it('reports missing when no blob is stored', async () => {
    const { result } = renderHook(() => usePhotoBlobUrl('nope'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current.url).toBeNull()
  })

  it('resolves an object URL for a stored blob', async () => {
    vi.spyOn(storage, 'getPhotoBlob').mockResolvedValue(new Blob(['x']))
    const { result } = renderHook(() => usePhotoBlobUrl('p1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.url).toMatch(/^blob:/)
  })
})
```

`usePhotoBlobUrl.ts`:

```ts
import { useEffect, useState } from 'react'
import { getStorage } from '../storage/provider'
import { useObjectUrl } from './useObjectUrl'
import { debug } from '../utils/debug'

export type PhotoLoadStatus = 'loading' | 'ready' | 'missing' | 'error'

// Loads a photo's full-size blob from storage and exposes it as an object
// URL that is revoked when the photo changes or the caller unmounts.
export function usePhotoBlobUrl(photoId: string): { url: string | null; status: PhotoLoadStatus } {
  const [state, setState] = useState<{ blob: Blob | null; status: PhotoLoadStatus }>({
    blob: null,
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    setState({ blob: null, status: 'loading' })
    getStorage().getPhotoBlob(photoId).then(
      (blob) => {
        if (!cancelled) setState({ blob, status: blob ? 'ready' : 'missing' })
      },
      (err: unknown) => {
        debug('photo blob load failed', err)
        if (!cancelled) setState({ blob: null, status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [photoId])

  return { url: useObjectUrl(state.blob), status: state.status }
}
```

- [ ] **Step 5.4.3: `PhotoDetail` — test first, `PhotoDetail.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { PhotoDetail } from './PhotoDetail'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { Photo } from '../../types'

const input = {
  user_id: 'local', name: 'Lone Tree', description: 'North face from the ridge',
  lat: 49.46, lng: -115.08, elevation_m: 1835, bearing: 120,
  width: 4096, height: 3072, file_size_bytes: 4,
  taken_at: new Date(2026, 1, 14, 9, 31).toISOString(), tags: [],
} satisfies Omit<Photo, 'id' | 'created_at' | 'updated_at' | 'blob_ref'>

let photo: Photo

describe('PhotoDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
    photo = await usePhotosStore.getState().add(input, new Blob(['full']), new Blob(['t']))
    useUiStore.setState({ panel: { mode: 'view', entityType: 'photo', entityId: photo.id }, placement: { mode: 'idle' } })
  })
  afterEach(() => clearStorage())

  it('shows the photo and its metadata', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    expect(screen.getByRole('heading', { name: 'Lone Tree' })).toBeInTheDocument()
    expect(screen.getByText('North face from the ridge')).toBeInTheDocument()
    expect(screen.getByText('120° ESE')).toBeInTheDocument()
    expect(screen.getByText('1835 m')).toBeInTheDocument()
    expect(screen.getByText('4096 × 3072')).toBeInTheDocument()
    expect(screen.getByText('49.46000, -115.08000')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Lone Tree' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
  })

  it('Edit seeds the draft with the current position', () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useUiStore.getState().panel).toEqual({
      mode: 'edit', entityType: 'photo', entityId: photo.id, draft: { lat: 49.46, lng: -115.08 },
    })
  })

  it('edit saves metadata and the dragged position', async () => {
    act(() => useUiStore.getState().editCurrent({ lat: 49.46, lng: -115.08 }))
    render(<PhotoDetail photoId={photo.id} mode="edit" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lone Tree NF' } })
    fireEvent.change(screen.getByLabelText('Bearing (°)'), { target: { value: '95' } })
    act(() => useUiStore.getState().updateDraft({ lat: 49.47, lng: -115.09 }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(useUiStore.getState().panel.mode).toBe('view'))
    expect(await getStorage().getPhoto(photo.id)).toMatchObject({
      name: 'Lone Tree NF', bearing: 95, lat: 49.47, lng: -115.09,
    })
  })

  it('Confirm delete removes row and blobs and closes the panel', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(useUiStore.getState().panel.mode).toBe('idle'))
    expect(await getStorage().getPhoto(photo.id)).toBeNull()
    expect(await getStorage().getPhotoBlob(photo.id)).toBeNull()
    expect(await getStorage().getPhotoThumb(photo.id)).toBeNull()
  })
})
```

- [ ] **Step 5.4.4: Implement `src/panels/DetailPanel/PhotoDetail.tsx`**

```tsx
import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { usePhotosStore } from '../../store/photos'
import { draftNumber, useUiStore } from '../../store/ui'
import { usePhotoBlobUrl } from '../../hooks/usePhotoBlobUrl'
import type { Photo } from '../../types'
import { formatBearing, formatDateTime, formatElevationM } from '../../utils/format'
import { CompassRose } from '../../components/CompassRose/CompassRose'
import { parsePhotoForm, valuesFromPhoto, type PhotoFormValues } from './photoForm'
import { PhotoFields } from './PhotoFields'
import { PhotoPositionFields } from './PhotoPositionFields'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'

interface Props {
  photoId: string
  mode: 'view' | 'edit'
}

export function PhotoDetail({ photoId, mode }: Props): JSX.Element {
  const photo = usePhotosStore((s) => s.photos.find((p) => p.id === photoId)) ?? null
  if (!photo) return <div className={styles.subtle}>Photo not found.</div>
  return mode === 'view' ? <PhotoView photo={photo} /> : <PhotoEdit photo={photo} />
}

// Full image, fit to the panel width; click to toggle actual size, in which
// case the frame scrolls.
function PhotoImage({ photo }: { photo: Photo }): JSX.Element {
  const { url, status } = usePhotoBlobUrl(photo.id)
  const [actualSize, setActualSize] = useState(false)

  if (status === 'loading') return <div className={shared.photoFrame}><span className={`${styles.subtle} ${shared.photoStatus}`}>Loading photo…</span></div>
  if (!url) return <div className={shared.photoFrame}><span className={`${styles.subtle} ${shared.photoStatus}`}>The photo file is missing.</span></div>
  return (
    <div className={shared.photoFrame}>
      <img
        src={url}
        alt={photo.name}
        className={actualSize ? shared.photoActual : shared.photoFit}
        title={actualSize ? 'Click to fit' : 'Click for full size'}
        onClick={() => setActualSize((v) => !v)}
      />
    </div>
  )
}

function PhotoView({ photo }: { photo: Photo }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = usePhotosStore((s) => s.remove)

  const handleDelete = async () => {
    try {
      await remove(photo.id)
      closePanel()
    } catch (err) {
      // Phase 6 will replace this with a user-visible error surface.
      debug('photo delete failed', err)
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{photo.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent({ lat: photo.lat, lng: photo.lng })}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      <PhotoImage photo={photo} />

      {photo.description && <p className={styles.subtle}>{photo.description}</p>}

      <section className={shared.section}>
        <div className={shared.row}>
          <div className={shared.metricsGrid} style={{ flex: 1 }}>
            <Metric label="Taken" value={photo.taken_at ? formatDateTime(photo.taken_at) : '—'} />
            <Metric label="Elevation" value={photo.elevation_m === null ? '—' : formatElevationM(photo.elevation_m)} />
            <Metric label="Bearing" value={photo.bearing === null ? '—' : formatBearing(photo.bearing)} />
            <Metric label="Size" value={`${photo.width} × ${photo.height}`} />
          </div>
          {photo.bearing !== null && <CompassRose bearing={photo.bearing} size={64} />}
        </div>
      </section>

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>{photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}</p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={photo.tags} />
      </section>
    </>
  )
}

function PhotoEdit({ photo }: { photo: Photo }): JSX.Element {
  const update = usePhotosStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)
  const updateDraft = useUiStore((s) => s.updateDraft)
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))

  const [values, setValues] = useState<PhotoFormValues>(() => valuesFromPhoto(photo))
  const [error, setError] = useState<string | null>(null)

  // Re-sync if the photo is replaced upstream (e.g. a future sync arrival).
  useEffect(() => setValues(valuesFromPhoto(photo)), [photo.id, photo.updated_at])

  // Edit entered without a seeded position (e.g. a direct editCurrent()):
  // seed it so the pin and inputs have something to show.
  useEffect(() => {
    if (lat === null || lng === null) updateDraft({ lat: photo.lat, lng: photo.lng })
  }, [lat, lng, photo.lat, photo.lng, updateDraft])

  const parsed = parsePhotoForm(values)
  const canSave = parsed !== null && lat !== null && lng !== null

  const onSave = async () => {
    if (!parsed || lat === null || lng === null) return
    setError(null)
    try {
      await update(photo.id, { ...parsed, lat, lng })
      openEntity('photo', photo.id)
    } catch (err) {
      debug('photo save failed', err)
      setError('Saving changes failed. Try again.')
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit photo</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => openEntity('photo', photo.id)}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      {error && <p role="alert" className={styles.subtle}>{error}</p>}

      <PhotoFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>Drag the pin on the map or type coordinates.</p>
        <PhotoPositionFields />
      </section>
    </>
  )
}
```

Add to `DetailPanel.shared.module.css`:

```css
.photoFrame {
  max-height: 360px;
  overflow: auto;
  background: var(--color-bg-0);
  border-radius: var(--radius-sm);
  /* flex-start, not center: a centred tall image can't scroll to its top. */
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 120px;
}

.photoStatus {
  margin: auto;
}

.photoFit {
  display: block;
  width: 100%;
  height: auto;
  cursor: zoom-in;
}

.photoActual {
  display: block;
  max-width: none;
  cursor: zoom-out;
}
```


`DetailPanel.tsx`: import `PhotoDetail` and replace the view/edit photo placeholder:

```tsx
    } else {
      body = <PhotoDetail photoId={panel.entityId} mode={panel.mode} />
    }
```

`UnsupportedPlaceholder` is now unused. Delete it. Run all `DetailPanel` tests. Expected: PASS.

- [ ] **Step 5.4.5: Verify**

`npm run typecheck`, `npm test` → green.

Browser:
- Click a thumbnail. The photo loads fitted; click it to see actual size with scrolling, and click again to fit. Metadata matches what you saved. The compass needle points at the bearing.
- Edit: the pink pin appears at the photo. Drag it, change the bearing, and Save. The view shows the new location, and the thumbnail moves on the map. Reload and the change persisted.
- Edit then ESC → back to view with no change, and the pin disappears.
- Delete → Confirm delete. The thumbnail is gone from the map. In DevTools, `await __couloir.listAll()` no longer lists it. Then run:
  `const d = await navigator.storage.getDirectory(); for await (const n of (await d.getDirectoryHandle('photos')).keys()) console.log(n)`
  Neither `{id}.jpg` nor `{id}_thumb.jpg` is listed.

- [ ] **Step 5.4.6: Commit and tick**

```bash
git add src TASKS.md
git commit -m "feat(photos): photo viewer with edit, reposition and delete"
```

Tick 5.4 → `chore(tasks): tick 5.4`.

---

## Task 5.5 — Photo count badge

**Files:**
- Modify: `src/panels/LayerPanel/LayerPanel.test.tsx` (if not already covered)

The count is already wired (`usePhotosStore((s) => s.photos.length)` in `LayerPanel.tsx`). This task verifies it.

- [ ] **Step 5.5.1: Cover add and delete in the LayerPanel test**

Read the current test. If no photo-count assertion exists, add:

```tsx
  it('tracks the live photo count on add and delete', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const count = () =>
      screen.getByText('Photos').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')
    expect(count()).toBe('0')
    act(() => usePhotosStore.setState({ photos: [{ id: 'p1' } as Photo] }))
    expect(count()).toBe('1')
    act(() => usePhotosStore.setState({ photos: [] }))
    expect(count()).toBe('0')
  })
```

(Add `Photo` to the type import.) Run. Expected: PASS.

- [ ] **Step 5.5.2: Browser smoke-check**

Note the Photos count. Add a photo and save → +1 immediately. Delete it → −1 immediately.

- [ ] **Step 5.5.3: Commit and tick**

```bash
git add src/panels/LayerPanel/LayerPanel.test.tsx TASKS.md
git commit -m "test(photos): cover layer-panel photo count; tick 5.5"
```

---

## Self-review

**Spec coverage** (TASKS.md Phase 5 acceptance criteria, as rewritten in Task 5.0):

| Requirement | Where |
|---|---|
| File picker opens; HEIC rejected with guidance | 5.1 — `AddPhotoButton`, `classifyPhotoFile`, `HEIC_MESSAGE` (unit-tested) |
| EXIF orientation displays upright in preview and on save | 5.1 — `createImageBitmap(..., { imageOrientation: 'from-image' })` in `encodePhoto`; browser-verified in 5.2.12 |
| GPS JPEG auto-flies and drops the pin at the GPS position; bearing/elevation/taken_at prefilled | 5.1 `importPhotoFile` (tested) + 5.2 `PhotoCreate` prefill (tested) |
| No-GPS JPEG uses thumbnail-follow-cursor placement | 5.1 `applyPhotoCursorPreview` (tested) + `PlacementBanner` photo branch |
| ESC cancels and discards the selected photo | Existing `useEscapeKey` → `cancelPlacement` / `closePanel`; preview revocation tested in 5.1.6 |
| Saved OPFS blob contains no EXIF | Canvas re-encode in `encodePhoto`; verified with `__couloir.inspectPhotoExif` in 5.2.12 |
| All form fields save, blob + thumb stored, photo appears immediately, Cancel discards | 5.2 `PhotoCreate.test.tsx` + 5.3 layer sync effect |
| Clusters at ≤13, thumbnails above / un-clustered, cluster click splits, thumbnail click opens | 5.3 `PhotosLayer` (config tested, behaviour browser-verified) |
| Layer toggle hides all photos-* layers | 5.3 `PhotosLayer.test.tsx` |
| 100+ photos perform acceptably | 5.3 — on-demand icon decode, cached across style swaps; `createDummyPhotos(120)` check |
| Viewer shows full photo and metadata; edit saves; pin drag updates storage; delete removes blob/thumb/row | 5.4 `PhotoDetail.test.tsx` + `PhotoPositionMarker.test.tsx` |
| Count badge accurate on add/delete | 5.5 |

**Type consistency:** `PendingPhoto` is defined once (`types/index.ts`) and used by `ui.ts`, `photoImport.ts`, `PhotoCreate.tsx`. `PhotoExif` is produced by `normalizeExif` and consumed by `importPhotoFile` and `PhotoCreate`. `PhotoMetadataPatch` is the `update()` patch type and is enforced by `updatePhotoMetadata`'s column list. The layer IDs in `layerStyles.ts` match ARCHITECTURE.md (`photos-source`, `photos-clusters`, `photos-cluster-count`, `photos-thumbnails`). The icon name pattern `photo-{id}` lives in `photoIconName` and is used by both the GeoJSON builder and `addImage`.

**Known deviations from the original task text** (all recorded in TASKS.md by Task 5.0):
- No subject/camera split. Photos sit where they were taken.
- Orientation is applied by the browser decoder, not by hand.
- Cluster click eases to `getClusterExpansionZoom` rather than fitting leaf bounds. The outcome is the same: the cluster splits.

**Risks to watch during execution:**
- Cluster count glyphs depend on the Maptiler font stack (fallback noted in 5.3.6).
- `addImage` after layout: the final `setData` re-places symbols. If thumbnails still show as placeholders, check that `coalesce`/`image` is supported by the installed MapLibre 4.7 (it is), and that icons register before `setData`.
- `ALTER TABLE … DROP COLUMN` needs SQLite ≥ 3.35. The bundled wa-sqlite has 3.44.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-26-couloir-phase-5-photos.md`. Two execution options:

1. **Subagent-Driven (recommended)**: a fresh subagent per task, with review between tasks.
2. **Inline Execution**: execute tasks in this session with checkpoints.
