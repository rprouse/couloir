// Files dropped on the map: GPX goes to the route/track import, KMZ to the
// ATES import (src/features/ates). Anything else is ignored.
export function splitDroppedFiles(files: File[]): { gpx: File[]; kmz: File[] } {
  const ext = (f: File) => f.name.toLowerCase().split('.').pop()
  return {
    gpx: files.filter((f) => ext(f) === 'gpx'),
    kmz: files.filter((f) => ext(f) === 'kmz'),
  }
}
