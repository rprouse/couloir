import { create } from 'zustand'
import type { Photo, PhotoMetadataPatch } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewPhotoInput = Omit<Photo, 'id' | 'created_at' | 'updated_at' | 'blob_ref'>

interface PhotosState {
  photos: Photo[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewPhotoInput, blob: Blob, thumb: Blob) => Promise<Photo>
  update: (id: string, patch: PhotoMetadataPatch) => Promise<Photo>
  remove: (id: string) => Promise<void>
}

export const usePhotosStore = create<PhotosState>((set, get) => ({
  photos: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const photos = await getStorage().getPhotos()
      set({ photos, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input, blob, thumb) => {
    const id = newId()
    const ts = now()
    const photo: Photo = {
      ...input,
      id,
      blob_ref: `photos/${id}.jpg`,
      created_at: ts,
      updated_at: ts,
    }
    await getStorage().savePhoto(photo, blob, thumb)
    set((s) => ({ photos: [...s.photos, photo] }))
    return photo
  },

  update: async (id, patch) => {
    const existing = get().photos.find((p) => p.id === id)
    if (!existing) throw new Error(`photo ${id} not found`)
    const updated: Photo = { ...existing, ...patch, updated_at: now() }
    await getStorage().updatePhotoMetadata(updated)
    set((s) => ({ photos: s.photos.map((p) => (p.id === id ? updated : p)) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deletePhoto(id)
    set((s) => ({ photos: s.photos.filter((p) => p.id !== id) }))
  },
}))
