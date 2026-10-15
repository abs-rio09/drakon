import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The browser only talks to Vite (one origin). Vite forwards /api/* to the
    // Go server and keeps the /api prefix, because the Go routes start with it.
    // In production the Cloudflare Worker does the same job.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
