// Avoid importing openai typings at build time; runtime client uses fetch
type OpenAI = any
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  role: z.enum(['orchestrator', 'research', 'fileops', 'automation', 'shell', 'reviewer', 'summarizer']),
  deps: z.array(z.string()).default([]),
  budgets: z.object({ tokens: z.number().optional(), seconds: z.number().optional() }).default({}),
})

export type PlannedTask = z.infer<typeof TaskSchema>

export async function selectModel(client: OpenAI): Promise<string> {
  if (process.env.LMSTUDIO_MODEL && process.env.LMSTUDIO_MODEL.length > 0) {
    return process.env.LMSTUDIO_MODEL
  }
  if (process.env.OLLAMA_MODEL && process.env.OLLAMA_MODEL.length > 0) {
    // Prefix to signal Ollama routing in runtime
    const name = process.env.OLLAMA_MODEL
    return name.startsWith('ollama:') ? name : `ollama:${name}`
  }
  try {
    const list = await client.models.list()
    const names = list.data.map((m: any) => m.id)
    const preferred = names.find((n: string) => n.includes('gpt-oss'))
      || names.find((n: string) => n.includes('20b'))
      || names.find((n: string) => n.includes('llama'))
      || names[0]
    if (preferred) return preferred
  } catch {}
  // Default fallback model name
  return 'local-model'
}

// LLM-powered intent router for broad phrasing coverage
async function routeIntentLLM(prompt: string, model: string): Promise<null | {
  op: string
  name?: string
  scope?: string
  listType?: 'files' | 'folders'
  src?: string
  dest?: string
  action?: 'open' | 'reveal'
  text?: string
  cmd?: string
}> {
  try {
    const isOllama = typeof model === 'string' && model.startsWith('ollama:')
    const sys = [
      'You are an intent router for a macOS local assistant.',
      'Return STRICT JSON only, no prose.',
      'Schema:',
      '{"op":"locate|list|open|reveal|mkdir|rename|move|copy|open_app|quit_app|focus_app|hide_app|restart_app|ocr_search|shell|none"',
      ',"name?":string, "scope?":"desktop|documents|downloads|pictures|any"',
      ',"listType?":"files|folders"',
      ',"src?":string, "dest?":string, "action?":"open|reveal"',
      ',"text?":string, "cmd?":string}',
      'Rules: prefer concise fields; infer scope if user mentions a location; for list intents set op="list" with listType; if the user asks to search images by text, set op="ocr_search" and text to the phrase; if no actionable intent, set op="none".'
    ].join(' ')
    if (isOllama) {
      const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
      const r = await fetch(base + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.replace(/^ollama:/, ''),
          stream: false,
          options: { temperature: 0.1, num_predict: 300 },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: prompt }
          ]
        })
      })
      if (!r.ok) return null
      const j: any = await r.json()
      const content = j?.message?.content
      if (!content || typeof content !== 'string') return null
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed.op === 'string') return parsed
    } else {
      const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const body: any = {
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
        reasoning_effort: 'medium'
      }
      const r = await fetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!r.ok) return null
      const j: any = await r.json()
      const content = j?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') return null
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed.op === 'string') return parsed
    }
  } catch {}
  return null
}

// Detect local file/folder locate intent
function detectLocateTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // JSON override
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'locate' && typeof j.name === 'string') {
      return [
        { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Prefer an explicitly quoted target near naming phrases
  if (/\b(file|folder)\b/i.test(p)) {
    const nearNamed = p.match(/(?:named|called|something\s+like)\s+["']([^"']+)["']/i)
    if (nearNamed && nearNamed[1]) {
      const scopeWord = (p.match(/\bon\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)?.[1] || '').toLowerCase()
      const scope = ['desktop','documents','downloads','pictures'].includes(scopeWord) ? scopeWord : 'any'
      const payload = { op: 'locate', name: nearNamed[1].trim(), scope, originalPrompt: p }
      return [ { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
    }
    // If any quoted phrase exists, use the last one as the strongest hint
    const quotes = Array.from(p.matchAll(/["']([^"']+)["']/g))
    if (quotes.length > 0) {
      const name = quotes[quotes.length - 1][1].trim()
      const scopeWord = (p.match(/\bon\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)?.[1] || '').toLowerCase()
      const scope = ['desktop','documents','downloads','pictures'].includes(scopeWord) ? scopeWord : 'any'
      const payload = { op: 'locate', name, scope, originalPrompt: p }
      return [ { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
    }
  }

  // Natural language patterns - enhanced to catch more conversational requests
  const patterns: RegExp[] = [
    // Direct requests
    /where\s+is\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /find\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /locate\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    // Conversational patterns
    /I\s+(?:think\s+)?(?:have|had)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /(?:there's|there\s+is)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /I\s+(?:can't\s+remember\s+where|lost|misplaced).*?(?:file|folder).*?["'](.+?)["']/i,
    /(?:somewhere\s+on\s+my\s+(?:laptop|computer|mac)).*?(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    // Pattern for "I think it's called something like..."
    /(?:I\s+think\s+)?(?:it's\s+called|named)\s+something\s+like.*?["'](.+?)["']/i,
    // Pattern without quotes for names with special characters (more precise)
    /(?:it's\s+called|named)\s+something\s+like\s+"([^"]+)"/i,
  ]
  // High-level intents like "list files/folders in/on <scope>"
  const listFolders = p.match(/\b(list|show|find)\s+(?:all\s+)?(folders|directories)\s+(?:in|on)\s+(?:the\s+)?(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)
  if (listFolders) {
    const scope = (listFolders[3] || 'any').toLowerCase()
    const payload = { op: 'locate', name: '*', scope, listType: 'folders' }
    return [ { id: 'locate', title: 'List folders', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  const listFiles = p.match(/\b(list|show)\s+(?:all\s+)?files\s+(?:in|on)\s+(?:the\s+)?(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)
  if (listFiles) {
    const scope = (listFiles[2] || 'any').toLowerCase()
    const payload = { op: 'locate', name: '*', scope, listType: 'files' }
    return [ { id: 'locate', title: 'List files', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  
  // Check if this is a content-based search request (OCR needed)
  const contentSearchIndicators = [
    /screenshot.*?(?:with|has|contains).*?text/i,
    /image.*?(?:with|has|contains).*?text/i,
    /(?:text|words).*?(?:in|inside).*?(?:screenshot|image|picture)/i,
    /(?:screenshot|image|picture).*?(?:says|contains|has).*?["'](.+?)["']/i,
    /(?:find|locate).*?(?:screenshot|image).*?(?:text|content|saying)/i,
    /what.*?text.*?(?:do you see|in this image|in the image)/i,
    /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
    /(?:what does|what's in).*?(?:this|the).*?image.*?say/i,
  ]
  
  let isContentSearch = false
  let contentSearchText = ''
  
  for (const indicator of contentSearchIndicators) {
    const match = p.match(indicator)
    if (match) {
      isContentSearch = true
      // Try to extract the text being searched for
      const textMatch = p.match(/["']([^"']+)["']/i)
      if (textMatch) {
        contentSearchText = textMatch[1]
      } else {
        // Check if this is a general OCR request (extract all text)
        const generalOcrPatterns = [
          /what.*?text.*?(?:do you see|in this image|in the image)/i,
          /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
          /(?:what does|what's in).*?(?:this|the).*?image.*?say/i,
        ]
        
        const isGeneralOcr = generalOcrPatterns.some(pattern => pattern.test(p))
        if (isGeneralOcr) {
          contentSearchText = "*" // Special marker for "extract all text"
        } else {
          // Fall back to extracting key phrases
          const words = p.split(/\s+/).filter(w => w.length > 3)
          contentSearchText = words.slice(-3).join(' ') // Last few meaningful words
        }
      }
      break
    }
  }
  // If content search is detected, use the extracted text
  if (isContentSearch && contentSearchText) {
    const payload = { op: 'locate', name: contentSearchText, scope: 'any', contentSearch: true, originalPrompt: p }
    return [
      { id: 'locate', title: 'Search images for text content', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  
  for (const r of patterns) {
    const m = p.match(r)
    if (m && m[1]) {
      const rawName = m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
      const scopeWord = (m[3] || '').toLowerCase()
      const scope = ['desktop', 'documents', 'downloads', 'pictures'].includes(scopeWord) ? scopeWord : 'any'
      
      // Check if this might benefit from content search
      const mightNeedContentSearch = /screenshot|image|picture/i.test(p) || 
                                   /text.*(?:in|inside|contains)/i.test(p) ||
                                   /(?:says|contains|has).*text/i.test(p)
      
      const payload = { 
        op: 'locate', 
        name: rawName, 
        scope,
        contentSearch: mightNeedContentSearch,
        originalPrompt: p
      }
      
      const title = mightNeedContentSearch ? 
        'Search for files and image content' : 
        'Locate file/folder'
      
      return [
        { id: 'locate', title, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  }
  // New: capture unquoted names after phrases like "named", "called", or "something like"
  // Example: "Can you find a folder I think it was named something like it worked"
  if (/\b(file|folder)\b/i.test(p)) {
    const m = p.match(/(?:named|called|something\s+like)\s+([^"'\n]+?)(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b|[.!?]|$)/i)
    if (m && m[1]) {
      const extracted = m[1].trim().replace(/^\b(a|the)\b\s*/i, '')
      const scopeWord = (m[2] || '').toLowerCase()
      const scope = ['desktop', 'documents', 'downloads', 'pictures'].includes(scopeWord) ? scopeWord : 'any'
      const payload = { op: 'locate', name: extracted, scope, originalPrompt: p }
      return [ { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
    }
  }
  return null
}

// Detect open/reveal intents for previously mentioned or obvious folders/files
function detectOpenTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const open = p.match(/\b(?:open|launch)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i)
  if (open && open[1]) {
    const name = open[1].trim()
    const scope = (open[2] || 'any').toLowerCase()
    const payload = { op: 'open', action: 'open', name, scope }
    return [ { id: 'open', title: `Open ${name}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  const reveal = p.match(/\b(?:show|reveal)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+in\s+finder)?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i)
  if (reveal && reveal[1]) {
    const name = reveal[1].trim()
    const scope = (reveal[2] || 'any').toLowerCase()
    const payload = { op: 'open', action: 'reveal', name, scope }
    return [ { id: 'open', title: `Reveal ${name}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  return null
}

// Detect requests to open applications on macOS (e.g., "open slack", "launch chrome")
function detectAppOpenTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // Broad pattern: open/launch/start (the) [app/application/program] <name> (app)
  const m = p.match(/\b(?:open|launch|start)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  if (!m || !m[1]) return null
  let raw = m[1].trim()
  // Trim trailing courtesy phrases
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  if (!raw) return null
  // Canonicalize common app names
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw)
  const cmd = `open -a "${canonical}"`
  return [
    { id: 'open_app', title: `Open ${canonical}`, description: JSON.stringify({ cmd }), role: 'shell', deps: [], budgets: {} },
  ]
}

// Detect requests to quit/close applications on macOS (e.g., "quit chrome", "close Slack")
function detectAppQuitTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const m = p.match(/\b(?:quit|close|exit|kill)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  if (!m || !m[1]) return null
  let raw = m[1].trim()
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  if (!raw) return null
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw)
  // Prefer AppleScript quit for a graceful shutdown
  const cmd = `osascript -e 'tell application "${canonical}" to quit'`
  return [
    { id: 'quit_app', title: `Quit ${canonical}`, description: JSON.stringify({ cmd }), role: 'shell', deps: [], budgets: {} },
  ]
}

// Bring app to front / focus / show
function detectAppFocusTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const m = p.match(/\b(?:focus|switch\s+to|bring\s+(?:it|app|application)?\s*to\s+front|show)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  if (!m || !m[1]) return null
  let raw = m[1].trim()
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  if (!raw) return null
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw)
  const cmd = `osascript -e 'tell application "${canonical}" to activate'`
  return [ { id: 'focus_app', title: `Focus ${canonical}`, description: JSON.stringify({ cmd }), role: 'shell', deps: [], budgets: {} } ]
}

// Hide application windows
function detectAppHideTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const m = p.match(/\b(?:hide|minimise|minimize)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  if (!m || !m[1]) return null
  let raw = m[1].trim()
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  if (!raw) return null
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw)
  const cmd = `osascript -e 'tell application "${canonical}" to hide'`
  return [ { id: 'hide_app', title: `Hide ${canonical}`, description: JSON.stringify({ cmd }), role: 'shell', deps: [], budgets: {} } ]
}

// Restart/relaunch app: quit then reopen
function detectAppRestartTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const m = p.match(/\b(?:restart|relaunch|reopen)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i)
  if (!m || !m[1]) return null
  let raw = m[1].trim()
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, '').trim()
  if (!raw) return null
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw)
  const quitCmd = `osascript -e 'tell application "${canonical}" to quit'`
  const openCmd = `open -a "${canonical}"`
  return [
    { id: 'quit_app', title: `Quit ${canonical}`, description: JSON.stringify({ cmd: quitCmd }), role: 'shell', deps: [], budgets: {} },
    { id: 'open_app', title: `Open ${canonical}`, description: JSON.stringify({ cmd: openCmd }), role: 'shell', deps: ['quit_app'], budgets: {} },
  ]
}

function canonicalizeAppName(name: string): string {
  const n = name.trim()
  const lower = n.toLowerCase()
  const map: Record<string, string> = {
    'slack': 'Slack',
    'chrome': 'Google Chrome',
    'google chrome': 'Google Chrome',
    'safari': 'Safari',
    'finder': 'Finder',
    'terminal': 'Terminal',
    'iterm': 'iTerm',
    'iterm2': 'iTerm',
    'vscode': 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    'code': 'Visual Studio Code',
    'xcode': 'Xcode',
    'notes': 'Notes',
    'messages': 'Messages',
    'mail': 'Mail',
    'outlook': 'Microsoft Outlook',
    'ms outlook': 'Microsoft Outlook',
    'microsoft outlook': 'Microsoft Outlook',
    'preview': 'Preview',
    'calendar': 'Calendar',
    'reminders': 'Reminders',
    'spotify': 'Spotify',
    'discord': 'Discord',
    'zoom': 'zoom.us',
    'system preferences': 'System Settings',
    'settings': 'System Settings',
  }
  if (map[lower]) return map[lower]
  // If user includes .app or capitalization already, respect it; otherwise Title Case and append .app only if provided later by the OS
  const titleCase = n.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
  return titleCase
}

// Lightweight fuzzy correction and installed-app resolution
function resolveAppName(input: string): string | null {
  const normalizedInput = normalizeAppName(input)
  const candidates = new Set<string>()
  // Known popular apps
  for (const a of KNOWN_APPS) candidates.add(a)
  // Discovered installed apps
  for (const a of getInstalledApps()) candidates.add(a)
  const normInput = normalizeForCompare(normalizedInput)
  // Strong contains preference (e.g., outlook in Microsoft Outlook)
  for (const cand of candidates) {
    const normCand = normalizeForCompare(cand)
    if (normCand.includes(normInput) || normInput.includes(normCand)) {
      return cand
    }
  }
  let best: { name: string; score: number } | null = null
  for (const cand of candidates) {
    const normCand = normalizeForCompare(cand)
    if (normCand === normInput) return cand
    // Require same starting letter for fuzzy fallback to avoid mismaps like outlook -> Font Book
    if (normCand[0] !== normInput[0]) continue
    const score = similarity(normInput, normCand)
    if (!best || score > best.score) best = { name: cand, score }
  }
  if (best && best.score >= 0.75) return best.name
  return null
}

const KNOWN_APPS: string[] = [
  'Slack', 'Google Chrome', 'Visual Studio Code', 'Safari', 'Finder', 'Terminal', 'iTerm', 'Xcode',
  'Notes', 'Messages', 'Mail', 'Preview', 'Calendar', 'Reminders', 'Spotify', 'Discord', 'zoom.us', 'Zoom',
  'System Settings', 'Microsoft Outlook', 'Arc', 'Firefox', 'Notion', 'Obsidian', 'Postman', 'TablePlus', 'Docker',
  'WhatsApp', 'Telegram', 'Signal', '1Password', 'Raycast', 'Figma', 'Microsoft Word', 'Microsoft Excel',
  'Microsoft PowerPoint'
]

let installedAppsCache: string[] | null = null
function getInstalledApps(): string[] {
  if (installedAppsCache) return installedAppsCache
  const roots = [
    '/Applications',
    '/System/Applications',
    path.join(os.homedir(), 'Applications'),
    '/Applications/Utilities'
  ]
  const seen = new Set<string>()
  for (const root of roots) {
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true })
      for (const ent of entries) {
        if (ent.isDirectory() && ent.name.endsWith('.app')) {
          const base = ent.name.replace(/\.app$/i, '')
          if (!seen.has(base)) seen.add(base)
        }
      }
    } catch {}
  }
  installedAppsCache = Array.from(seen)
  return installedAppsCache
}

function normalizeAppName(s: string): string {
  return s.replace(/\.app$/i, '').trim()
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const dist = levenshtein(a, b)
  const denom = Math.max(a.length, b.length)
  return denom === 0 ? 0 : 1 - dist / denom
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

// Simple deterministic detection for local file rename requests
function detectRenameTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // Allow JSON description
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'rename' && typeof j.src === 'string' && typeof j.dest === 'string') {
      return [
        { id: 'rename', title: 'Rename file', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Regex pattern: rename <src> to <dest>
  const m = p.match(/rename\s+['\"]?(.+?)['\"]?\s+(?:to|->)\s+['\"]?(.+?)['\"]?$/i)
  if (m && m[1] && m[2]) {
    const payload = { op: 'rename', src: m[1], dest: m[2] }
    return [
      { id: 'rename', title: 'Rename file', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  // Conversational desktop phrasing: rename the folder named X on my desktop to Y
  const m2 = p.match(/rename\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?(.+?)\s+(?:on\s+my\s+desktop|on\s+desktop)?\s+(?:to|->)\s+(.+)$/i)
  if (m2 && m2[1] && m2[2]) {
    const payload = { op: 'rename', src: `Desktop ${m2[1]}`.trim(), dest: m2[2].trim() }
    return [
      { id: 'rename', title: 'Rename file', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  return null
}

export async function planTasks(prompt: string, modelOverride?: string, deep?: boolean, automation?: boolean): Promise<PlannedTask[]> {
  // Early: JSON override for explicit ops to avoid regex mis-detection
  try {
    const j = JSON.parse(prompt)
    if (j && typeof j === 'object') {
      if (j.op === 'shell' && typeof j.cmd === 'string') {
        // Preserve meta (e.g., slack_dm) so worker can emit a rich confirmation event
        return [ { id: 'sh1', title: 'Run shell command', description: JSON.stringify({ cmd: j.cmd, meta: j.meta }), role: 'shell', deps: [], budgets: {} } ]
      }
      if (j.op === 'open' && typeof j.name === 'string') {
        return [ { id: 'open', title: `Open ${j.name}`, description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'rename' && typeof j.src === 'string' && typeof j.dest === 'string') {
        return [ { id: 'rename', title: 'Rename file', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'locate' && typeof j.name === 'string') {
        return [ { id: 'locate', title: 'Locate', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'ocr_search' && (typeof j.text === 'string' || j.text === '*')) {
        return [ { id: 'ocr', title: 'OCR search', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'mkdir' && typeof j.name === 'string') {
        return [ { id: 'mkdir', title: `Create folder ${j.name}`, description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'move' && typeof j.src === 'string' && typeof j.dest === 'string') {
        return [ { id: 'move', title: 'Move item', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
      if (j.op === 'copy' && typeof j.src === 'string' && typeof j.dest === 'string') {
        return [ { id: 'copy', title: 'Copy item', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} } ]
      }
    }
  } catch {}
  // Check for uploaded image first
  const uploadedImageMatch = prompt.match(/\[UPLOADED_IMAGE_PATH:([^\]]+)\]\s*(.*)/)
  if (uploadedImageMatch) {
    const imagePath = uploadedImageMatch[1]
    const userQuestion = uploadedImageMatch[2].trim()
    
    console.log('Detected uploaded image:', imagePath)
    console.log('User question:', userQuestion)
    
    // Create OCR task for the specific uploaded image
    const searchText = userQuestion.toLowerCase().includes('what') && 
                      userQuestion.toLowerCase().includes('text') ? '*' : userQuestion || '*'
    
    const payload = { 
      op: 'ocr_search', 
      text: searchText,
      paths: [imagePath], // Only process this specific image
      originalPrompt: userQuestion || 'What text do you see in this image?'
    }
    
    return [
      { 
        id: 'ocr_uploaded', 
        title: 'Extract text from uploaded image', 
        description: JSON.stringify(payload), 
        role: 'fileops', 
        deps: [], 
        budgets: {} 
      },
    ]
  }
  
  // If the user asked for a direct filesystem action like rename, short-circuit the planner
  const quitPlan = detectAppQuitTask(prompt)
  if (quitPlan) return quitPlan
  const focusPlan = detectAppFocusTask(prompt)
  if (focusPlan) return focusPlan
  const hidePlan = detectAppHideTask(prompt)
  if (hidePlan) return hidePlan
  const restartPlan = detectAppRestartTask(prompt)
  if (restartPlan) return restartPlan
  const appOpenPlan = detectAppOpenTask(prompt)
  if (appOpenPlan) return appOpenPlan
  const openPlan = detectOpenTask(prompt)
  if (openPlan) return openPlan
  const locatePlan = detectLocateTask(prompt)
  if (locatePlan) return locatePlan
  const renamePlan = detectRenameTask(prompt)
  if (renamePlan) return renamePlan
  const shellPlan = detectShellTask(prompt)
  if (shellPlan) return shellPlan

  // LLM router fallback when automation is enabled: capture broad phrasings
  if (automation) {
    try {
      const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const client: any = {
        models: { list: async () => (await (await fetch(baseURL.replace(/\/$/, '') + '/models')).json()) }
      }
      let modelName = modelOverride ?? (await selectModel(client))
      const routed = await routeIntentLLM(prompt, modelName)
      if (routed && routed.op && routed.op !== 'none') {
        switch (routed.op) {
          case 'list': {
            const scope = (routed.scope || 'any') as string
            const listType = (routed.listType || 'folders') as 'files' | 'folders'
            const payload = { op: 'locate', name: '*', scope, listType }
            return [ { id: 'locate', title: `List ${listType}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
          }
          case 'locate': {
            const payload = { op: 'locate', name: routed.name || '*', scope: routed.scope || 'any', originalPrompt: prompt }
            return [ { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
          }
          case 'ocr_search': {
            const payload = { op: 'ocr_search', text: routed.text || '*', paths: [], originalPrompt: prompt }
            return [ { id: 'ocr', title: 'Search images for text content', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
          }
          case 'mkdir': {
            if (routed.name) return [ { id: 'mkdir', title: `Create folder ${routed.name}`, description: JSON.stringify({ op: 'mkdir', name: routed.name, scope: routed.scope || 'documents' }), role: 'fileops', deps: [], budgets: {} } ]
            break
          }
          case 'rename': {
            if (routed.src && routed.dest) return [ { id: 'rename', title: 'Rename file', description: JSON.stringify({ op: 'rename', src: routed.src, dest: routed.dest }), role: 'fileops', deps: [], budgets: {} } ]
            break
          }
          case 'move': {
            if (routed.src && routed.dest) return [ { id: 'move', title: 'Move item', description: JSON.stringify({ op: 'move', src: routed.src, dest: routed.dest }), role: 'fileops', deps: [], budgets: {} } ]
            break
          }
          case 'copy': {
            if (routed.src && routed.dest) return [ { id: 'copy', title: 'Copy item', description: JSON.stringify({ op: 'copy', src: routed.src, dest: routed.dest }), role: 'fileops', deps: [], budgets: {} } ]
            break
          }
          case 'open_app': {
            if (routed.name) return [ { id: 'open_app', title: `Open ${routed.name}`, description: JSON.stringify({ cmd: `open -a "${routed.name}"` }), role: 'shell', deps: [], budgets: {} } ]
            break
          }
          case 'quit_app': {
            if (routed.name) return [ { id: 'quit_app', title: `Quit ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to quit'` }), role: 'shell', deps: [], budgets: {} } ]
            break
          }
          case 'focus_app': {
            if (routed.name) return [ { id: 'focus_app', title: `Focus ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to activate'` }), role: 'shell', deps: [], budgets: {} } ]
            break
          }
          case 'hide_app': {
            if (routed.name) return [ { id: 'hide_app', title: `Hide ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to hide'` }), role: 'shell', deps: [], budgets: {} } ]
            break
          }
          case 'restart_app': {
            if (routed.name) return [
              { id: 'quit_app', title: `Quit ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to quit'` }), role: 'shell', deps: [], budgets: {} },
              { id: 'open_app', title: `Open ${routed.name}`, description: JSON.stringify({ cmd: `open -a "${routed.name}"` }), role: 'shell', deps: ['quit_app'], budgets: {} },
            ]
            break
          }
          case 'shell': {
            if (routed.cmd) return [ { id: 'sh1', title: 'Run shell command', description: JSON.stringify({ cmd: routed.cmd }), role: 'shell', deps: [], budgets: {} } ]
            break
          }
        }
      }
    } catch {}
  }
  // Lightweight local plan via LM Studio. Keep token budget small for speed.
  const taskFocus = automation ? "Mac control, file operations, shell commands, browser automation" : "web research, information gathering, analysis, synthesis"
  const preferredRoles = automation ? "fileops (local file edits), shell (terminal commands), automation (browser/app control)" : "research (web), reviewer (analysis), fileops (summary writing)"
  
  const system = `You are a local orchestrator that breaks a single user task into a small DAG of concrete steps.
Return 2-5 tasks max, each with an id, title, description, role, deps (by id), and tiny budgets.

${automation ? 'TASK MODE' : 'RESEARCH MODE'}: Focus on ${taskFocus}.
Use roles: ${preferredRoles}. Prefer reversible steps first.

${automation ? 
  'For task mode: Prioritize direct actions like file operations, shell commands, opening apps, browser automation.' : 
  'For research mode: Prioritize web research, data gathering, analysis, and report generation.'
}

Platform context: ${process.platform === 'win32' ? 'Windows PowerShell environment - use PowerShell commands like Get-ChildItem, Get-Location, etc.' : 'macOS/Unix environment - use standard Unix commands like ls, pwd, etc.'}

Respond with valid JSON only, no other text.`

  const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
  const client: any = {
    chat: {
      completions: {
        create: async (body: any) => {
          const r = await fetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: body.model, messages: body.messages, temperature: 0.2 })
          })
          const j: any = await r.json()
          return j
        }
      }
    },
    models: {
      list: async () => {
        const r = await fetch(baseURL.replace(/\/$/, '') + '/models')
        const j: any = await r.json()
        return j
      }
    }
  }
  let modelName = modelOverride ?? (await selectModel(client))
  let textFromLLM: string | null = null
  const isOllama = typeof modelName === 'string' && modelName.startsWith('ollama:')
  try {
    if (isOllama) {
      const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
      const r = await fetch(base + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName.replace(/^ollama:/, ''),
          stream: false,
          options: { temperature: 0.2, num_predict: 600 },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ]
        })
      })
      if (r.ok) {
        const j: any = await r.json()
        textFromLLM = String(j?.message?.content || '')
      }
    } else {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
      })
      textFromLLM = String(resp?.choices?.[0]?.message?.content ?? '')
    }
  } catch (e) {
    // Try again with a simpler fallback
    modelName = isOllama ? modelName : 'local-model'
    if (isOllama) {
      try {
        const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
        const r = await fetch(base + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName.replace(/^ollama:/, ''),
            stream: false,
            options: { temperature: 0.2, num_predict: 500 },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ]
          })
        })
        if (r.ok) {
          const j: any = await r.json()
          textFromLLM = String(j?.message?.content || '')
        }
      } catch {}
    } else {
        try {
    console.log(`[TaskPlanner] Planning for: "${prompt}"`)
    console.log(`[TaskPlanner] Platform: ${process.platform}`)
    console.log(`[TaskPlanner] Automation: ${automation}`)
    
    const resp = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    })
    textFromLLM = String(resp?.choices?.[0]?.message?.content ?? '')
    console.log(`[TaskPlanner] LLM response: ${textFromLLM.slice(0, 200)}...`)
      } catch {}
    }
  }

  let tasks: PlannedTask[] = []
  try {
    const parsed = JSON.parse(String(textFromLLM || ''))
    const maybeArray = Array.isArray(parsed) ? parsed : parsed.tasks
    tasks = z.array(TaskSchema).parse(maybeArray)
  } catch (e) {
    console.log(`[TaskPlanner] JSON parse failed, using fallback:`, e)
    // Robust fallback plan based on mode
    if (automation) {
      // Tasks mode fallback - focus on direct actions
      // Smarter fallback for listing/searching on known scopes
      const p = prompt.toLowerCase()
      console.log(`[TaskPlanner] Analyzing prompt: "${p}"`)
      const scopeMatch = p.match(/\b(desktop|documents|downloads|pictures)\b/)
      const scope = scopeMatch ? scopeMatch[1] : 'any'
      const isList = /\b(list|show)\b/.test(p)
      const wantsFolders = /\bfolders?|directories\b/.test(p)
      const wantsFiles = /\bfiles?\b/.test(p)
      console.log(`[TaskPlanner] Parsed: scope=${scope}, isList=${isList}, wantsFolders=${wantsFolders}, wantsFiles=${wantsFiles}`)
      if (isList && (wantsFolders || wantsFiles)) {
        const payload = { op: 'locate', name: '*', scope, listType: wantsFolders ? 'folders' : 'files' }
        tasks = [ { id: 'locate', title: `List ${wantsFolders ? 'folders' : 'files'}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
        console.log(`[TaskPlanner] Created fallback task:`, tasks[0])
      } else if (p.includes('folder') || p.includes('file')) {
        const payload = { op: 'locate', name: '*', scope }
        tasks = [ { id: 'locate', title: 'Search for file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
      } else {
        tasks = [
          { id: 't1', title: 'Analyze request', description: `Understand what needs to be done: ${prompt}`, role: 'fileops', deps: [], budgets: {} },
          { id: 't2', title: 'Execute task', description: prompt, role: 'shell', deps: ['t1'], budgets: {} },
        ]
      }
    } else if (deep) {
      // Research mode fallback - comprehensive research
      tasks = [
        { id: 'r1', title: 'Initial web scan', description: prompt, role: 'research', deps: [], budgets: {} },
        { id: 'r2', title: 'Broaden sources', description: `${prompt} additional perspectives`, role: 'research', deps: [], budgets: {} },
        { id: 's1', title: 'Synthesize and debate', description: 'Compare findings, note conflicts, pick best-supported claims', role: 'reviewer', deps: ['r1','r2'], budgets: {} },
        { id: 'w1', title: 'Write Summary', description: 'Create a local summary file', role: 'fileops', deps: ['s1'], budgets: {} },
      ]
    } else {
      // Simple research fallback
      tasks = [
        { id: 'r1', title: 'Quick web scan', description: prompt, role: 'research', deps: [], budgets: {} },
        { id: 'w1', title: 'Write Summary', description: 'Create a local summary file', role: 'fileops', deps: ['r1'], budgets: {} },
      ]
    }
  }
  return tasks
}


// Detect shell command intents
function detectShellTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // JSON override: { op: 'shell', cmd: 'git status' }
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'shell' && typeof j.cmd === 'string') {
      return [
        { id: 'sh1', title: 'Run shell command', description: JSON.stringify({ cmd: j.cmd }), role: 'shell', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Natural language prefixes
  const m = p.match(/^(?:shell:|run:|execute:)\s*(.+)$/i)
  if (m && m[1]) {
    const payload = { cmd: m[1].trim() }
    return [
      { id: 'sh1', title: 'Run shell command', description: JSON.stringify(payload), role: 'shell', deps: [], budgets: {} },
    ]
  }
  return null
}


