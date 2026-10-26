import type { BackupSink } from './writeBackup'

// Where an export goes. With the File System Access API (Chrome/Edge) the ZIP
// streams straight to the chosen file; otherwise chunks collect into a Blob
// that downloads when the sink closes. Returns null if the user cancels the
// save dialog. Must be called from a user gesture (the picker requires one).
export async function openSaveTarget(filename: string): Promise<BackupSink | null> {
  if (window.showSaveFilePicker) {
    let handle: FileSystemFileHandle
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Couloir backup', accept: { 'application/zip': ['.zip'] } }],
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
      throw err
    }
    const writable = await handle.createWritable()
    return {
      write: (chunk) => writable.write(chunk),
      close: () => writable.close(),
      abort: () => writable.abort(),
    }
  }

  const parts: Uint8Array<ArrayBuffer>[] = []
  return {
    write: async (chunk) => { parts.push(chunk) },
    close: async () => {
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      // Give the download a moment to start before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
  }
}
