import { useRef } from 'react'
import { sha256Hex } from '../../utils/hash'
import { parseGpx } from '../../utils/gpx'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { getStorage } from '../../storage/provider'
import { importGpxFiles, type DuplicateDecision, type DuplicatePromptArgs } from './gpxImport'
import { showImportSummaryToast } from './importToast'

interface Props {
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export function ImportButton({ promptDuplicate }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        Import GPX
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Reset so picking the same file twice fires onChange again.
          e.target.value = ''
          void runImport(files, promptDuplicate)
        }}
      />
    </>
  )
}

// Exported separately so the FileDropzone path can call the same code.
export async function runImport(
  files: File[],
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>,
): Promise<void> {
  const summary = await importGpxFiles(files, {
    parseGpx,
    hashBytes: sha256Hex,
    lookupRouteByHash: (h) => getStorage().getRouteBySourceHash(h),
    lookupTrackByHash: (h) => getStorage().getTrackBySourceHash(h),
    saveRoute: useRoutesStore.getState().add,
    saveTrack: useTracksStore.getState().add,
    replaceRoute: useRoutesStore.getState().update,
    replaceTrack: useTracksStore.getState().update,
    promptDuplicate,
  })
  showImportSummaryToast(summary)
}
