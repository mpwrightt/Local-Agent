import { describe, it, expect, vi } from 'vitest'
import * as web from './web'

describe('quickSearch fallback proxy formatting', () => {
  it('uses r.jina.ai without double-encoding', async () => {
    const fetchSpy = vi.fn(async (input: any) => {
      // minimal Response mock
      const ok = true
      const text = async () => '<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example</a>'
      return { ok, text } as any
    })
    ;(globalThis as any).fetch = fetchSpy

    await web.quickSearch('hi', 1)

    const calledWith: string = fetchSpy.mock.calls[0][0]
    expect(calledWith).toContain('https://r.jina.ai/http/')
    // Ensure no encoded https%3A in the r.jina.ai segment
    expect(calledWith).not.toContain('https%3A%2F%2Fduckduckgo.com')
    expect(calledWith).toContain('https://duckduckgo.com/html/?kz=1&q=hi')
  })
})


