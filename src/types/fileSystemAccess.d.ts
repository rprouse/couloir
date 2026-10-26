// Minimal File System Access API surface used by backup export. Chrome/Edge
// only; callers feature-detect `window.showSaveFilePicker`. lib.dom already
// declares FileSystemFileHandle.createWritable and the writable stream.
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
