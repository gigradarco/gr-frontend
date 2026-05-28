import { describe, expect, it, beforeEach, vi } from 'vitest'
import { BUZO_SELECTED_AGENT_STORAGE_KEY } from '../config/storage'
import { readSelectedBuzoAgentId, writeSelectedBuzoAgentId, clearSelectedBuzoAgentId } from './buzo-agent-preference'

function localStorageMock(): Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem'> {
  const store = new Map<string, string>()
  return {
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

describe('buzo-agent-preference', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock(),
    })
  })

  it('returns null when nothing is stored', () => {
    expect(readSelectedBuzoAgentId()).toBeNull()
  })

  it('persists a valid agent id', () => {
    writeSelectedBuzoAgentId('shade')
    expect(window.localStorage.getItem(BUZO_SELECTED_AGENT_STORAGE_KEY)).toBe('shade')
    expect(readSelectedBuzoAgentId()).toBe('shade')
  })

  it('clears a stored agent id', () => {
    writeSelectedBuzoAgentId('echo')
    clearSelectedBuzoAgentId()
    expect(window.localStorage.getItem(BUZO_SELECTED_AGENT_STORAGE_KEY)).toBeNull()
    expect(readSelectedBuzoAgentId()).toBeNull()
  })

  it('ignores invalid stored values', () => {
    window.localStorage.setItem(BUZO_SELECTED_AGENT_STORAGE_KEY, 'unknown')
    expect(readSelectedBuzoAgentId()).toBeNull()
  })
})
