import { splitDroppedFiles } from './dropRouting'

describe('splitDroppedFiles', () => {
  it('sends GPX and KMZ files to their own imports, ignoring the rest', () => {
    const files = ['a.gpx', 'Tunnel Creek South.kmz', 'B.GPX', 'notes.txt', 'c.KMZ', 'd.kml'].map(
      (name) => new File([''], name),
    )
    const { gpx, kmz } = splitDroppedFiles(files)
    expect(gpx.map((f) => f.name)).toEqual(['a.gpx', 'B.GPX'])
    expect(kmz.map((f) => f.name)).toEqual(['Tunnel Creek South.kmz', 'c.KMZ'])
  })
})
