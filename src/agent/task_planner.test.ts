import { describe, it, expect } from 'vitest'

// Inline mirror of the app-open detector for a quick unit test, kept in sync with task_planner.ts
function detectAppOpen(prompt: string) {
  const m = prompt.trim().match(/\b(?:open|launch|start)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  let captured = m?.[1]?.trim() || ''
  captured = captured.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  return captured
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const dist = levenshtein(a, b)
  const denom = Math.max(a.length, b.length)
  return denom === 0 ? 0 : 1 - dist / denom
}

describe('detectAppOpen (pattern)', () => {
  it('detects common phrasing', () => {
    expect(detectAppOpen('open slack')).toBe('slack')
    expect(detectAppOpen('launch the Slack app')).toBe('Slack')
    expect(detectAppOpen('start Google Chrome')).toBe('Google Chrome')
  })
  it('ignores trailing courtesy words', () => {
    expect(detectAppOpen('open slack please')).toBe('slack')
    expect(detectAppOpen('launch chrome for me')).toBe('chrome')
  })
})

describe('fuzzy similarity for app names', () => {
  it('scores close misspellings well', () => {
    const input = normalizeForCompare('slcak')
    const cand = normalizeForCompare('Slack')
    const score = similarity(input, cand)
    expect(score).toBeGreaterThanOrEqual(0.6)
  })
})


