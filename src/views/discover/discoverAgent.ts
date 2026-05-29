import type { BuzoAgentId } from '../../config/buzoAgents'
import type { EventItem } from '../../types'

export type DiscoverAgentResult = {
  reply: string
  suggestedEventId: string | null
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

    return {
      reply: payload.reply.trim(),
      suggestedEventId: typeof payload.suggestedEventId === 'string' ? payload.suggestedEventId : null,
    }
  } catch {
    return null
  }
}
