import { useRef, useState } from 'react'
import styles from './SettingsPanel.module.css'
import { getStorage } from '../../storage/provider'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useTagsStore } from '../../store/tags'
import { backupFilename, estimateBackupBytes, writeBackup } from '../../features/backup/writeBackup'
import { fileChunks, readBackup } from '../../features/backup/readBackup'
import { prepareImport, summarizeBundle, type PreparedImport } from '../../features/backup/prepareImport'
import { openSaveTarget } from '../../features/backup/saveTarget'
import { makeThumbnail } from '../../utils/image'
import { formatBytes } from '../../utils/format'
import { debug } from '../../utils/debug'

type State =
  | { step: 'idle'; message?: string }
  | { step: 'confirm-export'; estimate: number }
  | { step: 'working'; label: string }
  | { step: 'confirm-import'; prepared: PreparedImport; filename: string }

export function BackupSection(): JSX.Element {
  const [state, setState] = useState<State>({ step: 'idle' })
  const fileRef = useRef<HTMLInputElement | null>(null)

  const askExport = () =>
    setState({
      step: 'confirm-export',
      estimate: estimateBackupBytes({
        routes: useRoutesStore.getState().routes,
        tracks: useTracksStore.getState().tracks,
        waypoints: useWaypointsStore.getState().waypoints,
        photos: usePhotosStore.getState().photos,
        tags: useTagsStore.getState().tags,
      }),
    })

  const runExport = async () => {
    const filename = backupFilename(new Date())
    try {
      // Open the save dialog first, while the click still counts as a user gesture.
      const sink = await openSaveTarget(filename)
      if (!sink) {
        setState({ step: 'idle' })
        return
      }
      setState({ step: 'working', label: 'Exporting…' })
      const manifest = await writeBackup(getStorage(), sink)
      setState({ step: 'idle', message: `Saved ${filename} (${manifest.photo_count} photos).` })
    } catch (err) {
      debug('backup export failed', err)
      setState({ step: 'idle', message: `Export failed: ${String(err)}` })
    }
  }

  const pickFile = async (file: File) => {
    setState({ step: 'working', label: 'Reading backup…' })
    try {
      const prepared = await prepareImport(await readBackup(fileChunks(file)), makeThumbnail)
      setState({ step: 'confirm-import', prepared, filename: file.name })
    } catch (err) {
      debug('backup read failed', err)
      setState({ step: 'idle', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const runImport = async (prepared: PreparedImport) => {
    setState({ step: 'working', label: 'Restoring…' })
    try {
      await getStorage().importAll(prepared.bundle, prepared.photos, prepared.thumbs)
      await Promise.all([
        useRoutesStore.getState().load(), useTracksStore.getState().load(),
        useWaypointsStore.getState().load(), usePhotosStore.getState().load(), useTagsStore.getState().load(),
      ])
      const notes = [
        prepared.regeneratedThumbs > 0 ? `${prepared.regeneratedThumbs} thumbnails rebuilt` : '',
        prepared.droppedPhotos > 0 ? `${prepared.droppedPhotos} photos skipped (image missing)` : '',
      ].filter(Boolean)
      setState({ step: 'idle', message: `Restore complete.${notes.length ? ` ${notes.join('; ')}.` : ''}` })
    } catch (err) {
      debug('backup restore failed', err)
      setState({ step: 'idle', message: `Restore failed: ${String(err)}` })
    }
  }

  return (
    <div className={styles.column}>
      {state.step === 'idle' && (
        <>
          <div className={styles.row}>
            <button type="button" onClick={askExport}>Export backup…</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          </div>
          {state.message && <p role="status" className={styles.subtle}>{state.message}</p>}
        </>
      )}
      {state.step === 'confirm-export' && (
        <div className={styles.column}>
          <p className={styles.subtle}>{`Backup will be ~${formatBytes(state.estimate)}. Continue?`}</p>
          <div className={styles.row}>
            <button type="button" onClick={() => void runExport()}>Continue</button>
            <button type="button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      {state.step === 'working' && <p role="status" className={styles.subtle}>{state.label}</p>}
      {state.step === 'confirm-import' && (
        <div className={styles.column}>
          <p className={styles.subtle}>
            {`${state.filename}: ${summarizeBundle(state.prepared.bundle)}.`}
          </p>
          <p className={styles.subtle}>
            Restore from backup? Existing entities will be updated when the backup&apos;s data is newer; new entities will be added.
          </p>
          <div className={styles.row}>
            <button type="button" onClick={() => void runImport(state.prepared)}>Restore</button>
            <button type="button" onClick={() => setState({ step: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: 'none' }}
        data-testid="restore-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pickFile(file)
        }}
      />
    </div>
  )
}
