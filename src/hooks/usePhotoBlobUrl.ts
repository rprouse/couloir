import { useEffect, useState } from 'react'
import { getStorage } from '../storage/provider'
import { useObjectUrl } from './useObjectUrl'
import { debug } from '../utils/debug'

export type PhotoLoadStatus = 'loading' | 'ready' | 'missing' | 'error'

// Loads a photo's full-size blob from storage and exposes it as an object
// URL that is revoked when the photo changes or the caller unmounts.
export function usePhotoBlobUrl(photoId: string): { url: string | null; status: PhotoLoadStatus } {
  const [state, setState] = useState<{ blob: Blob | null; status: PhotoLoadStatus }>({
    blob: null,
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    setState({ blob: null, status: 'loading' })
    getStorage().getPhotoBlob(photoId).then(
      (blob) => {
        if (!cancelled) setState({ blob, status: blob ? 'ready' : 'missing' })
      },
      (err: unknown) => {
        debug('photo blob load failed', err)
        if (!cancelled) setState({ blob: null, status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [photoId])

  return { url: useObjectUrl(state.blob), status: state.status }
}
