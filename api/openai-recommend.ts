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
  events?: EventSummary[]
}

type ExploreModelResult = {
  reply: string
  suggestedEventId: string | null
  locationQuery: string | null
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
      locationQuery: typeof parsed.locationQuery === 'string' ? parsed.locationQuery : null,
    }
  } catch {
    return null
  }
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

  const { prompt, events } = parseRequestBody(req.body)
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

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
  const systemPrompt = [
    'You are Buzo assistant for nightlife discovery.',
    'Use the provided event list to recommend exactly one best-match event if possible.',
    'Respond as strict JSON only (no markdown):',
    '{"reply":"string","suggestedEventId":"string|null","locationQuery":"string|null"}',
    'Keep reply concise, 1-2 sentences, and user-friendly.',
    'locationQuery should be a short geocoding query like "Tiong Bahru Singapore" when relevant.',
  ].join(' ')

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
