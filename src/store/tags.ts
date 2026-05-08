import { create } from 'zustand'
import type { EntityType, Tag } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewTagInput = Omit<Tag, 'id' | 'created_at'>

interface TagsState {
  tags: Tag[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewTagInput) => Promise<Tag>
  update: (id: string, patch: Partial<Omit<Tag, 'id' | 'created_at'>>) => Promise<Tag>
  remove: (id: string) => Promise<void>
  setEntityTags: (entityType: EntityType, entityId: string, tagIds: string[]) => Promise<void>
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const tags = await getStorage().getTags()
      set({ tags, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const tag: Tag = { ...input, id: newId(), created_at: now() }
    await getStorage().saveTag(tag)
    set((s) => ({ tags: [...s.tags, tag] }))
    return tag
  },

  update: async (id, patch) => {
    const existing = get().tags.find((t) => t.id === id)
    if (!existing) throw new Error(`tag ${id} not found`)
    const updated: Tag = { ...existing, ...patch }
    await getStorage().saveTag(updated)
    set((s) => ({ tags: s.tags.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteTag(id)
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }))
  },

  setEntityTags: async (entityType, entityId, tagIds) => {
    await getStorage().setEntityTags(entityType, entityId, tagIds)
  },
}))
