import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, useState } from 'react'
import { TagPicker } from './TagPicker'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'

function Harness({ initial = [] as string[], spy = vi.fn() }) {
  const [value, setValue] = useState<string[]>(initial)
  return <TagPicker value={value} onChange={(v) => { setValue(v); spy(v) }} />
}

describe('TagPicker', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    act(() => useTagsStore.setState({
      tags: [
        { id: 't1', name: 'Steep', color: '#EF4444', created_at: '' },
        { id: 't2', name: 'North', color: '#2A7BE0', created_at: '' },
      ],
    }))
  })
  afterEach(() => clearStorage())

  it('toggles existing tags on and off', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    expect(spy).toHaveBeenLastCalledWith(['t1'])
    expect(screen.getByRole('button', { name: 'Steep' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    expect(spy).toHaveBeenLastCalledWith([])
  })

  it('creates and selects a new tag inline', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.change(screen.getByPlaceholderText('New tag'), { target: { value: 'Couloir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(useTagsStore.getState().tags).toHaveLength(3))
    const created = useTagsStore.getState().tags.find((t) => t.name === 'Couloir')!
    expect(spy).toHaveBeenLastCalledWith([created.id])
  })

  it('selects the existing tag instead of creating a duplicate', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.change(screen.getByPlaceholderText('New tag'), { target: { value: 'steep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(['t1']))
    expect(useTagsStore.getState().tags).toHaveLength(2)
  })
})
