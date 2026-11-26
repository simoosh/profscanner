import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative paths: the build works from any sub-folder (GitHub Pages project sites, etc.).
  base: './',
  build: {
    // html-to-docx (~1.7 MB) is a lazily-loaded chunk, fetched only on the first Word export.
    chunkSizeWarningLimit: 1800,
  },
  server: {
    host: true,
    port: 5173,
    // File-change events are unreliable on some Windows drives: poll so edits are always picked up.
    watch: { usePolling: true, interval: 300 },
  }
})
