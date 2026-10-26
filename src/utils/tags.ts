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

// OR semantics: an entity shows when it carries any selected tag. An empty
// selection means "no filter" and returns the input array unchanged.
export function filterByTags<T extends { tags: string[] }>(items: T[], tagIds: readonly string[]): T[] {
  if (tagIds.length === 0) return items
  const wanted = new Set(tagIds)
  return items.filter((it) => it.tags.some((t) => wanted.has(t)))
}
