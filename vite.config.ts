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
      // HMR and the storage worker never fight a stale cache.
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
        // App shell + every emitted chunk, including the storage worker and
        // the wa-sqlite .wasm. Map tiles are deliberately not cached (post-MVP).
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,webmanifest}'],
        // The main chunk is ~1.5 MB and the wasm is large; Workbox's 2 MB
        // default would silently skip them.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { port: 5173 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['wa-sqlite'] },
})
