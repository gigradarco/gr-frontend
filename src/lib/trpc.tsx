import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../trpc/app-router'
import { apiBase } from './api-base'
import { consumeOAuthHash, getAccessToken } from './session'

export const api = createTRPCReact<AppRouter>()

export function TrpcProvider({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  const [authReady, setAuthReady] = useState(false)
  const [client] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${apiBase()}/trpc`,
          async headers() {
            const token = getAccessToken()
            if (!token) return {}
            return { Authorization: `Bearer ${token}` }
          },
        }),
      ],
    }),
  )

  useEffect(() => {
    let cancelled = false
    const forceReady = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true)
    }, 12_000)

    ;(async () => {
      try {
        // TrpcProvider mounts before AuthSync. Consume OAuth hash here so callback tokens
        // are available before tRPC starts sending Authorization headers.
        consumeOAuthHash()
      } catch (e) {
        console.warn('[gigradar] OAuth callback token parsing failed.', e)
      } finally {
        if (!cancelled) {
          window.clearTimeout(forceReady)
          setAuthReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(forceReady)
    }
  }, [])

  if (!authReady) {
    return (
      <div className="tab-suspense-fallback" aria-busy="true" aria-label="Loading">
        Loading…
      </div>
    )
  }

  return (
    <api.Provider client={client} queryClient={queryClient}>
      {children}
    </api.Provider>
  )
}
