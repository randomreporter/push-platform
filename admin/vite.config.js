import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production (Render), the Express server serves the admin SPA directly,
// so no proxy is needed — the browser talks to the same origin.
// VITE_API_URL is only needed if you ever deploy admin separately.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/sdk': { target: 'http://localhost:3001', changeOrigin: true },
    }
  },
  build: {
    outDir: 'dist',
  },
  define: {
    // Exposes VITE_API_URL to the React app (empty string = same-origin)
    '__API_BASE__': JSON.stringify(process.env.VITE_API_URL || ''),
  }
})
