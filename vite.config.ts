import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { couloirApi } from './server/devPlugin'

export default defineConfig({
  plugins: [
    react(),
    couloirApi(),
    VitePWA({
      registerType: 'autoUpdate',
      // The service worker is only built for production; dev stays SW-free so
      // HMR never fights a stale cache.
      devOptions: { enabled: false },
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Couloir',
        short_name: 'Couloir',
        description: 'Personal backcountry ski route library',
        theme_color: '#0e1014',
        background_color: '#0e1014',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + every emitted chunk. Map tiles and /api data are
        // deliberately not cached (offline use is post-MVP).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The main chunk (mostly MapLibre) is ~1.5 MB, close to Workbox's 2 MB
        // default, which would silently drop it from the precache if it grew.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // /api is the server's; the shell must never stand in for it.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: { port: 5173 },
})
