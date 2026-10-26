import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { TagManager } from './TagManager'
import { useTagsStore } from '../../store/tags'
import { useWaypointsStore } from '../../store/waypoints'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Waypoint } from '../../types'

const wp = (id: string, tags: string[]) => ({ id, tags }) as Waypoint

describe('TagManager', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => {
      useTagsStore.setState({ tags: [{ id: 't1', name: 'Steep', color: '#EF4444', created_at: '' }] })
      useWaypointsStore.setState({ waypoints: [wp('w1', ['t1']), wp('w2', ['t1'])] })
    })
  })
  afterEach(() => clearStorage())

  it('lists tags with their usage count', () => {
    render(<TagManager />)
    const row = screen.getByRole('listitem')
    expect(within(row).getByDisplayValue('Steep')).toBeInTheDocument()
    expect(within(row).getByText('2 uses')).toBeInTheDocument()
  })

  it('creates a tag', async () => {
    render(<TagManager />)
    fireEvent.change(screen.getByLabelText('New tag name'), { target: { value: 'North' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }))
    await waitFor(() => expect(useTagsStore.getState().tags.map((t) => t.name)).toContain('North'))
  })

  it('rejects a duplicate name', () => {
    render(<TagManager />)
    fireEvent.change(screen.getByLabelText('New tag name'), { target: { value: 'steep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/)
  })

  it('renames on blur', async () => {
    render(<TagManager />)
    const input = screen.getByDisplayValue('Steep')
    fireEvent.change(input, { target: { value: 'Very steep' } })
    fireEvent.blur(input)
    await waitFor(() => expect(useTagsStore.getState().tags[0].name).toBe('Very steep'))
  })

  it('asks before deleting a tag that is in use', async () => {
    render(<TagManager />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Steep' }))
    expect(screen.getByText("Tag 'Steep' is used by 2 entities. Delete?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(useTagsStore.getState().tags).toHaveLength(0))
    expect(useWaypointsStore.getState().waypoints[0].tags).toEqual([])
  })
})
