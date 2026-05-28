import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const backend = 'http://127.0.0.1:8787'

/** So local Wrangler can build `redirect_to` as `http://localhost:5173/api/auth/callback` (PKCE cookies match). */
const toBackend: ProxyOptions = {
  target: backend,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      const host = req.headers.host
      if (typeof host === 'string' && host.length > 0) {
        proxyReq.setHeader('X-Forwarded-Host', host)
      }
      proxyReq.setHeader('X-Forwarded-Proto', 'http')
    })
  },
}

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'GOOGLE_MAPS_EMBED_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('/framer-motion/')) return 'vendor-motion'
          if (id.includes('/@tanstack/') || id.includes('/@trpc/')) return 'vendor-api'
          if (id.includes('/lucide-react/')) return 'vendor-icons'
          if (
            id.includes('/maplibre-gl/') ||
            id.includes('/react-map-gl/') ||
            id.includes('/@vis.gl/react-maplibre/') ||
            id.includes('/supercluster/')
          ) {
            return 'vendor-maplibre'
          }
          if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) return 'vendor-map'
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/trpc': toBackend,
      '/api/admin': toBackend,
      '/api/discover': toBackend,
      '/api/image-proxy': toBackend,
      '/api/source-preview': toBackend,
      '/api/auth': toBackend,
      '/api/profile/taste': toBackend,
      '/api/profile': toBackend,
      '/health': toBackend,
    },
  },
})
