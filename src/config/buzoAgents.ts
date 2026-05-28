export const BUZO_AGENT_IDS = ['echo', 'shade', 'blaze', 'noir'] as const

export type BuzoAgentId = (typeof BUZO_AGENT_IDS)[number]

export type BuzoAgent = {
  id: BuzoAgentId
  /** Bat name shown in chat */
  name: string
  /** Short persona label */
  title: string
  /** One-line hook on the picker card */
  tagline: string
  /** Longer copy for selection screen */
  description: string
  accent: string
  /** POC avatar glyph — replace with art later */
  glyph: string
}

export const buzoAgents: BuzoAgent[] = [
  {
    id: 'echo',
    name: 'Echo',
    title: 'Social Navigator',
    tagline: 'Reads the room before you arrive',
    description:
      'Tracks crowd momentum and social proof. Best when you want to know where people are actually going tonight.',
    accent: '#3b82f6',
    glyph: '🦇',
  },
  {
    id: 'shade',
    name: 'Shade',
    title: 'Hidden Gem Hunter',
    tagline: 'Off-radar spots worth the trip',
    description:
      'Digs past the obvious listings. Best when you want underground rooms, small rooms, and non-tourist picks.',
    accent: '#8b5cf6',
    glyph: '🌑',
  },
  {
    id: 'blaze',
    name: 'Blaze',
    title: 'Peak Energy Guide',
    tagline: 'Main-character nights only',
    description:
      'Optimizes for peak-hour clubs and high-energy lineups. Best when you want the loudest, most electric move.',
    accent: '#f97316',
    glyph: '⚡',
  },
  {
    id: 'noir',
    name: 'Noir',
    title: 'Intimate Curator',
    tagline: 'Low-key, no tourist traps',
    description:
      'Favors jazz lounges, cocktail bars, and date-night energy. Best when you want something chill but credible.',
    accent: '#14b8a6',
    glyph: '🌙',
  },
]

const agentById = new Map(buzoAgents.map((agent) => [agent.id, agent]))

export function isBuzoAgentId(value: string): value is BuzoAgentId {
  return (BUZO_AGENT_IDS as readonly string[]).includes(value)
}

export function getBuzoAgent(id: BuzoAgentId): BuzoAgent {
  const agent = agentById.get(id)
  if (!agent) {
    throw new Error(`Unknown Buzo agent: ${id}`)
  }
  return agent
}

export function getBuzoAgentOrNull(id: string | null | undefined): BuzoAgent | null {
  if (!id || !isBuzoAgentId(id)) {
    return null
  }
  return agentById.get(id) ?? null
}
