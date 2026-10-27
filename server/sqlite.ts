import { createRequire } from 'node:module'

// node:sqlite is a prefix-only builtin. Vitest 2's module runner strips the
// `node:` prefix from every import except `node:test` and then fails to find
// a package called "sqlite", so a static import can't be used. Loading it
// through require goes straight to Node's loader and works the same under
// Vitest, the Vite dev server and the bundled production server.
const require = createRequire(import.meta.url)

export const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
export type DatabaseSync = import('node:sqlite').DatabaseSync
