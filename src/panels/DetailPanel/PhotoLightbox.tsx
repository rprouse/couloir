import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './PhotoLightbox.module.css'

interface Props {
  url: string
  alt: string
  onClose: () => void
}

// Full-window photo viewer. Opens fitted to the window; clicking the photo
// toggles actual size, where the overlay scrolls. Escape, the close button,
// or a click on the backdrop closes it.
export function PhotoLightbox({ url, alt, onClose }: Props): JSX.Element {
  const [actualSize, setActualSize] = useState(false)

  // Capture phase on window runs before useEscapeKey's bubble-phase handler;
  // stopping propagation keeps Escape from also closing the detail panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={actualSize ? `${styles.overlay} ${styles.scrolling}` : styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <img
        src={url}
        alt={alt}
        className={actualSize ? styles.actual : styles.fit}
        title={actualSize ? 'Click to fit the window' : 'Click for actual size'}
        onClick={() => setActualSize((v) => !v)}
      />
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close photo">
        ×
      </button>
    </div>,
    document.body,
  )
}
