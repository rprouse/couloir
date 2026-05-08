import type { StorageProvider } from './interface'
import { StorageNotInitializedError } from './errors'

let current: StorageProvider | null = null

export function setStorage(provider: StorageProvider): void {
  current = provider
}

export function getStorage(): StorageProvider {
  if (!current) throw new StorageNotInitializedError()
  return current
}

/** Test helper. Resets the module-level singleton between tests. */
export function clearStorage(): void {
  current = null
}
