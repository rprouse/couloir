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
