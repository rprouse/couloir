import type { Plugin } from 'vite'
import { getRequestListener } from '@hono/node-server'

// Typed locally rather than imported from ./app, so the Vite config's
// tsconfig doesn't pull the whole server graph into its project.
interface ApiModule {
  createApp(): { fetch(request: Request): Response | Promise<Response> }
}

// Mounts the Hono API inside the Vite dev server so `npm run dev` serves the
// SPA and /api from one process. The app module is loaded through
// ssrLoadModule on each request, so edits under server/ apply without a restart.
export function couloirApi(): Plugin {
  return {
    name: 'couloir-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const mod = (await server.ssrLoadModule('/server/app.ts')) as ApiModule
          await getRequestListener(mod.createApp().fetch)(req, res)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}
