import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { strToU8, zipSync } from 'fflate'
import { BackupSection } from './BackupSection'
import { usePhotosStore } from '../../store/photos'
import { useRoutesStore } from '../../store/routes'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import * as saveTarget from '../../features/backup/saveTarget'
import type { Photo } from '../../types'

describe('BackupSection', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => usePhotosStore.setState({ photos: [{ id: 'p1', file_size_bytes: 5_000_000, tags: [] } as unknown as Photo] }))
  })
  afterEach(() => { clearStorage(); vi.restoreAllMocks() })

  it('shows the size estimate before exporting', () => {
    render(<BackupSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    expect(screen.getByText(/Backup will be ~4\.\d MB\. Continue\?/)).toBeInTheDocument()
  })

  it('cancelling the save dialog returns to idle', async () => {
    const open = vi.spyOn(saveTarget, 'openSaveTarget').mockResolvedValue(null)
    render(<BackupSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export backup…' })).toBeInTheDocument())
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^couloir-backup-\d{4}-\d{2}-\d{2}\.zip$/))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('confirms before restoring, then reloads the slices', async () => {
    const ts = '2026-02-14T12:00:00.000Z'
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8(JSON.stringify({
        bundle_version: 1, app_version: 'x', exported_at: ts,
        routes: [{ id: 'r1', user_id: 'local', name: 'Restored', description: '', geojson: { type: 'LineString', coordinates: [] },
          source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
          distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, tags: [], created_at: ts, updated_at: ts }],
        tracks: [], waypoints: [], photos: [], tags: [], entity_tags: [],
      })),
    })
    render(<BackupSection />)
    const input = screen.getByTestId('restore-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([zip], 'b.zip', { type: 'application/zip' })] } })
    expect(await screen.findByText(/Restore from backup\? Existing entities will be updated/)).toBeInTheDocument()
    expect(screen.getByText(/1 route/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(useRoutesStore.getState().routes.map((r) => r.name)).toEqual(['Restored']))
  })
})
