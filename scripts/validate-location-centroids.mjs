import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), 'src/data/locationRegions.ts')
const src = readFileSync(filePath, 'utf8')

function extractBlock(content, startMarker) {
  const start = content.indexOf(startMarker)
  if (start < 0) {
    throw new Error(`Missing marker: ${startMarker}`)
  }
  const openBrace = content.indexOf('{', start)
  if (openBrace < 0) {
    throw new Error(`Missing opening brace for: ${startMarker}`)
  }
  let depth = 0
  for (let i = openBrace; i < content.length; i += 1) {
    const ch = content[i]
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return content.slice(openBrace, i + 1)
      }
    }
  }
  throw new Error(`Unclosed block for: ${startMarker}`)
}

function extractCityIdsFromRegions(content) {
  const matches = [...content.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'[^']+'/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

function extractCentroidIds(content) {
  const block = extractBlock(content, 'export const LOCATION_CITY_CENTROIDS')
  const matches = [...block.matchAll(/(?:'([^']+)'|([a-z][a-z0-9-]*))\s*:\s*\[/gi)]
  return [...new Set(matches.map((m) => m[1] || m[2]).filter(Boolean))]
}

const cityIds = extractCityIdsFromRegions(src)
const centroidIds = extractCentroidIds(src)

const missing = cityIds.filter((id) => !centroidIds.includes(id))
const extra = centroidIds.filter((id) => !cityIds.includes(id))

if (missing.length === 0 && extra.length === 0) {
  console.log(`PASS: ${cityIds.length} city IDs have matching centroids.`)
  process.exit(0)
}

if (missing.length > 0) {
  console.error(`Missing centroid entries (${missing.length}): ${missing.join(', ')}`)
}
if (extra.length > 0) {
  console.error(`Extra centroid entries (${extra.length}): ${extra.join(', ')}`)
}
process.exit(1)
