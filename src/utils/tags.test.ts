import { countTagUsage, filterByTags, nextTagColor, readableTextColor, validateTagInput } from './tags'
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
