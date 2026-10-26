import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { PhotoDetail } from './PhotoDetail'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { useTagsStore } from '../../store/tags'
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
    useTagsStore.setState({ tags: [], loading: false, error: null })
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

  it('opens the photo full-window and closes it with Escape without closing the panel', async () => {
    function Harness() {
      useEscapeKey()
      return <PhotoDetail photoId={photo.id} mode="view" />
    }
    render(<Harness />)
    fireEvent.click(await screen.findByRole('img', { name: 'Lone Tree' }))

    const dialog = screen.getByRole('dialog', { name: 'Lone Tree' })
    const full = within(dialog).getByRole('img', { name: 'Lone Tree' })
    expect(full).toHaveAttribute('title', 'Click for actual size')
    fireEvent.click(full)
    expect(full).toHaveAttribute('title', 'Click to fit the window')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useUiStore.getState().panel.mode).toBe('view')
  })

  it('closes the full-window view from the close button', async () => {
    render(<PhotoDetail photoId={photo.id} mode="view" />)
    fireEvent.click(await screen.findByRole('img', { name: 'Lone Tree' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close photo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
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

  it('edit assigns a tag and persists it', async () => {
    act(() => useTagsStore.setState({ tags: [{ id: 'tag1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    act(() => useUiStore.getState().editCurrent({ lat: 49.46, lng: -115.08 }))
    render(<PhotoDetail photoId={photo.id} mode="edit" />)
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await getStorage().getPhoto(photo.id))?.tags).toEqual(['tag1']))
  })
})
