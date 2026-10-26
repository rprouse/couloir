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
