export function debug(...args: unknown[]): void {
  if (localStorage.getItem('couloir_debug') === '1') {
    console.log('[couloir]', ...args)
  }
}
