// Saves text as a file through a temporary object URL and <a download>, which
// works on plain-HTTP LAN addresses (no secure-context API needed).
export function downloadText(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Give the download a moment to start before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
