import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Node 25+ ships a built-in localStorage global that shadows jsdom's and is
// unusable without --localstorage-file. Turn it off in the test workers so
// jsdom's implementation is the one tests see. Guarded so older Node, which
// doesn't know the flag, isn't handed an unknown option.
const workerExecArgv = process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : []

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    poolOptions: {
      forks: { execArgv: workerExecArgv },
      threads: { execArgv: workerExecArgv },
    },
  },
})
