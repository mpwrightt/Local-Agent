import { describe, it, expect, vi } from 'vitest'

// Stub db events to avoid sqlite
vi.mock('../../db', () => ({ db: { addRunEvent: vi.fn() } }))

// Mock child_process.spawn to simulate a long-running process that can be killed
const onHandlers: Record<string, Function[]> = { close: [], error: [], }
const childMock = {
  stdout: { setEncoding: vi.fn(), on: vi.fn() },
  stderr: { setEncoding: vi.fn(), on: vi.fn() },
  on: vi.fn((event: string, cb: Function) => { (onHandlers[event] ||= []).push(cb) }),
  kill: vi.fn((sig?: string) => {
    // Immediately emit close when killed
    const fns = onHandlers['close'] || []
    for (const fn of fns) fn(0)
  }),
}
vi.mock('node:child_process', () => ({
  __esModule: true,
  default: { spawn: vi.fn(() => childMock) },
  spawn: vi.fn(() => childMock),
}))

describe('spawnShellAgent cancellation', () => {
  it('rejects with Cancelled when AbortSignal fires', async () => {
    const { spawnShellAgent } = await import('./shell')
    const ac = new AbortController()
    const p = spawnShellAgent({
      runId: 'r', sessionId: 's',
      task: { id: 't', title: 't', description: JSON.stringify({ cmd: 'sleep 10' }) },
      signal: ac.signal,
      automation: true,
    })
    ac.abort()
    await expect(p).rejects.toThrow(/Cancelled/)
  })
})


