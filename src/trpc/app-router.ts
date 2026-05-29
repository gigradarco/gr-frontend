import { initTRPC } from '@trpc/server'
import { z } from 'zod'

/**
 * Shape mirror of gr-backend `appRouter` for client-side typing only.
 * Keeps procedure paths aligned with the backend; this file is not imported at runtime (type-only).
 */
const t = initTRPC.create()

type PlanEventListItem = {
  id: string
  title: string
  venue: string
  district: string
  category: string
  categoryId: string
  locationCityId: string
  eventDateTime: string | null
  displayDateTimeLabel: string
  imageUrl: string
  host: string
  summary: string
  tags: string[]
  ticketPrice: string
  lat: number | null
  lng: number | null
  plannedAt: string
}

type PlanHistoryPage = {
  items: PlanEventListItem[]
  total: number
  limit: number
  offset: number
  nextOffset: number | null
}

export const appRouter = t.router({
  discover: t.router({
    recommend: t.procedure
      .input(
        z.object({
          prompt: z.string(),
          agentId: z.enum(['echo', 'shade', 'blaze', 'noir']),
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ).optional(),
          events: z.array(z.unknown()),
        }),
      )
      .mutation(() => ({
        reply: '',
        suggestedEventId: null as string | null,
        suggestedEventIds: [] as string[],
        suggestedReplies: [] as string[],
      })),
    matchAgent: t.procedure
      .input(z.object({ prompt: z.string() }))
      .mutation(() => ({
        agentId: 'echo' as 'echo' | 'shade' | 'blaze' | 'noir',
        reason: '',
      })),
  }),
  events: t.router({
    list: t.procedure
      .input(
        z.object({
          cityId: z.string().optional(),
          categoryId: z.string().optional(),
        }),
      )
      .query(() => [] as unknown[]),
    byId: t.procedure.input(z.object({ id: z.string() })).query(() => null as unknown),
  }),
  plan: t.router({
    ids: t.procedure.query(() => ({ ids: [] as string[] })),
    upcoming: t.procedure.query(() => [] as PlanEventListItem[]),
    past: t.procedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional(),
      )
      .query(() => ({
        items: [] as PlanEventListItem[],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: null as number | null,
      }) satisfies PlanHistoryPage),
    add: t.procedure
      .input(z.object({ eventId: z.string() }))
      .mutation(() => ({ eventId: '' })),
    remove: t.procedure
      .input(z.object({ eventId: z.string() }))
      .mutation(() => ({ eventId: '' })),
  }),
  profile: t.router({
    get: t.procedure
      .input(z.object({ userId: z.string().optional() }))
      .query(() => null as unknown),
    update: t.procedure
      .input(
        z.object({
          displayName: z.string().optional(),
          username: z.string().optional(),
          bio: z.string().optional(),
          avatarUrl: z.string().url().optional(),
          tasteLabels: z.array(z.string()).optional(),
        }),
      )
      .mutation(() => ({
        display_name: '',
        username: '',
        bio: '',
        avatar_url: '',
      })),
    checkUsername: t.procedure
      .input(z.object({ username: z.string() }))
      .mutation(() => ({ available: true })),
    reputation: t.procedure.query(() => ({
      badges: [] as Array<{
        id: string
        code: string
        name: string
        icon_key: string
        sort_order: number
        unlock_hint: string
        status: 'locked' | 'in_progress' | 'earned'
        progress_value: number
        progress_target: number
        earned_at: string | null
      }>,
    })),
  }),
  stripe: t.router({
    createCheckout: t.procedure
      .input(
        z.object({
          priceId: z.string(),
          successUrl: z.string().url(),
          cancelUrl: z.string().url(),
        }),
      )
      .mutation(() => ({ sessionId: '' as string, url: null as string | null })),

    cancelSubscription: t.procedure
      .mutation(() => ({
        cancel_at_period_end: true,
        current_period_end: 0,
      })),

    reactivateSubscription: t.procedure
      .mutation(() => ({
        cancel_at_period_end: false,
        current_period_end: 0,
      })),

    getBillingInfo: t.procedure
      .query(() => ({
        subscription_tier: 'free' as string,
        subscription_id: null as string | null,
        subscription_status: null as string | null,
        current_period_end: null as number | null,
        cancel_at_period_end: null as boolean | null,
        invoices: [] as Array<{
          id: string
          amount_paid: number
          currency: string
          status: string
          description: string | null
          period_start: number
          period_end: number
          invoice_pdf: string | null
          hosted_invoice_url: string | null
          created: number
        }>,
      })),
  }),
})

export type AppRouter = typeof appRouter
