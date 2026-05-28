import { BUZO_AGENT_IDS, getBuzoAgent, type BuzoAgentId } from './buzoAgents'

export type AdvisorQuestionId = 'priority' | 'company' | 'energy'

export type AdvisorAnswers = Partial<Record<AdvisorQuestionId, string>>

type AgentWeights = Partial<Record<BuzoAgentId, number>>

export type AdvisorQuestionOption = {
  id: string
  label: string
  sub: string
  weights: AgentWeights
}

export type AdvisorQuestion = {
  id: AdvisorQuestionId
  prompt: string
  options: AdvisorQuestionOption[]
}

export const buzoAdvisorQuestions: AdvisorQuestion[] = [
  {
    id: 'priority',
    prompt: 'What matters most tonight?',
    options: [
      {
        id: 'crowd',
        label: 'Follow the crowd',
        sub: 'Where momentum is building',
        weights: { echo: 3, blaze: 1 },
      },
      {
        id: 'hidden',
        label: 'Find a hidden gem',
        sub: 'Off-radar, worth the trip',
        weights: { shade: 3 },
      },
      {
        id: 'peak',
        label: 'Go all out',
        sub: 'Peak energy, main-character night',
        weights: { blaze: 3, echo: 1 },
      },
      {
        id: 'chill',
        label: 'Keep it intimate',
        sub: 'Low-key but still credible',
        weights: { noir: 3, shade: 1 },
      },
    ],
  },
  {
    id: 'company',
    prompt: 'Who are you going with?',
    options: [
      {
        id: 'solo',
        label: 'Solo or flexible',
        sub: 'Open to wherever reads best',
        weights: { shade: 2, noir: 1 },
      },
      {
        id: 'friends',
        label: 'Friends or group',
        sub: 'Need a social room with pull',
        weights: { echo: 3, blaze: 1 },
      },
      {
        id: 'date',
        label: 'Date or plus-one',
        sub: 'Conversation-friendly vibe',
        weights: { noir: 3, shade: 1 },
      },
    ],
  },
  {
    id: 'energy',
    prompt: 'How much energy do you want?',
    options: [
      {
        id: 'low',
        label: 'Low-key',
        sub: 'Lounges, jazz, conversation',
        weights: { noir: 3 },
      },
      {
        id: 'medium',
        label: 'Balanced',
        sub: 'Fun without chaos',
        weights: { echo: 2, shade: 2 },
      },
      {
        id: 'high',
        label: 'High voltage',
        sub: 'Clubs, loud, late',
        weights: { blaze: 3, echo: 1 },
      },
    ],
  },
]

const advisorReasons: Record<BuzoAgentId, string> = {
  echo: 'You want social proof and rooms where people are actually showing up.',
  shade: 'You want off-radar picks that skip the obvious tourist circuit.',
  blaze: 'You want peak-hour energy and a main-character kind of night.',
  noir: 'You want something intimate, credible, and low-key without tourist traps.',
}

const promptKeywordWeights: Array<{ pattern: RegExp; weights: Partial<Record<BuzoAgentId, number>> }> = [
  { pattern: /\b(crowd|social|people|popular|packed|where everyone)\b/i, weights: { echo: 3, blaze: 1 } },
  { pattern: /\b(hidden|underground|off[- ]radar|secret|gem|obscure|local)\b/i, weights: { shade: 3 } },
  { pattern: /\b(techno|club|rave|dance|loud|peak|energy|main character|wild)\b/i, weights: { blaze: 3, echo: 1 } },
  { pattern: /\b(jazz|intimate|date|chill|low[- ]key|quiet|lounge|conversation)\b/i, weights: { noir: 3, shade: 1 } },
]

export type AdvisorRecommendation = {
  agentId: BuzoAgentId
  reason: string
  matchPercent: number
}

function emptyAgentScores(): Record<BuzoAgentId, number> {
  return Object.fromEntries(BUZO_AGENT_IDS.map((id) => [id, 0])) as Record<BuzoAgentId, number>
}

export function scoreBuzoAgentsFromAnswers(answers: AdvisorAnswers): Record<BuzoAgentId, number> {
  const scores = emptyAgentScores()

  for (const question of buzoAdvisorQuestions) {
    const answerId = answers[question.id]
    if (!answerId) continue
    const option = question.options.find((entry) => entry.id === answerId)
    if (!option) continue
    for (const [agentId, weight] of Object.entries(option.weights) as [BuzoAgentId, number][]) {
      scores[agentId] += weight
    }
  }

  return scores
}

export function scoreBuzoAgentsFromPrompt(prompt: string): Record<BuzoAgentId, number> {
  const scores = emptyAgentScores()

  for (const rule of promptKeywordWeights) {
    if (!rule.pattern.test(prompt)) continue
    for (const [agentId, weight] of Object.entries(rule.weights) as [BuzoAgentId, number][]) {
      scores[agentId] += weight
    }
  }

  return scores
}

export function computeMatchPercent(
  scores: Record<BuzoAgentId, number>,
  agentId: BuzoAgentId,
): number {
  const winnerScore = scores[agentId]
  const total = BUZO_AGENT_IDS.reduce((sum, id) => sum + scores[id], 0)

  if (total <= 0 || winnerScore <= 0) {
    return 58
  }

  const ordered = BUZO_AGENT_IDS.map((id) => ({ id, score: scores[id] })).sort(
    (a, b) => b.score - a.score,
  )
  const secondScore = ordered[1]?.score ?? 0
  const share = winnerScore / total
  const margin = winnerScore - secondScore

  const percent = share * 88 + Math.min(margin, 6) * 2
  return Math.round(Math.min(97, Math.max(55, percent)))
}

export function getMatchPercentLabel(matchPercent: number): string {
  if (matchPercent >= 90) return 'Excellent match'
  if (matchPercent >= 80) return 'Strong match'
  if (matchPercent >= 70) return 'Good match'
  return 'Decent match'
}

export function recommendBuzoAgentFromAnswers(answers: AdvisorAnswers): AdvisorRecommendation {
  const scores = scoreBuzoAgentsFromAnswers(answers)

  let bestId: BuzoAgentId = 'echo'
  let bestScore = -1
  for (const agentId of BUZO_AGENT_IDS) {
    if (scores[agentId] > bestScore) {
      bestScore = scores[agentId]
      bestId = agentId
    }
  }

  return {
    agentId: bestId,
    reason: advisorReasons[bestId],
    matchPercent: computeMatchPercent(scores, bestId),
  }
}

export function getAdvisorRecommendationCopy(recommendation: AdvisorRecommendation): string {
  const agent = getBuzoAgent(recommendation.agentId)
  return `${agent.name} is the bat for you. ${recommendation.reason}`
}

export function recommendBuzoAgentFromPrompt(prompt: string): AdvisorRecommendation {
  const scores = scoreBuzoAgentsFromPrompt(prompt)

  let bestId: BuzoAgentId = 'echo'
  let bestScore = -1
  for (const agentId of BUZO_AGENT_IDS) {
    if (scores[agentId] > bestScore) {
      bestScore = scores[agentId]
      bestId = agentId
    }
  }

  if (bestScore <= 0) {
    return {
      agentId: 'echo',
      reason: 'You did not specify a strong vibe, so Echo is a good default bat for reading the room.',
      matchPercent: 58,
    }
  }

  return {
    agentId: bestId,
    reason: advisorReasons[bestId],
    matchPercent: computeMatchPercent(scores, bestId),
  }
}

export function withPromptMatchPercent(
  prompt: string,
  recommendation: Pick<AdvisorRecommendation, 'agentId' | 'reason'>,
): AdvisorRecommendation {
  const scores = scoreBuzoAgentsFromPrompt(prompt)
  return {
    ...recommendation,
    matchPercent: computeMatchPercent(scores, recommendation.agentId),
  }
}
