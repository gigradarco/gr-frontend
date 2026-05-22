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
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/trpc': toBackend,
      '/api/admin': toBackend,
      '/api/discover': toBackend,
      '/api/source-preview': toBackend,
      '/api/auth': toBackend,
      '/api/profile/taste': toBackend,
      '/api/profile': toBackend,
      '/health': toBackend,
    },
  },
})
