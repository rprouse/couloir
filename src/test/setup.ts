import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

vi.mock('maplibre-gl', () => import('./mocks/maplibre-gl'))

afterEach(() => {
  cleanup()
})

// jsdom 25 ships a Blob polyfill that lacks `.text()` and `.arrayBuffer()`,
// even though both methods are on the Blob/File prototype in real browsers
// and in Node 18+ globals. Patch them in test-only so production code can
// call the native APIs without a feature-detection branch.
if (typeof Blob !== 'undefined') {
  const proto = Blob.prototype as Blob & {
    text?: () => Promise<string>
    arrayBuffer?: () => Promise<ArrayBuffer>
  }
  if (typeof proto.text !== 'function') {
    proto.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(this)
      })
    }
  }
  if (typeof proto.arrayBuffer !== 'function') {
    proto.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.readAsArrayBuffer(this)
      })
    }
  }
}

// jsdom doesn't implement object URLs. Inert stand-ins let code that mints
// and revokes previews run under test; tests spy on them where it matters.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0
  URL.createObjectURL = () => `blob:test/${++n}`
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}
