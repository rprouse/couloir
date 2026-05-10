import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './DuplicatePrompt.module.css'
import type { DuplicateDecision, DuplicatePromptArgs } from './gpxImport'

interface QueueItem {
  args: DuplicatePromptArgs
  resolve: (decision: DuplicateDecision) => void
}

export interface DuplicatePromptHandle {
  enqueue: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

interface Props {
  onReady: (handle: DuplicatePromptHandle) => void
}

// React component that exposes its `enqueue` API via the `onReady` callback,
// so the import orchestrator (a plain async function) can await user input.
// Modeled as a queue rather than a single slot to be safe against concurrent
// drops, even though the orchestrator is sequential.
export function DuplicatePrompt({ onReady }: Props): JSX.Element | null {
  const [queue, setQueue] = useState<QueueItem[]>([])

  const enqueue = useCallback((args: DuplicatePromptArgs) => {
    return new Promise<DuplicateDecision>((resolve) => {
      setQueue((q) => [...q, { args, resolve }])
    })
  }, [])

  const handle = useMemo<DuplicatePromptHandle>(() => ({ enqueue }), [enqueue])

  useEffect(() => {
    onReady(handle)
  }, [onReady, handle])

  if (queue.length === 0) return null
  const head = queue[0]
  const { existing, parsed, remainingFiles } = head.args

  const decide = (decision: DuplicateDecision) => {
    head.resolve(decision)
    setQueue((q) => q.slice(1))
  }

  return (
    <DialogShell
      filename={head.args.filename}
      existingName={existing.name}
      parsedName={parsed.name}
      remainingFiles={remainingFiles}
      onDecide={decide}
    />
  )
}

function DialogShell({
  filename,
  existingName,
  parsedName,
  remainingFiles,
  onDecide,
}: {
  filename: string
  existingName: string
  parsedName: string
  remainingFiles: number
  onDecide: (d: DuplicateDecision) => void
}) {
  const [applyToAll, setApplyToAll] = useState(false)
  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-prompt-title"
    >
      <div className={styles.dialog}>
        <h2 id="duplicate-prompt-title" className={styles.title}>
          Already imported: {filename}
        </h2>
        <p className={styles.subtle}>
          A previous import has the same file contents. Existing entry: <strong>{existingName}</strong>.
          Incoming: <strong>{parsedName}</strong>.
        </p>
        {remainingFiles > 0 && (
          <label className={styles.applyAll}>
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <span>Apply to all remaining ({remainingFiles}) files in this drop</span>
          </label>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={() => onDecide({ choice: 'skip', applyToAll })}>
            Skip
          </button>
          <button type="button" onClick={() => onDecide({ choice: 'new-copy', applyToAll })}>
            Import as new copy
          </button>
          <button type="button" onClick={() => onDecide({ choice: 'replace', applyToAll })}>
            Replace
          </button>
        </div>
      </div>
    </div>
  )
}
