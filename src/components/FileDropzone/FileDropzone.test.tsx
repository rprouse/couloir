import { render, screen, act } from '@testing-library/react'
import { FileDropzone } from './FileDropzone'

function dragEvent(type: string, files: File[] = []): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types: files.length > 0 ? ['Files'] : [],
    },
  })
  return event
}

describe('FileDropzone', () => {
  it('shows overlay on dragenter and hides on drop', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      document.dispatchEvent(dragEvent('dragenter', [new File([''], 'a.gpx')]))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      document.dispatchEvent(dragEvent('drop', [new File([''], 'a.gpx')]))
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(onFiles).toHaveBeenCalledWith([expect.any(File)])
  })

  it('filters out non-gpx files by default', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(
        dragEvent('drop', [new File([''], 'photo.jpg'), new File([''], 'a.gpx')]),
      )
    })
    expect(onFiles).toHaveBeenCalledOnce()
    const arg = onFiles.mock.calls[0][0] as File[]
    expect(arg).toHaveLength(1)
    expect(arg[0].name).toBe('a.gpx')
  })

  it('does not call onFiles when no accepted files are dropped', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(dragEvent('drop', [new File([''], 'photo.jpg')]))
    })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('ignores drag events with no Files type (e.g. text drags)', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(dragEvent('dragenter', []))
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(onFiles).not.toHaveBeenCalled()
  })
})
