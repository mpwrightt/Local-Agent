import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the db module used by scheduler so we don't depend on native SQLite in this unit test
const addRunEvent = vi.fn()
vi.mock('../db', () => ({
  db: {
    addRunEvent,
    updateTaskStatus: vi.fn(),
  }
}))

type PlannedTask = {
  id: string
  title: string
  description: string
  role: 'research' | 'fileops' | 'automation' | 'shell' | 'reviewer' | 'summarizer' | 'orchestrator'
  deps: string[]
  budgets: { seconds?: number; tokens?: number }
}

describe('scheduler budget enforcement', () => {
  beforeEach(() => {
    addRunEvent.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aborts a task when budgets.seconds elapses and emits task_timeout', async () => {
    const { createBudgetAbortController } = await import('./scheduler')
    const parent = new AbortController()
    const task: PlannedTask = {
      id: 't1',
      title: 'Long op',
      description: 'simulate long work',
      role: 'shell',
      deps: [],
      budgets: { seconds: 0.05 },
    }
    const { signal, dispose } = createBudgetAbortController(task as any, 'run-1', parent.signal)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(60)
    expect(signal.aborted).toBe(true)
    // Ensure timeout event was emitted
    const types = addRunEvent.mock.calls.map((c) => (c?.[1]?.type))
    expect(types).toContain('task_timeout')
    dispose()
  })
})


