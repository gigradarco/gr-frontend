import { describe, expect, it } from 'vitest'
import { recommendBuzoAgentFromPrompt } from '../config/buzoAgentAdvisor'

describe('recommendBuzoAgentFromPrompt', () => {
  it('matches hidden gem language to Shade', () => {
    const result = recommendBuzoAgentFromPrompt('I want an off-radar spot, nothing touristy')
    expect(result.agentId).toBe('shade')
    expect(result.matchPercent).toBeGreaterThanOrEqual(70)
  })

  it('matches high-energy club language to Blaze', () => {
    const result = recommendBuzoAgentFromPrompt('Hard techno club, loud and late')
    expect(result.agentId).toBe('blaze')
    expect(result.matchPercent).toBeGreaterThanOrEqual(70)
  })

  it('falls back to Echo when no strong signal', () => {
    const result = recommendBuzoAgentFromPrompt('not sure yet')
    expect(result.agentId).toBe('echo')
    expect(result.matchPercent).toBe(58)
  })
})
