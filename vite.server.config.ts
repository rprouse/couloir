import { defineConfig } from 'vite'

// Bundles server/main.ts (and the shared src/storage code it imports) into a
// single ESM file. noExternal inlines hono, so the runtime image needs no
// node_modules. Kept separate from vite.config.ts so the React and PWA
// plugins never run against the server build.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'main.js' } },
  },
  ssr: { noExternal: true },
})
