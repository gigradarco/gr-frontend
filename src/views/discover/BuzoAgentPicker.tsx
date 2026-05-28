import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { buzoAgents, type BuzoAgent, type BuzoAgentId } from '../../config/buzoAgents'
import { BuzoAgentAdvisor } from './BuzoAgentAdvisor'

type BuzoAgentPickerProps = {
  onSelect: (agentId: BuzoAgentId) => void
  /** First-time pick vs switching an existing agent */
  variant?: 'initial' | 'change'
  selectedAgentId?: BuzoAgentId | null
  advisorOpen?: boolean
  onAdvisorOpenChange?: (open: boolean) => void
}

function AgentGridCard({
  agent,
  onSelect,
  isSelected,
}: {
  agent: BuzoAgent
  onSelect: (agentId: BuzoAgentId) => void
  isSelected: boolean
}) {
  return (
    <button
      type="button"
      className={['buzo-agent-card', isSelected && 'buzo-agent-card--selected'].filter(Boolean).join(' ')}
      style={{ '--agent-accent': agent.accent } as CSSProperties}
      onClick={() => onSelect(agent.id)}
      aria-pressed={isSelected}
    >
      <span className="buzo-agent-card-glyph" aria-hidden>
        {agent.glyph}
      </span>
      <span className="buzo-agent-card-name">{agent.name}</span>
      <span className="buzo-agent-card-title">{agent.title}</span>
      <span className="buzo-agent-card-tagline">{agent.tagline}</span>
      <span className="buzo-agent-card-description">{agent.description}</span>
    </button>
  )
}

function AgentListRow({
  agent,
  onSelect,
  isSelected,
}: {
  agent: BuzoAgent
  onSelect: (agentId: BuzoAgentId) => void
  isSelected: boolean
}) {
  return (
    <button
      type="button"
      className={['buzo-agent-row', isSelected && 'buzo-agent-row--selected'].filter(Boolean).join(' ')}
      style={{ '--agent-accent': agent.accent } as CSSProperties}
      onClick={() => onSelect(agent.id)}
      aria-pressed={isSelected}
    >
      <span className="buzo-agent-row-glyph" aria-hidden>
        {agent.glyph}
      </span>
      <span className="buzo-agent-row-copy">
        <span className="buzo-agent-row-top">
          <span className="buzo-agent-row-name">{agent.name}</span>
          {isSelected ? <span className="buzo-agent-row-current">Current</span> : null}
        </span>
        <span className="buzo-agent-row-title">{agent.title}</span>
        <span className="buzo-agent-row-tagline">{agent.tagline}</span>
      </span>
      {isSelected ? (
        <span className="buzo-agent-row-check" aria-hidden>
          <Check size={18} strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  )
}

export function BuzoAgentPicker({
  onSelect,
  variant = 'initial',
  selectedAgentId = null,
  advisorOpen = false,
  onAdvisorOpenChange,
}: BuzoAgentPickerProps) {
  const isChange = variant === 'change'

  const setShowAdvisor = (open: boolean) => {
    onAdvisorOpenChange?.(open)
  }

  if (advisorOpen) {
    return (
      <BuzoAgentAdvisor
        hideHeader={isChange}
        onBack={() => setShowAdvisor(false)}
        onSelect={(agentId) => {
          setShowAdvisor(false)
          onSelect(agentId)
        }}
      />
    )
  }

  return (
    <motion.div
      className={['buzo-agent-picker', isChange && 'buzo-agent-picker--change'].filter(Boolean).join(' ')}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="buzo-agent-picker-header">
        <p className="buzo-agent-picker-eyebrow">{isChange ? 'Switch your bat' : 'Pick your bat'}</p>
        <h2 className="buzo-agent-picker-title">
          {isChange ? 'Switch to a different bat' : 'Four bats. One fits you.'}
        </h2>
        <p className="buzo-agent-picker-sub">
          {isChange
            ? 'Echo, Shade, Blaze, or Noir — pick a different bat. Names are fixed for now; your open chat clears when you switch.'
            : 'Echo, Shade, Blaze, or Noir — four fixed bats with different instincts. Pick the one you want beside you tonight.'}
        </p>
      </div>
      {isChange ? (
        <div className="buzo-agent-list" role="list" aria-label="Buzo bats">
          {buzoAgents.map((agent) => (
            <AgentListRow
              key={agent.id}
              agent={agent}
              onSelect={onSelect}
              isSelected={selectedAgentId === agent.id}
            />
          ))}
        </div>
      ) : (
        <div className="buzo-agent-picker-grid" role="list" aria-label="Buzo bats">
          {buzoAgents.map((agent) => (
            <AgentGridCard
              key={agent.id}
              agent={agent}
              onSelect={onSelect}
              isSelected={selectedAgentId === agent.id}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="buzo-agent-help-choose"
        onClick={() => setShowAdvisor(true)}
      >
        <Sparkles size={16} strokeWidth={2.25} aria-hidden />
        <span>Not sure? Help me pick a bat</span>
      </button>
    </motion.div>
  )
}
