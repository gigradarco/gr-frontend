import { describe, expect, it } from 'vitest'
import {
  computeMatchPercent,
  recommendBuzoAgentFromAnswers,
  recommendBuzoAgentFromPrompt,
  scoreBuzoAgentsFromAnswers,
} from '../config/buzoAgentAdvisor'

describe('recommendBuzoAgentFromAnswers', () => {
  it('recommends Echo for crowd-first social nights', () => {
    const result = recommendBuzoAgentFromAnswers({
      priority: 'crowd',
      company: 'friends',
      energy: 'medium',
    })
    expect(result.agentId).toBe('echo')
    expect(result.matchPercent).toBeGreaterThanOrEqual(70)
  })

  it('recommends Shade for hidden gem solo nights', () => {
    const result = recommendBuzoAgentFromAnswers({
      priority: 'hidden',
      company: 'solo',
      energy: 'medium',
    })
    expect(result.agentId).toBe('shade')
    expect(result.matchPercent).toBeGreaterThanOrEqual(70)
  })

  it('recommends Blaze for peak energy', () => {
    const result = recommendBuzoAgentFromAnswers({
      priority: 'peak',
      company: 'friends',
      energy: 'high',
    })
    expect(result.agentId).toBe('blaze')
    expect(result.matchPercent).toBeGreaterThanOrEqual(55)
  })

  it('recommends Noir for intimate low-key nights', () => {
    const result = recommendBuzoAgentFromAnswers({
      priority: 'chill',
      company: 'date',
      energy: 'low',
    })
    expect(result.agentId).toBe('noir')
    expect(result.matchPercent).toBeGreaterThanOrEqual(80)
  })
})

describe('computeMatchPercent', () => {
  it('returns a low default when there is no signal', () => {
    const scores = scoreBuzoAgentsFromAnswers({})
    expect(computeMatchPercent(scores, 'echo')).toBe(58)
  })
})
