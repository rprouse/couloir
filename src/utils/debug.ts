const ENABLED =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('couloir_debug') === '1'

export function debug(...args: unknown[]): void {
  if (ENABLED) console.log('[couloir]', ...args)
}
