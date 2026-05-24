export type ImageProbeResult = 'failed' | 'loaded' | 'unknown'

export function probeImageUrl(url: string, timeoutMs: number): Promise<ImageProbeResult> {
  const target = url.trim()
  if (!target) return Promise.resolve('unknown')

  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const timer = window.setTimeout(() => finish('unknown'), timeoutMs)

    function finish(result: ImageProbeResult) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(result)
    }

    img.onload = () => finish('loaded')
    img.onerror = () => finish('failed')
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    img.src = target
  })
}
