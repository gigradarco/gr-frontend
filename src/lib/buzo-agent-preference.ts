import { BUZO_SELECTED_AGENT_STORAGE_KEY } from '../config/storage'
import { getBuzoAgentOrNull, isBuzoAgentId, type BuzoAgentId } from '../config/buzoAgents'

export function readSelectedBuzoAgentId(): BuzoAgentId | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(BUZO_SELECTED_AGENT_STORAGE_KEY)
    if (!raw || !isBuzoAgentId(raw)) {
      return null
    }
    return raw
  } catch {
    return null
  }
}

export function writeSelectedBuzoAgentId(agentId: BuzoAgentId): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(BUZO_SELECTED_AGENT_STORAGE_KEY, agentId)
  } catch {
    // Selection is optional; user can pick again next visit if storage fails.
  }
}

export function clearSelectedBuzoAgentId(): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(BUZO_SELECTED_AGENT_STORAGE_KEY)
  } catch {
    // Ignore storage failures; in-memory state still clears for this session.
  }
}

export function readSelectedBuzoAgent() {
  return getBuzoAgentOrNull(readSelectedBuzoAgentId())
}
