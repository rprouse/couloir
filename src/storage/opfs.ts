import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import type { StorageProvider } from './interface'
import { WorkerClient } from './workerClient'
import StorageWorker from './workerHost?worker'

export class OPFSStorageProvider implements StorageProvider {
  private client: WorkerClient
  // Once closed, the worker is terminated; further calls would hang forever
  // waiting for replies. Track the state so close() is safely idempotent.
  private closed = false

  constructor() {
    this.client = new WorkerClient(new StorageWorker())
  }

  async init(): Promise<void> {
    await this.client.init()
  }

  async close(): Promise<void> {
    if (this.closed) return
    await this.client.close()
    this.client.terminate()
    this.closed = true
  }

  // --- Routes ---------------------------------------------------------------
  // Implemented in Task 2.2.
  getRoutes(): Promise<Route[]> { throw new Error('not implemented') }
  getRoute(_id: string): Promise<Route | null> { throw new Error('not implemented') }
  saveRoute(_route: Route): Promise<void> { throw new Error('not implemented') }
  deleteRoute(_id: string): Promise<void> { throw new Error('not implemented') }
  getRouteBySourceHash(_h: string): Promise<Route | null> { throw new Error('not implemented') }

  // --- Tracks ---------------------------------------------------------------
  getTracks(): Promise<Track[]> { throw new Error('not implemented') }
  getTrack(_id: string): Promise<Track | null> { throw new Error('not implemented') }
  saveTrack(_track: Track): Promise<void> { throw new Error('not implemented') }
  deleteTrack(_id: string): Promise<void> { throw new Error('not implemented') }
  getTrackBySourceHash(_h: string): Promise<Track | null> { throw new Error('not implemented') }

  // --- Waypoints ------------------------------------------------------------
  getWaypoints(): Promise<Waypoint[]> { throw new Error('not implemented') }
  getWaypoint(_id: string): Promise<Waypoint | null> { throw new Error('not implemented') }
  saveWaypoint(_w: Waypoint): Promise<void> { throw new Error('not implemented') }
  deleteWaypoint(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Photos ---------------------------------------------------------------
  getPhotos(): Promise<Photo[]> { throw new Error('not implemented') }
  getPhoto(_id: string): Promise<Photo | null> { throw new Error('not implemented') }
  savePhoto(_p: Photo, _b: Blob, _t: Blob): Promise<void> { throw new Error('not implemented') }
  getPhotoBlob(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  getPhotoThumb(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  deletePhoto(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Tags -----------------------------------------------------------------
  getTags(): Promise<Tag[]> { throw new Error('not implemented') }
  saveTag(_t: Tag): Promise<void> { throw new Error('not implemented') }
  deleteTag(_id: string): Promise<void> { throw new Error('not implemented') }
  setEntityTags(_t: EntityType, _id: string, _ids: string[]): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Backup ---------------------------------------------------------------
  exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    throw new Error('not implemented')
  }
  importAll(
    _b: ExportBundle,
    _p: Map<string, Blob>,
    _t: Map<string, Blob>,
  ): Promise<void> {
    throw new Error('not implemented')
  }
}
