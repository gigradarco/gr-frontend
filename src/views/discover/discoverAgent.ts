import type { BuzoAgentId } from '../../config/buzoAgents'
import type { EventItem } from '../../types'

export type DiscoverAgentResult = {
  reply: string
  suggestedEventId: string | null
  suggestedEventIds?: string[]
  suggestedReplies?: string[]
}

export type DiscoverChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function normalizePrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\?/g, ' ?')
}

function normalizeSuggestedReplies(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const replies = value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .slice(0, 4)

  return replies.length > 0 ? replies : undefined
}

function normalizeSuggestedEventIds(value: unknown, primaryEventId: string | null): string[] | undefined {
  const ids = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : []
  const ranked = Array.from(new Set(ids.length > 0 ? ids : primaryEventId ? [primaryEventId] : [])).slice(0, 5)
  return ranked.length > 0 ? ranked : undefined
}

export async function fetchOpenAIDiscoverResult(
  prompt: string,
  agentId: BuzoAgentId,
  eventList: EventItem[],
  messages: DiscoverChatMessage[] = [],
): Promise<DiscoverAgentResult | null> {
  try {
    const response = await fetch(import.meta.env.VITE_OPENAI_PROXY_URL ?? '/api/openai-recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        agentId,
        messages,
        events: eventList.map((event) => ({
          id: event.id,
          title: event.title,
          venue: event.venue,
          district: event.district,
          genre: event.genre,
          time: event.time,
          verified: event.verified,
          vibeTags: event.vibeTags,
        })),
      }),
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as Partial<DiscoverAgentResult>
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
      return null
    }

    const parsedSuggestedEventId =
      typeof payload.suggestedEventId === 'string' && payload.suggestedEventId.trim()
        ? payload.suggestedEventId.trim()
        : null
    const suggestedEventIds = normalizeSuggestedEventIds(payload.suggestedEventIds, parsedSuggestedEventId)

    return {
      reply: payload.reply.trim(),
      suggestedEventId: suggestedEventIds?.[0] ?? parsedSuggestedEventId,
      suggestedEventIds,
      suggestedReplies: normalizeSuggestedReplies(payload.suggestedReplies),
    }
  } catch {
    return null
  }
}
