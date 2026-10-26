import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { PhotoDetail } from './PhotoDetail'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { Photo } from '../../types'

const input = {
  user_id: 'local', name: 'Lone Tree', description: 'North face from the ridge',
  lat: 49.46, lng: -115.08, elevation_m: 1835, bearing: 120,
  width: 4096, height: 3072, file_size_bytes: 4,
  taken_at: new Date(2026, 1, 14, 9, 31).toISOString(), tags: [],
} satisfies Omit<Photo, 'id' | 'created_at' | 'updated_at' | 'blob_ref'>

let photo: Photo

describe('PhotoDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
    photo = await usePhotosStore.getState().add(input, new Blob(['full']), new Blob(['t']))
    useUiStore.setState({ panel: { mode: 'view', entityType: 'photo', entityId: photo.id }, placement: { mode: 'idle' } })
  })
  afterEach(() => clearStorage())

  it('shows the photo and its metadata', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    expect(screen.getByRole('heading', { name: 'Lone Tree' })).toBeInTheDocument()
    expect(screen.getByText('North face from the ridge')).toBeInTheDocument()
    expect(screen.getByText('120° ESE')).toBeInTheDocument()
    expect(screen.getByText('1835 m')).toBeInTheDocument()
    expect(screen.getByText('4096 × 3072')).toBeInTheDocument()
    expect(screen.getByText('49.46000, -115.08000')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Lone Tree' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
  })

  it('Edit seeds the draft with the current position', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    // Let the async blob load settle so its state update lands inside act.
    await screen.findByRole('img', { name: 'Lone Tree' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useUiStore.getState().panel).toEqual({
      mode: 'edit', entityType: 'photo', entityId: photo.id, draft: { lat: 49.46, lng: -115.08 },
    })
  })

  it('edit saves metadata and the dragged position', async () => {
    act(() => useUiStore.getState().editCurrent({ lat: 49.46, lng: -115.08 }))
    render(<PhotoDetail photoId={photo.id} mode="edit" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lone Tree NF' } })
    fireEvent.change(screen.getByLabelText('Bearing (°)'), { target: { value: '95' } })
    act(() => useUiStore.getState().updateDraft({ lat: 49.47, lng: -115.09 }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(useUiStore.getState().panel.mode).toBe('view'))
    expect(await getStorage().getPhoto(photo.id)).toMatchObject({
      name: 'Lone Tree NF', bearing: 95, lat: 49.47, lng: -115.09,
    })
  })

  it('Confirm delete removes row and blobs and closes the panel', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(useUiStore.getState().panel.mode).toBe('idle'))
    expect(await getStorage().getPhoto(photo.id)).toBeNull()
    expect(await getStorage().getPhotoBlob(photo.id)).toBeNull()
    expect(await getStorage().getPhotoThumb(photo.id)).toBeNull()
  })
})
