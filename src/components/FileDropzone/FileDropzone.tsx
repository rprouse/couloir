import { useEffect, useState } from 'react'
import styles from './FileDropzone.module.css'

interface Props {
  onFiles: (files: File[]) => void
  // Predicate so the dropzone can filter by extension without hard-coding
  // .gpx — Phase 5 reuses this component for image drops.
  accept?: (file: File) => boolean
  label?: string
}

const defaultAccept = (file: File): boolean =>
  file.name.toLowerCase().endsWith('.gpx')

export function FileDropzone({
  onFiles,
  accept = defaultAccept,
  label = 'Drop GPX files to import',
}: Props): JSX.Element {
  const [active, setActive] = useState(false)
  // Counter rather than boolean to handle dragenter/leave bouncing across
  // child elements: every dragenter increments, every dragleave decrements,
  // overlay stays visible while the count > 0.
  const [, setDepth] = useState(0)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth((d) => {
        const next = d + 1
        if (next === 1) setActive(true)
        return next
      })
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      // Required to allow `drop` to fire.
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth((d) => {
        const next = Math.max(0, d - 1)
        if (next === 0) setActive(false)
        return next
      })
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth(0)
      setActive(false)
      const all = Array.from(e.dataTransfer?.files ?? [])
      const accepted = all.filter(accept)
      if (accepted.length > 0) onFiles(accepted)
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [onFiles, accept])

  if (!active) return <></>
  return (
    <div role="status" aria-live="polite" className={styles.overlay}>
      <div className={styles.label}>{label}</div>
    </div>
  )
}

function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  for (let i = 0; i < types.length; i++) if (types[i] === 'Files') return true
  return false
}
