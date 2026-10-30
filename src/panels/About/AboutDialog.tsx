import { useEffect, useRef } from 'react'
import styles from './AboutDialog.module.css'
import { useUiStore } from '../../store/ui'
import skierPhoto from '../../assets/about-skier.jpg'

const LICENSE_URL = 'https://github.com/rprouse/couloir/blob/main/LICENSE'

export function AboutDialog(): JSX.Element | null {
  const open = useUiStore((s) => s.aboutOpen)
  const setOpen = useUiStore((s) => s.setAboutOpen)
  const closeRef = useRef<HTMLButtonElement>(null)

  // ESC closes the dialog. Captured on document so the global ESC handler
  // (placement / detail panel, on window) doesn't also act on the same press.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, setOpen])

  if (!open) return null
  const close = () => setOpen(false)

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <div className={styles.text}>
          <header className={styles.brand}>
            <img className={styles.icon} src="/icons/icon.svg" alt="" />
            <h2 id="about-title" className={styles.title}>Couloir</h2>
          </header>
          <p className={styles.tagline}>Backcountry ski route library and trip planner</p>
          <p>
            Couloir keeps your backcountry skiing in one place: planned routes, recorded
            tracks, terrain waypoints and recon photos, all on a map. Plan an objective on
            3D terrain with slope-angle and aspect overlays, and check it against
            Avalanche Canada ATES ratings.
          </p>
          <p>
            It's built for Canadian terrain, from the Coast Mountains and the Selkirks to
            the Rockies. Made for skiers, by skiers, to plan their next adventure.
          </p>
          <p className={styles.caveat}>
            Couloir is a planning aid. It doesn't replace avalanche training, the daily
            avalanche forecast or your judgement in the field.
          </p>
          <footer className={styles.footer}>
            <span>
              © {new Date().getFullYear()} Rob Prouse ·{' '}
              <a href={LICENSE_URL} target="_blank" rel="noreferrer">MIT License</a>
            </span>
            <button ref={closeRef} type="button" className={styles.close} onClick={close}>
              Close
            </button>
          </footer>
        </div>
        <img
          className={styles.photo}
          src={skierPhoto}
          alt="A skier in an orange jacket making a powder turn below snow-covered trees"
        />
      </div>
    </div>
  )
}
