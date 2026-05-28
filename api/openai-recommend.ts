type BuzoAgentId = 'echo' | 'shade' | 'blaze' | 'noir'

const BUZO_AGENT_IDS: BuzoAgentId[] = ['echo', 'shade', 'blaze', 'noir']

const agentPersonas: Record<BuzoAgentId, string> = {
  echo:
    'You are Echo, a social navigator bat. Prioritize crowd momentum, social proof, and where people are actually going tonight. Speak confident and scene-aware.',
  shade:
    'You are Shade, a hidden-gem hunter bat. Prioritize underground rooms, off-radar venues, and picks that skip tourist traps. Speak selective and insider.',
  blaze:
    'You are Blaze, a peak-energy guide bat. Prioritize high-energy clubs, loud lineups, and main-character nights. Speak bold and urgent.',
  noir:
    'You are Noir, an intimate curator bat. Prioritize jazz lounges, cocktail bars, and low-key credible nights. Speak calm, warm, and precise.',
}

type EventSummary = {
  id: string
  title: string
  venue: string
  district: string
  genre: string
  time: string
  verified: number
  vibeTags: string[]
}

type ExploreRequestBody = {
  prompt?: string
  agentId?: string
  events?: EventSummary[]
}

type ExploreModelResult = {
  reply: string
  suggestedEventId: string | null
}

function parseRequestBody(rawBody: unknown): ExploreRequestBody {
  if (!rawBody) {
    return {}
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as ExploreRequestBody
    } catch {
      return {}
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as ExploreRequestBody
  }

  return {}
}

function parseModelJson(content: string): ExploreModelResult | null {
  const trimmed = content.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fencedMatch?.[1] ?? trimmed

  try {
    const parsed = JSON.parse(source) as Partial<ExploreModelResult>
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      return null
    }

    return {
      reply: parsed.reply.trim(),
      suggestedEventId: typeof parsed.suggestedEventId === 'string' ? parsed.suggestedEventId : null,
    }
  } catch {
    return null
  }
}

function resolveAgentId(raw: string | undefined): BuzoAgentId {
  if (raw && BUZO_AGENT_IDS.includes(raw as BuzoAgentId)) {
    return raw as BuzoAgentId
  }
  return 'echo'
}

function buildSystemPrompt(agentId: BuzoAgentId): string {
  return [
    agentPersonas[agentId],
    'You help users decide what to do tonight in Singapore nightlife.',
    'Use only the provided event list. Recommend exactly one best-match event when possible.',
    'If nothing fits, say so briefly and still stay in character.',
    'Respond as strict JSON only (no markdown):',
    '{"reply":"string","suggestedEventId":"string|null"}',
    'Keep reply concise, 1-2 sentences, and user-friendly.',
  ].join(' ')
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const openAiApiKey = process.env.OPENAI_API_KEY
  if (!openAiApiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' })
    return
  }

  const { prompt, agentId: rawAgentId, events } = parseRequestBody(req.body)
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  const agentId = resolveAgentId(rawAgentId)

  const compactEvents = Array.isArray(events)
    ? events.map((event) => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        district: event.district,
        genre: event.genre,
        time: event.time,
        verified: event.verified,
        vibeTags: event.vibeTags,
      }))
    : []

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-nano'
  const systemPrompt = buildSystemPrompt(agentId)

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify({ prompt, events: compactEvents }),
          },
        ],
      }),
    })

    if (!openAiResponse.ok) {
      const details = await openAiResponse.text()
      res.status(502).json({ error: 'OpenAI request failed', details })
      return
    }

    const payload = (await openAiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      res.status(502).json({ error: 'OpenAI response is empty' })
      return
    }

    const parsed = parseModelJson(content)
    if (!parsed) {
      res.status(502).json({ error: 'Unable to parse OpenAI JSON response' })
      return
    }

    res.status(200).json(parsed)
  } catch (error) {
    res.status(500).json({
      error: 'Unexpected OpenAI proxy error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
