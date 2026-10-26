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
