export type QuickResult = { title: string; url: string; snippet?: string }

async function getFetch(): Promise<(input: string, init?: any) => Promise<Response>> {
  const g: any = (globalThis as any)
  if (typeof g.fetch === 'function') return g.fetch.bind(globalThis)
  // In Node/Electron main we may not have global fetch; lazily import undici instead of node-fetch for browser build compatibility
  // final fallback: assume fetch exists (will throw at runtime in unsupported envs)
  return (input: any, init?: any) => (globalThis as any).fetch(input, init)
}

function htmlToText(html: string): string {
  // Remove scripts/styles
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Strip tags
  t = t.replace(/<[^>]+>/g, ' ')
  // Decode basic entities
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  // Collapse whitespace
  return t.replace(/\s+/g, ' ').trim()
}

export async function quickSearch(query: string, count: number = 3): Promise<QuickResult[]> {
  try {
    const tavily = process.env.TAVILY_API_KEY
    const doFetch = await getFetch()
    if (tavily) {
      const resp = await doFetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavily}` },
        body: JSON.stringify({ query, include_answer: false, max_results: Math.max(1, Math.min(5, count)), search_depth: 'basic', auto_parameters: true })
      })
      if (resp.ok) {
        const data: any = await resp.json()
        const results = Array.isArray(data?.results) ? data.results : []
        return results.slice(0, count).map((r: any) => ({ title: (r?.title ?? '').toString() || r?.url || 'Result', url: (r?.url ?? '').toString(), snippet: (r?.content ?? '').toString().slice(0, 200) }))
      }
    }
    // Fallback: DuckDuckGo HTML endpoint parsing via CORS-friendly proxy
    const url = 'https://duckduckgo.com/html/?kz=1&q=' + encodeURIComponent(query)
    const proxied = 'https://r.jina.ai/http/' + encodeURIComponent(url)
    const resp = await doFetch(proxied)
    const html = await resp.text()
    const results: QuickResult[] = []
    const re = /<a[^>]+class="result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) && results.length < count) {
      let href = m[1]
      let title = htmlToText(m[2])
      try {
        const u = new URL(href)
        const uddg = u.searchParams.get('uddg')
        if (uddg) href = decodeURIComponent(uddg)
      } catch {}
      if (!title) title = href
      results.push({ title, url: href })
    }
    return results
  } catch {
    return []
  }
}

export async function fetchReadable(url: string, maxChars: number = 6000): Promise<string> {
  try {
    const doFetch = await getFetch()
    const proxy = 'https://r.jina.ai/http/' + encodeURIComponent(url)
    const resp = await doFetch(proxy, { redirect: 'follow' })
    if (!resp.ok) return ''
    const text = await resp.text()
    return text.slice(0, maxChars)
  } catch {
    return ''
  }
}


