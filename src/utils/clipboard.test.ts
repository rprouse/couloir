import { copyText } from './clipboard'

describe('copyText', () => {
  const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  function setSecure(secure: boolean, writeText?: (t: string) => Promise<void>) {
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: writeText ? { writeText } : undefined,
      configurable: true,
    })
  }

  afterEach(() => {
    if (originalSecure) Object.defineProperty(window, 'isSecureContext', originalSecure)
    else delete (window as { isSecureContext?: boolean }).isSecureContext
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else delete (navigator as { clipboard?: Clipboard }).clipboard
    delete (document as { execCommand?: unknown }).execCommand
  })

  it('uses the Clipboard API in a secure context', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    setSecure(true, writeText)
    await expect(copyText('49.5, -115')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('49.5, -115')
  })

  it('falls back to execCommand on plain HTTP', async () => {
    setSecure(false)
    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')?.value ?? ''
      return true
    })
    await expect(copyText('49.5, -115')).resolves.toBe(true)
    expect(copied).toBe('49.5, -115')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('resolves false when nothing can copy', async () => {
    setSecure(false)
    document.execCommand = vi.fn(() => false)
    await expect(copyText('x')).resolves.toBe(false)
  })
})
