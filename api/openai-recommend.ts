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

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ExploreRequestBody = {
  prompt?: string
  agentId?: string
  messages?: ChatMessage[]
  events?: EventSummary[]
}

type ExploreModelResult = {
  reply: string
  suggestedEventId: string | null
  suggestedEventIds?: string[]
  suggestedReplies?: string[]
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

    const parsedSuggestedEventId =
      typeof parsed.suggestedEventId === 'string' && parsed.suggestedEventId.trim()
        ? parsed.suggestedEventId.trim()
        : null
    const suggestedEventIds = normalizeSuggestedEventIds(parsed.suggestedEventIds, parsedSuggestedEventId)

    return {
      reply: parsed.reply.trim(),
      suggestedEventId: suggestedEventIds?.[0] ?? parsedSuggestedEventId,
      suggestedEventIds,
      suggestedReplies: normalizeSuggestedReplies(parsed.suggestedReplies),
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
    'Use only the provided event list when recommending events.',
    'If the latest user turn is a greeting, small talk, an agent-name callout, or too vague to plan from, greet them in character, ask one concise question, and set suggestedEventId to null.',
    'Do not recommend an event until the user gives at least one intent signal such as genre, area, budget, crew, energy, date, or timing.',
    'For follow-ups, use the chat history to resolve references like cheaper, closer, quieter, later, or something else.',
    'When the user is ready for picks, rank 3-5 best-fit events when possible using suggestedEventIds ordered best to worst.',
    'Set suggestedEventId to the first suggestedEventIds item for compatibility.',
    'Only use event IDs from eventCandidates. If fewer than 3 events fit, include only the fitting IDs.',
    'If nothing fits, say so briefly and keep suggestedEventId null.',
    'When your reply asks the user to choose, clarify, or narrow the night, include 2-4 short suggestedReplies the user can tap next.',
    'When your reply is a final recommendation, suggestedReplies can be an empty array.',
    'Respond as strict JSON only (no markdown):',
    '{"reply":"string","suggestedEventId":"string|null","suggestedEventIds":["string"],"suggestedReplies":["string"]}',
    'Keep reply concise, 1-2 sentences, and user-friendly.',
  ].join(' ')
}

function buildEventContext(events: EventSummary[]): string {
  return JSON.stringify({
    market: 'Singapore',
    currentServerTime: new Date().toISOString(),
    eventCandidates: events,
  })
}

function buildChatMessages(prompt: string, events: EventSummary[], messages: ChatMessage[]) {
  const usableMessages = messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)

  return [
    {
      role: 'user' as const,
      content: buildEventContext(events),
    },
    ...(usableMessages.length > 0
      ? usableMessages
      : [
          {
            role: 'user' as const,
            content: prompt,
          },
        ]),
  ]
}

function sanitizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== 'object') return false
      const entry = message as Partial<ChatMessage>
      return (
        (entry.role === 'user' || entry.role === 'assistant') &&
        typeof entry.content === 'string' &&
        entry.content.trim().length > 0
      )
    })
    .slice(-12)
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

  const { prompt, agentId: rawAgentId, messages, events } = parseRequestBody(req.body)
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
  const chatMessages = sanitizeChatMessages(messages)

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
          ...buildChatMessages(prompt, compactEvents, chatMessages),
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
