const DEFAULT_FETCH_TIMEOUT_MS = 12_000

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function timeoutError(timeoutMs: number): DOMException {
  return new DOMException(`Request timed out after ${timeoutMs}ms.`, 'TimeoutError')
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const parentSignal = init.signal
  if (parentSignal?.aborted) {
    throw parentSignal.reason ?? abortError()
  }

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => {
    controller.abort(timeoutError(timeoutMs))
  }, timeoutMs)

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason ?? abortError())
  }

  parentSignal?.addEventListener('abort', abortFromParent, { once: true })

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    globalThis.clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}
