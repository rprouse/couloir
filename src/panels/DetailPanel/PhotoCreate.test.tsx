import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { PhotoCreate } from './PhotoCreate'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { PendingPhoto } from '../../types'

const taken = new Date(2026, 1, 14, 9, 31, 5).toISOString()
const pending = (): PendingPhoto => ({
  blob: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
  preview: 'blob:test/preview',
  width: 4096, height: 3072,
  filename: 'IMG_0001.jpg',
  exif: { lat: 49.46, lng: -115.08, altitude_m: 1834.6, bearing: 271, taken_at: taken },
})

function openCreate() {
  act(() => {
    useUiStore.getState().startPhotoPlacement(pending())
    useUiStore.getState().completePlacement(49.46, -115.08)
  })
}

describe('PhotoCreate', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
  })
  afterEach(() => clearStorage())

  it('prefills name from the filename and fields from EXIF', () => {
    openCreate()
    render(<PhotoCreate />)
    expect(screen.getByLabelText('Name')).toHaveValue('IMG_0001')
    expect(screen.getByLabelText('Bearing (°)')).toHaveValue(271)
    expect(screen.getByLabelText('Elevation (m)')).toHaveValue(1835)
    // jsdom's datetime-local sanitizer appends ".000"; browsers keep the shortest form.
    expect((screen.getByLabelText('Taken') as HTMLInputElement).value).toMatch(/^2026-02-14T09:31:05(\.000)?$/)
    expect(screen.getByLabelText('Latitude')).toHaveValue('49.460000')
    expect(screen.getByText(/from the photo’s gps/i)).toBeInTheDocument()
  })

  it('saves blob, thumb and row, then opens the new photo in view mode', async () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lone Tree couloir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(usePhotosStore.getState().photos).toHaveLength(1))
    const saved = usePhotosStore.getState().photos[0]
    expect(saved).toMatchObject({
      name: 'Lone Tree couloir', lat: 49.46, lng: -115.08, bearing: 271,
      elevation_m: 1835, taken_at: taken, width: 4096, height: 3072, file_size_bytes: 4,
    })
    expect(await getStorage().getPhotoBlob(saved.id)).not.toBeNull()
    expect(await getStorage().getPhotoThumb(saved.id)).not.toBeNull()
    expect(useUiStore.getState().panel).toEqual({ mode: 'view', entityType: 'photo', entityId: saved.id })
  })

  it('saves the dragged position from the draft', async () => {
    openCreate()
    render(<PhotoCreate />)
    act(() => useUiStore.getState().updateDraft({ lat: 49.5, lng: -115.1 }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(usePhotosStore.getState().photos).toHaveLength(1))
    expect(usePhotosStore.getState().photos[0]).toMatchObject({ lat: 49.5, lng: -115.1 })
  })

  it('disables Save without a name', () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Cancel discards the pending photo', () => {
    openCreate()
    render(<PhotoCreate />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useUiStore.getState().panel.mode).toBe('idle')
    expect(usePhotosStore.getState().photos).toHaveLength(0)
  })

  it('shows an error and stays open when saving fails', async () => {
    openCreate()
    render(<PhotoCreate />)
    vi.spyOn(getStorage(), 'savePhoto').mockRejectedValueOnce(new Error('quota'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/saving the photo failed/i)
    expect(useUiStore.getState().panel.mode).toBe('create')
  })
})
