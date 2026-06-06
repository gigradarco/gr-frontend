import { describe, expect, it } from 'vitest'
import {
  ASK_BUZO_PATHS,
  askBuzoShellViewFromPath,
  getPathForTab,
  isKnownAskBuzoPath,
  pathToTab,
} from './tabRoutes'

describe('Ask Buzo routes', () => {
  it('uses the chat route as the Ask tab destination', () => {
    expect(getPathForTab('ask')).toBe(ASK_BUZO_PATHS.chat)
  })

  it('maps Ask Buzo nested routes back to the ask tab', () => {
    expect(pathToTab(ASK_BUZO_PATHS.root)).toBe('ask')
    expect(pathToTab(ASK_BUZO_PATHS.chat)).toBe('ask')
    expect(pathToTab(ASK_BUZO_PATHS.bats)).toBe('ask')
    expect(pathToTab(ASK_BUZO_PATHS.batsSwitch)).toBe('ask')
    expect(pathToTab(ASK_BUZO_PATHS.batsMatch)).toBe('ask')
  })

  it('accepts only known Ask Buzo sub-routes', () => {
    expect(isKnownAskBuzoPath(ASK_BUZO_PATHS.chat)).toBe(true)
    expect(isKnownAskBuzoPath(ASK_BUZO_PATHS.bats)).toBe(true)
    expect(isKnownAskBuzoPath('/ask-buzo/unknown')).toBe(false)
  })

  it('resolves Ask Buzo shell views from paths', () => {
    expect(askBuzoShellViewFromPath(ASK_BUZO_PATHS.chat)).toBe('chat')
    expect(askBuzoShellViewFromPath(ASK_BUZO_PATHS.bats)).toBe('bats')
    expect(askBuzoShellViewFromPath(ASK_BUZO_PATHS.batsSwitch)).toBe('batsSwitch')
    expect(askBuzoShellViewFromPath(ASK_BUZO_PATHS.batsMatch)).toBe('batsMatch')
  })
})
