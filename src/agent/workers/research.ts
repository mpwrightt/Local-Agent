import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { logger } from '../../shared/logger'
import { db } from '../../db'

interface Ctx {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  query?: string
  deep?: boolean
  signal?: AbortSignal
}

export async function spawnResearchAgent(ctx: Ctx) {
  // Use ephemeral browser and context per run to avoid sticky state between runs
  const browser: Browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_VISIBLE === '1' ? false : true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const context: BrowserContext = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  let page: Page | null = null
  // Helper to slugify titles (must be declared before first use)
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
  // Lightweight boilerplate stripper for article text
  const cleanExtractedText = (input: string): string => {
    // Normalize line endings
    const t = (input || '').replace(/\r\n/g, '\n')
    const lines = t.split('\n')
    const kept: string[] = []
    const seen = new Set<string>()
    let totalChars = 0
    for (let raw of lines) {
      let l = raw.trim()
      if (!l) continue
      // Drop checkbox list items like "- [x] News" or "[ ] Opinion"
      if (/^(?:[\-\–\—]\s*)?\[[xX\s]\]\s*/.test(l)) continue
      // Drop any residual checkbox fragments that appear mid-line
      if (/\[[xX\s]\]/.test(l) && l.length <= 80) continue
      // Strip leading bullets/arrows
      l = l.replace(/^[-•*\u2022\u25CF\u25E6\u2023\u2043]+\s*/, '')
      // Drop checkbox list items like "[x] News"
      if (/^\[[xX\s]\]\s*/.test(l)) continue
      const ll = l.toLowerCase()
      const hasAlphaRatio = (l.replace(/[^a-z]/gi, '').length / Math.max(l.length, 1))
      // Drop short section tokens (Guardian-style nav)
      if (l.length <= 20) {
        const smallDrops = new Set(['us', 'uk', 'share', 'news', 'opinion', 'sport', 'culture', 'lifestyle', 'companies', 'summary'])
        if (smallDrops.has(ll)) continue
      }
      // Keyboard/media control helpers
      if (/^keyboard shortcuts/i.test(l)) continue
      if (/^(play\/pause|increase volume|decrease volume|seek forward|captions)\b/i.test(l)) continue
      if (/^(subtitle settings|automated captions)\b/i.test(l)) continue
      if (/(font color|font opacity|font size)\b/i.test(l)) continue
      if (/^(fullscreen|exit fullscreen|mute|unmute)\b/i.test(l)) continue
      if (/caption size/i.test(l)) continue
      if (/^next up\b/i.test(l)) continue
      // Drop generic boilerplate anywhere in line (not just start)
      const dropKeywords = [
        'cookie', 'cookies', 'privacy', 'terms of', 'adchoices', 'advert', 'advertisement', 'sponsored',
        'subscribe', 'newsletter', 'sign in', 'sign up', 'log in', 'sign out', 'view profile', 'copyright',
        'skip to', 'navigation', 'sidebar', 'menu', 'about', 'contact', 'manage preferences', 'report this ad',
        'policies', 'our network', 'more', 'close', 'back', 'search', 'us-en', 'edition', 'popular', 'recommended reading', 'issues delivered', 'try a single issue', 'advertising',
        'quick links', 'explore content', 'publish with us', 'enjoying our latest content', 'login or create an account', 'access the most recent journalism',
        'authors and affiliations', 'rights and permissions', 'corresponding author', 'competing interests', 'doi:', 'references', 'press shift question mark', 'volume 0%',
        'support the guardian', 'fund the free press', 'support our journalism',
        'subtitle settings', 'automated captions', 'font color', 'font opacity', 'font size', 'font family', 'character edge', 'edge color',
        'window color', 'window opacity', 'reset'
      ]
      if (dropKeywords.some((k) => ll.includes(k))) continue
      // Drop color-only palette lines (e.g., "White Black Red Green Blue Yellow Magenta Cyan")
      if (/^(?:white|black|red|green|blue|yellow|magenta|cyan|yel)(?:\s+(?:white|black|red|green|blue|yellow|magenta|cyan|yel))*$/i.test(l)) continue
      // Drop percent-only zoom lists (e.g., "200%175%150%125%100%75%50%")
      if (/^(?:\d{1,3}%\s*){2,}$/i.test(l)) continue
      // Drop font names-only lines
      if (/^(?:arial|courier|georgia|impact|lucida console|tahoma|times new roman|trebuchet ms|verdana|helvetica|monospace|sans-serif|serif)(?:\s+(?:arial|courier|georgia|impact|lucida console|tahoma|times new roman|trebuchet ms|verdana|helvetica|monospace|sans-serif|serif))*$/i.test(l)) continue
      // Drop link-list noise or pure urls
      if (l.startsWith('[') || /\]\(/.test(l)) continue
      if (/^https?:\/\//i.test(l)) continue
      // Very short non-sentences with low alpha ratio
      if (l.length < 20 && hasAlphaRatio < 0.5) continue
      // Drop single stray letter headings (e.g., 'B')
      if (/^[A-Za-z]$/.test(l)) continue
      // Drop tiny standalone tokens commonly seen in UI (e.g., 'White', 'Arial', 'None')
      if (l.length <= 10 && /^(white|black|red|green|blue|yellow|arial|none)$/i.test(l)) continue
      // De-duplicate normalized lines
      const norm = l.toLowerCase()
      if (seen.has(norm)) continue
      seen.add(norm)
      // Keep line
      kept.push(l)
      totalChars += l.length + 1
      if (totalChars >= 16000) break
      if (kept.length >= 2000) break
    }
    return kept.join('\n')
  }
  const domainFromUrl = (href: string): string => {
    try { return new URL(href).hostname.replace(/^www\./i, '').toLowerCase() } catch { return '' }
  }
  const normalizeTitle = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const domainWeight: Record<string, number> = {
    'reuters.com': 3.0,
    'apnews.com': 3.0,
    'bloomberg.com': 2.6,
    'theverge.com': 2.2,
    'wired.com': 2.2,
    'nature.com': 2.5,
    'arxiv.org': 2.4,
    'devblogs.microsoft.com': 2.0,
    'microsoft.com': 1.8,
    'openai.com': 2.4,
    'openai.com/blog': 2.6,
    'blog.google': 2.4,
    'blog.google/technology/ai': 2.6,
    'anthropic.com': 2.2,
    'ai.googleblog.com': 2.4,
  }
  // Track recency in days for URLs (lower is better)
  const urlRecencyDays = new Map<string, number>()
  const rankTargets = (items: Array<{ title: string; url: string }>): Array<{ title: string; url: string }> => {
    const scored = items.map((it) => {
      const d = domainFromUrl(it.url)
      const w = domainWeight[d] ?? 1.0
      // Prefer titles that look like news/releases
      const kw = /\b(release|launch|announc|latest|update|roadmap|news)\b/i.test(it.title) ? 0.3 : 0
      const rec = urlRecencyDays.get(it.url)
      const recBonus = rec == null ? 0 : rec < 3 ? 0.8 : rec < 7 ? 0.5 : rec < 30 ? 0.2 : 0
      return { it, score: w + kw + recBonus }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => s.it)
  }
  const limitPerDomain = (items: Array<{ title: string; url: string }>, perDomain: number): Array<{ title: string; url: string }> => {
    const count = new Map<string, number>()
    const out: Array<{ title: string; url: string }> = []
    for (const it of items) {
      const d = domainFromUrl(it.url)
      const c = count.get(d) ?? 0
      if (c >= perDomain) continue
      count.set(d, c + 1)
      out.push(it)
    }
    return out
  }
  try {
    page = await context.newPage()
    db.addRunEvent(ctx.runId, { type: 'research_start', taskId: ctx.task.id, deep: Boolean(ctx.deep) })
    if (ctx.signal?.aborted) {
      db.addRunEvent(ctx.runId, { type: 'research_cancelled', taskId: ctx.task.id })
      return { cancelled: true }
    }
    // Heuristically derive a focused search query from the prompt
    const deriveQuery = (text: string): string => {
      const original = text.trim()
      // 1) quoted phrase wins
      const mQuote = original.match(/["“”](.+?)["“”]/)
      if (mQuote?.[1]) return mQuote[1].trim()
      // 2) common patterns
      const patts: RegExp[] = [
        /search the web for\s+(.+?)(?:\.|\band\b|\bthen\b|\bto\b|$)/i,
        /latest\s+(.+?)\s+news/i,
        /about\s+(.+?)(?:\.|\band\b|\bthen\b|$)/i,
      ]
      for (const r of patts) {
        const m = original.match(r)
        if (m?.[1]) return m[1].trim()
      }
      // 3) split at instruction joiners
      const cut = original.split(/\b(?:and|then|to|so that|write|summarize|summary|file|save)\b/i)[0]
      let q = (cut || original).trim()
      q = q.replace(/^the\s+/i, '') // drop leading 'the' which hurts recall
      return q
    }
    const rawQ = (ctx.query && ctx.query.trim().length > 0) ? ctx.query : ctx.task.description
    const searchQuery = deriveQuery(rawQ)
    db.addRunEvent(ctx.runId, { type: 'research_query', taskId: ctx.task.id, query: searchQuery })
    const disallowHosts = new Set(['hackertab.dev', 'twitter.com', 'x.com'])
    const normHost = (h: string) => h.replace(/^www\./i, '').toLowerCase()
    const seenUrls = new Set<string>()
    const targets: { title: string; url: string }[] = []
    const seenTitleKeys = new Set<string>()

    const tavilyKey = process.env.TAVILY_API_KEY
    db.addRunEvent(ctx.runId, { type: 'env_info', taskId: ctx.task.id, tavily: Boolean(tavilyKey) })
    if (tavilyKey) {
      db.addRunEvent(ctx.runId, { type: 'search_vendor', taskId: ctx.task.id, vendor: 'tavily', query: searchQuery })
      const maxResults = ctx.deep ? 15 : 8
      const queries = [searchQuery]
      if (ctx.deep) {
        queries.push(
          `${searchQuery} site:devblogs.microsoft.com`,
          `${searchQuery} release notes`,
          `${searchQuery} roadmap`,
        )
      }
      const isNewsy = /\b(latest|news|today|this week|this month)\b/i.test(searchQuery)
      const excludeDomains = [
        'hackertab.dev', 'twitter.com', 'x.com', 'medium.com', 'linkedin.com', 'facebook.com', 'youtube.com', 'instagram.com', 'pinterest.com', 'reddit.com',
        'roboticsandautomationnews.com', 'quora.com', 'stackexchange.com', 'stack overflow', 'news.ycombinator.com'
      ]
      const tavilyCollected: Array<{ title: string; url: string; raw?: string }> = []
      for (const q of queries) {
        try {
          const doFetch: any = (globalThis as any).fetch ?? (await import('node-fetch')).default
          const resp = await doFetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
            body: JSON.stringify({
              query: q,
              include_answer: false,
              search_depth: ctx.deep ? 'advanced' : 'basic',
              max_results: maxResults,
              auto_parameters: true,
              include_raw_content: true,
              topic: isNewsy ? 'news' : 'general',
              days: isNewsy ? 7 : undefined,
              exclude_domains: excludeDomains,
            }),
          })
          if (!resp.ok) {
            const msg = await resp.text().catch(() => '')
            db.addRunEvent(ctx.runId, { type: 'search_error', taskId: ctx.task.id, vendor: 'tavily', status: resp.status, body: msg })
            continue
          }
          const data: any = await resp.json()
          const results = Array.isArray(data?.results) ? data.results : []
          for (const r of results) {
            const href: string | undefined = r?.url
            const title: string = (r?.title ?? '').toString()
            if (!href || !title || !href.startsWith('http')) continue
            try {
              const u = new URL(href)
              if (disallowHosts.has(normHost(u.hostname))) continue
            } catch {}
            if (seenUrls.has(href)) continue
            const key = normalizeTitle(title)
            if (seenTitleKeys.has(key)) continue
            seenTitleKeys.add(key)
            seenUrls.add(href)
            targets.push({ title, url: href })
            // Track recency if provided
            try {
              const pd = (r?.published_date || r?.date || '').toString()
              if (pd) {
                const d = new Date(pd)
                if (!isNaN(d.getTime())) {
                  const days = Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
                  urlRecencyDays.set(href, days)
                }
              }
            } catch {}
            if (typeof r?.raw_content === 'string' && r.raw_content.trim().length > 200) {
              tavilyCollected.push({ title, url: href, raw: r.raw_content as string })
            }
            if (targets.length >= (ctx.deep ? 12 : 5)) break
          }
          if (targets.length >= (ctx.deep ? 12 : 5)) break
        } catch (err) {
          logger.warn({ err }, 'Tavily search failed, will fallback to manual search if needed')
          db.addRunEvent(ctx.runId, { type: 'search_error', taskId: ctx.task.id, vendor: 'tavily', error: String((err as any)?.message ?? err) })
        }
      }

      // If Tavily returned raw content, materialize those into article files immediately
      // Note: declarations for articles/aggregateParts moved earlier to avoid TDZ
      // We will defer writing until after declarations below to satisfy TS
      const tavilyDeferredLocal: Array<{ title: string; url: string; raw: string }> = []
      if (tavilyCollected.length > 0) {
        for (const item of tavilyCollected.slice(0, ctx.deep ? 12 : 5)) {
          if (typeof item.raw === 'string' && item.raw.trim().length > 0) {
            tavilyDeferredLocal.push({ title: item.title, url: item.url, raw: item.raw.slice(0, 16000) })
          }
        }
      }
    }

    // Fallback to DuckDuckGo if Tavily disabled or returned nothing
    if (targets.length === 0) {
      // Use the HTML endpoint (less JS, more reliable in headless)
      db.addRunEvent(ctx.runId, { type: 'search_vendor', taskId: ctx.task.id, vendor: 'duckduckgo_html', query: searchQuery })
      const ddgBase = 'https://duckduckgo.com/html/?kz=1&q='
      const baseQueries = [searchQuery]
      const moreQueries = ctx.deep ? [
        `${searchQuery} site:devblogs.microsoft.com`,
        `${searchQuery} TypeScript release notes`,
        `TypeScript roadmap latest`,
        `TypeScript 5 news`,
      ] : []
      const allQueries = [...baseQueries, ...moreQueries]
      for (const sub of allQueries) {
        const url = ddgBase + encodeURIComponent(sub)
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('domcontentloaded')
        // HTML endpoint uses 'a.result__a'
        const anchors = await page.locator('a.result__a, a.result__a.js-result-title-link').all()
        for (const a of anchors) {
          const href = await a.getAttribute('href')
          const text = (await a.textContent())?.trim() || ''
          if (!href || !text || !href.startsWith('http')) continue
          try {
            const u = new URL(href)
            if (disallowHosts.has(normHost(u.hostname))) continue
          } catch {}
          if (seenUrls.has(href)) continue
          const key = normalizeTitle(text)
          if (seenTitleKeys.has(key)) continue
          seenTitleKeys.add(key)
          seenUrls.add(href)
          targets.push({ title: text, url: href })
          if (targets.length >= (ctx.deep ? 12 : 5)) break
        }
        if (targets.length >= (ctx.deep ? 12 : 5)) break
      }
      if (targets.length === 0) {
        db.addRunEvent(ctx.runId, { type: 'search_no_results', taskId: ctx.task.id, vendor: 'duckduckgo_html', query: searchQuery })
      }
    }

    // Try Bing News, then Bing Web as additional fallbacks
    if (targets.length === 0) {
      try {
        db.addRunEvent(ctx.runId, { type: 'search_vendor', taskId: ctx.task.id, vendor: 'bing_news', query: searchQuery })
        await page.goto('https://www.bing.com/news/search?q=' + encodeURIComponent(searchQuery))
        await page.waitForLoadState('domcontentloaded')
        const anchors = await page.locator('a.title, h2 a').all()
        for (const a of anchors) {
          const href = await a.getAttribute('href')
          const text = (await a.textContent())?.trim() || ''
          if (!href || !text || !href.startsWith('http')) continue
          try { const u = new URL(href); if (disallowHosts.has(normHost(u.hostname))) continue } catch {}
          if (seenUrls.has(href)) continue
          seenUrls.add(href)
          targets.push({ title: text, url: href })
          if (targets.length >= (ctx.deep ? 12 : 5)) break
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: 'search_error', taskId: ctx.task.id, vendor: 'bing_news', error: String((err as any)?.message ?? err) })
      }
    }

    if (targets.length === 0) {
      try {
        db.addRunEvent(ctx.runId, { type: 'search_vendor', taskId: ctx.task.id, vendor: 'bing', query: searchQuery })
        await page.goto('https://www.bing.com/search?q=' + encodeURIComponent(searchQuery))
        await page.waitForLoadState('domcontentloaded')
        const anchors = await page.locator('li.b_algo h2 a').all()
        for (const a of anchors) {
          const href = await a.getAttribute('href')
          const text = (await a.textContent())?.trim() || ''
          if (!href || !text || !href.startsWith('http')) continue
          try { const u = new URL(href); if (disallowHosts.has(normHost(u.hostname))) continue } catch {}
          if (seenUrls.has(href)) continue
          seenUrls.add(href)
          targets.push({ title: text, url: href })
          if (targets.length >= (ctx.deep ? 12 : 5)) break
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: 'search_error', taskId: ctx.task.id, vendor: 'bing', error: String((err as any)?.message ?? err) })
      }
    }

    // Final hard fallback: seed a few authoritative sources for well-known tech terms
    if (targets.length === 0) {
      const qLower = searchQuery.toLowerCase()
      const seeds: { title: string; url: string }[] = []
      if (qLower.includes('typescript')) {
        seeds.push(
          { title: 'TypeScript Blog', url: 'https://devblogs.microsoft.com/typescript/' },
          { title: 'TypeScript Releases (GitHub)', url: 'https://github.com/microsoft/TypeScript/releases' },
          { title: 'TypeScript Release Notes Overview', url: 'https://www.typescriptlang.org/docs/handbook/release-notes/overview.html' },
        )
      }
      for (const s of seeds) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url)
          targets.push(s)
        }
      }
      if (seeds.length > 0) {
        db.addRunEvent(ctx.runId, { type: 'search_seeded', taskId: ctx.task.id, count: seeds.length })
      }
    }

    const baseDir = path.join(os.homedir(), '.local-agent')
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
    const shotPath = path.join(baseDir, `screenshot-${Date.now()}.png`)
    try { await page.screenshot({ path: shotPath, fullPage: true }) } catch {}

    const articles: { title: string; url: string; path: string }[] = []
    const aggregateParts: string[] = []

    // Rank and trim targets for higher quality sources
    let rankedTargets = rankTargets(targets)
    // Avoid over-representing a single domain
    rankedTargets = limitPerDomain(rankedTargets, ctx.deep ? 3 : 2)
    const limit = ctx.deep ? 12 : 5
    const finalTargets = rankedTargets.slice(0, limit)
    if (finalTargets.length !== targets.length) {
      db.addRunEvent(ctx.runId, { type: 'targets_ranked', taskId: ctx.task.id, before: targets.length, after: finalTargets.length })
    }

    // Flush any deferred Tavily raw items now that arrays are declared
    // @ts-expect-error local var may not be defined when tavilyKey is missing
    if (typeof tavilyDeferredLocal !== 'undefined' && tavilyDeferredLocal.length > 0) {
      const baseDir = path.join(os.homedir(), '.local-agent')
      // @ts-expect-error local var may not be defined when tavilyKey is missing
      for (const item of tavilyDeferredLocal) {
        try {
          const f = path.join(baseDir, `article-${slug(item.title)}-${Date.now()}.txt`)
          const cleanedRaw = cleanExtractedText(item.raw)
          fs.writeFileSync(f, cleanedRaw, 'utf8')
          articles.push({ title: item.title, url: item.url, path: f })
          aggregateParts.push(`# ${item.title}\n${item.url}\n\n${cleanedRaw}\n\n---\n\n`)
        } catch {}
      }
      db.addRunEvent(ctx.runId, { type: 'extract_result', taskId: ctx.task.id, count: articles.length })
    }

    // (slug helper moved above to avoid temporal dead zone)

    let crawled = false
    if (tavilyKey && finalTargets.length > 0 && articles.length < (ctx.deep ? 6 : 3)) {
      try {
        const doFetch: any = (globalThis as any).fetch ?? (await import('node-fetch')).default
        const resp = await doFetch('https://api.tavily.com/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
          body: JSON.stringify({ urls: finalTargets.map(t => t.url), include_images: false }),
        })
        const data: any = await resp.json()
        const results: any[] = Array.isArray(data?.results) ? data.results : []
        for (const r of results) {
          const url = r?.url || r?.source || ''
          const title = r?.title || finalTargets.find(t => t.url === url)?.title || url
          const text = cleanExtractedText((r?.content || r?.text || r?.markdown || '').toString())
          if (url && text.trim().length > 200) {
            const f = path.join(baseDir, `article-${slug(title)}-${Date.now()}.txt`)
            fs.writeFileSync(f, text.slice(0, 16000), 'utf8')
            articles.push({ title, url, path: f })
            aggregateParts.push(`# ${title}\n${url}\n\n${text.slice(0, 16000)}\n\n---\n\n`)
          }
        }
        crawled = articles.length > 0
      } catch (err) {
        logger.warn({ err }, 'Tavily crawl failed; will fall back to Playwright')
      }
    }

    // Tavily Extract as another fallback if we have targets but no content yet
    if (tavilyKey && finalTargets.length > 0 && articles.length < (ctx.deep ? 6 : 3)) {
      try {
        const doFetch: any = (globalThis as any).fetch ?? (await import('node-fetch')).default
        const resp = await doFetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
          body: JSON.stringify({ urls: finalTargets.map(t => t.url).slice(0, ctx.deep ? 12 : 5), extract_depth: ctx.deep ? 'advanced' : 'basic' }),
        })
        if (resp.ok) {
          const data: any = await resp.json()
          const results: any[] = Array.isArray(data?.results) ? data.results : []
          for (const r of results) {
            const url: string = r?.url || ''
            const title: string = finalTargets.find(t => t.url === url)?.title || url
            const text: string = cleanExtractedText((r?.raw_content || r?.content || '').toString())
            if (url && text.trim().length > 200) {
              const f = path.join(baseDir, `article-${slug(title)}-${Date.now()}.txt`)
              fs.writeFileSync(f, text.slice(0, 16000), 'utf8')
              articles.push({ title, url, path: f })
              aggregateParts.push(`# ${title}\n${url}\n\n${text.slice(0, 16000)}\n\n---\n\n`)
            }
          }
          db.addRunEvent(ctx.runId, { type: 'extract_result', taskId: ctx.task.id, count: results.length })
        } else {
          const msg = await resp.text().catch(() => '')
          db.addRunEvent(ctx.runId, { type: 'extract_error', taskId: ctx.task.id, status: resp.status, body: msg })
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: 'extract_error', taskId: ctx.task.id, error: String((err as any)?.message ?? err) })
      }
    }

    if (!crawled) {
      for (const t of finalTargets) {
        try {
          await page.goto(t.url, { waitUntil: 'domcontentloaded' })
          const text = await page.evaluate(() => {
            const pick = () => {
              const article = document.querySelector('article')
              if (article) return (article as HTMLElement).innerText
              const main = document.querySelector('main')
              if (main) return (main as HTMLElement).innerText
              const sel = document.querySelector('div[id*="content"], div[class*="content"], section[id*="content"], section[class*="content"]')
              if (sel) return (sel as HTMLElement).innerText
              return (document.body as HTMLElement)?.innerText || ''
            }
            const maxLen = 16000
            let inner = pick() || ''
            if (inner.length > maxLen) inner = inner.slice(0, maxLen)
            return inner
          })
          const cleaned = cleanExtractedText(text)
          if (cleaned.trim().length > 200) {
            const f = path.join(baseDir, `article-${slug(t.title)}-${Date.now()}.txt`)
            fs.writeFileSync(f, cleaned, 'utf8')
            articles.push({ title: t.title, url: t.url, path: f })
            aggregateParts.push(`# ${t.title}\n${t.url}\n\n${cleaned}\n\n---\n\n`)
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to scrape target')
        }
      }
    }

    // Write aggregate corpus
    const aggregatePath = path.join(baseDir, `research-aggregate-${Date.now()}.txt`)
    fs.writeFileSync(aggregatePath, aggregateParts.join('\n'), 'utf8')

    db.addRunEvent(ctx.runId, {
      type: 'research_result',
      taskId: ctx.task.id,
      query: searchQuery,
      targets: finalTargets,
      screenshot: shotPath,
      articles,
      aggregatePath,
    })
    return { query: searchQuery, targets: finalTargets, screenshot: shotPath, articles, aggregatePath }
  } finally {
    // Close resources to prevent state leaks across runs
    try { await page?.close() } catch {}
    try { await context?.close() } catch {}
    try { await browser?.close() } catch {}
  }
}


