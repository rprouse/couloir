import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'

export interface StorageProvider {
  /** Open the database, run pending migrations, and prepare for use. */
  init(): Promise<void>

  /** Release resources. Idempotent. */
  close(): Promise<void>

  // Routes
  getRoutes(): Promise<Route[]>
  getRoute(id: string): Promise<Route | null>
  saveRoute(route: Route): Promise<void>
  deleteRoute(id: string): Promise<void>
  getRouteBySourceHash(hash: string): Promise<Route | null>

  // Tracks
  getTracks(): Promise<Track[]>
  getTrack(id: string): Promise<Track | null>
  saveTrack(track: Track): Promise<void>
  deleteTrack(id: string): Promise<void>
  getTrackBySourceHash(hash: string): Promise<Track | null>

  // Waypoints
  getWaypoints(): Promise<Waypoint[]>
  getWaypoint(id: string): Promise<Waypoint | null>
  saveWaypoint(waypoint: Waypoint): Promise<void>
  deleteWaypoint(id: string): Promise<void>

  // Photos
  getPhotos(): Promise<Photo[]>
  getPhoto(id: string): Promise<Photo | null>
  savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void>
  getPhotoBlob(id: string): Promise<Blob | null>
  getPhotoThumb(id: string): Promise<Blob | null>
  deletePhoto(id: string): Promise<void>

  // Tags
  getTags(): Promise<Tag[]>
  saveTag(tag: Tag): Promise<void>
  deleteTag(id: string): Promise<void>
  setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void>

  // Backup (in-memory shape; ZIP packaging lives in Phase 6.4)
  exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }>
  importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void>
}
