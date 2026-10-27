import type { Plugin } from 'vite'
import { getRequestListener } from '@hono/node-server'

// Typed locally rather than imported from ./devApp, so the Vite config's
// tsconfig doesn't pull the whole server graph into its project.
interface DevAppModule {
  createDevApp(): Promise<{ fetch(request: Request): Response | Promise<Response> }>
}

// Mounts the Hono API inside the Vite dev server so `npm run dev` serves the
// SPA and /api from one process. The app module is loaded through
// ssrLoadModule on each request, so edits under server/ apply without a restart.
// Dev data lives in ./data (or DATA_DIR), git-ignored.
export function couloirApi(): Plugin {
  return {
    name: 'couloir-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const mod = (await server.ssrLoadModule('/server/devApp.ts')) as DevAppModule
          await getRequestListener((await mod.createDevApp()).fetch)(req, res)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}
