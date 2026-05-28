import type { BuzoAgentId } from '../../config/buzoAgents'
import type { EventItem } from '../../types'

export type DiscoverAgentResult = {
  reply: string
  suggestedEventId: string | null
}

export function normalizePrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\?/g, ' ?')
}

const agentFallbackReplies: Record<
  BuzoAgentId,
  { jazz: string; techno: string; default: string }
> = {
  echo: {
    jazz: 'Crowd momentum is building around Tiong Bahru jazz tonight.',
    techno: 'People are stacking Marina Bay for techno — this is the room.',
    default: 'Neon Pulse has the strongest social pull tonight.',
  },
  shade: {
    jazz: 'Found a low-key jazz room in Tiong Bahru — off the usual circuit.',
    techno: 'There is a credible techno room in Marina Bay that is not the obvious tourist pick.',
    default: 'Neon Pulse is the off-radar move worth the trip tonight.',
  },
  blaze: {
    jazz: 'Even jazz heads are out — Tiong Bahru has the hottest session tonight.',
    techno: 'Peak energy is in Marina Bay tonight. Go now.',
    default: 'Neon Pulse is the loudest credible move tonight.',
  },
  noir: {
    jazz: 'Tiong Bahru jazz is the intimate pick tonight — no tourist traps.',
    techno: 'If you want energy, Marina Bay techno works — but keep it tight.',
    default: 'Neon Pulse is a strong all-round pick without the tourist chaos.',
  },
}

export function getHardcodedAgentFallback(
  prompt: string,
  agentId: BuzoAgentId,
): DiscoverAgentResult {
  const normalizedPrompt = normalizePrompt(prompt)
  const voice = agentFallbackReplies[agentId]

  if (normalizedPrompt.includes('jazz')) {
    return {
      reply: voice.jazz,
      suggestedEventId: 'bluenote',
    }
  }

  if (normalizedPrompt.includes('techno')) {
    return {
      reply: voice.techno,
      suggestedEventId: 'marquee',
    }
  }

  return {
    reply: voice.default,
    suggestedEventId: 'neonpulse',
  }
}

export async function fetchOpenAIDiscoverResult(
  prompt: string,
  agentId: BuzoAgentId,
  eventList: EventItem[],
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
