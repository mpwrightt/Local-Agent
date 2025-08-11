import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { startOrchestrator, cancelRun as cancelRunById } from './scheduler'
import { registerBuiltInWorkers, loadPlugins, watchPlugins } from './registry'
// import { logger } from '../shared/logger'
// import { eventBus } from './event_bus'
import { resolveConfirmation } from './confirm'
// Use fetch-based LM Studio client to avoid openai package in web/electron builds
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }
class LMClient {
  constructor(private baseURL: string) {}
  async listModels(): Promise<string[]> {
    const r = await fetch(this.baseURL.replace(/\/$/, '') + '/models')
    const j: any = await r.json()
    return Array.isArray(j?.data) ? j.data.map((m: any) => m.id) : []
  }
  async chat(messages: ChatMessage[], model: string, opts?: { temperature?: number; stream?: boolean }) {
    const r = await fetch(this.baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: opts?.temperature ?? 0.7, stream: Boolean(opts?.stream) })
    })
    return r
  }
}
import { getDefaultModel, setDefaultModel, getRetentionDays } from './config'
import { db } from '../db'
import { quickSearch, fetchReadable, type QuickResult } from './web'

export function createAgentRuntime(ipcMain: IpcMain) {
  async function detectChatIntent(_client: any, _modelName: string, text: string): Promise<{ action: string; query?: string; url?: string }> {
    try {
      const sys = 'You are an intent router. Return strict JSON only with fields: {"action": "answer|quick_web|open_url|summarize_url|to_tasks|to_research", "query?": string, "url?": string}. Choose quick_web for lightweight web lookup; to_research only if the user explicitly requests deep research.'
      const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const client = new LMClient(baseURL)
      const r = await client.chat([
        { role: 'system', content: sys },
        { role: 'user', content: text }
      ], _modelName, { temperature: 0 })
      const j: any = await r.json()
      const content = j?.choices?.[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(content)
      if (typeof parsed?.action === 'string') return parsed
    } catch {}
    return { action: 'answer' }
  }
  // Register built-ins and try loading plugins once at startup
  try { registerBuiltInWorkers() } catch {}
  try { void loadPlugins() } catch {}
  try { watchPlugins() } catch {}

  // Schedule daily DB pruning
  try {
    const runPrune = () => db.pruneOldData(getRetentionDays())
    setInterval(runPrune, 24 * 60 * 60 * 1000)
  } catch {}
  ipcMain.handle('agent/startTask', async (_event, input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }) => {
    const sessionId = db.createSession(input.prompt)
    const runId = db.createRun(sessionId)
    const chosenModel = input.model ?? getDefaultModel() ?? process.env.LMSTUDIO_MODEL ?? 'local-model'
    db.addRunEvent(runId, { type: 'run_started', prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) })
    startOrchestrator({ sessionId, runId, prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) })
    return { runId }
  })

  ipcMain.handle('agent/getHistory', async (_event, input: { sessionId?: string }) => {
    return db.getHistory(input.sessionId)
  })

  ipcMain.handle('agent/confirmDangerous', async (_event, input: { runId: string; taskId: string; confirm: boolean }) => {
    resolveConfirmation(input.runId, input.taskId, input.confirm)
  })

  ipcMain.handle('agent/setDefaultModel', async (_event, input: { model: string }) => {
    setDefaultModel(input.model)
  })

  ipcMain.handle('agent/cancelRun', async (_event, input: { runId: string }) => {
    try {
      cancelRunById(input.runId)
      db.addRunEvent(input.runId, { type: 'run_cancelled' })
    } catch {}
  })

  ipcMain.handle('agent/openPath', async (_event, input: { path: string }) => {
    try { await shell.openPath(input.path) } catch {}
  })

  ipcMain.handle('agent/revealInFolder', async (_event, input: { path: string }) => {
    try { shell.showItemInFolder(input.path) } catch {}
  })

  ipcMain.handle('agent/readFileText', async (_event, input: { path: string }) => {
    try {
      const fs = await import('node:fs')
      const content = fs.readFileSync(input.path, 'utf8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Save uploaded image to temp file
  ipcMain.handle('agent/saveUploadedImage', async (_event, input: { dataUrl: string; fileName: string }) => {
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { writeFile } = await import('fs/promises')
    
    try {
      // Extract base64 data from data URL
      const matches = input.dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
      if (!matches) {
        throw new Error('Invalid data URL format')
      }
      
      const extension = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')
      
      // Create unique filename
      const timestamp = Date.now()
      const tempFilePath = join(tmpdir(), `uploaded-image-${timestamp}.${extension}`)
      
      // Write file
      await writeFile(tempFilePath, buffer)
      
      return { success: true, filePath: tempFilePath }
    } catch (error) {
      console.error('Failed to save uploaded image:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Simple chat mode - direct LM Studio interaction without task orchestration
  ipcMain.handle('agent/simpleChat', async (_event, input: { 
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    model?: string;
    temperature?: number;
    reasoningLevel?: 'low' | 'medium' | 'high'
  }) => {
    const searchEnabled = (input as any).searchEnabled !== false
    const showThinking = (input as any).showThinking !== false
    try {
      // LM Studio OpenAI-compatible API configuration
      const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const client = new LMClient(baseURL)

      // Get available models from LM Studio
      let modelName = input.model ?? 'gpt-oss:20b'
      if (!input.model) {
        try {
          const models = await client.listModels()
          modelName = models.find(m => m.includes('gpt-oss'))
                   ?? models.find(m => m.includes('custom-test'))
                   ?? models[0]
                   ?? 'gpt-oss:20b'
        } catch {
          modelName = 'gpt-oss:20b' // fallback to known working model
        }
      }
      
      // Guardrails: Chat mode uses lightweight fetched context only; no tool-call markup, no browsing claims.
      const chatGuard = [
        'You are Local Agent in Chat mode. You may use the provided "Web context (short)" if present, but you do not browse live.',
        'Never output tool-call markup or channel tags. Cite web sources using Markdown links when you rely on the web context.',
        'When helpful, start with a single line: "Reasoning (concise): ..." followed by the answer.'
      ].join(' ')

      // Detect intent via a lightweight JSON router
      const userText = input.messages.slice().reverse().find(m => m.role === 'user')?.content ?? ''
      const intent = searchEnabled ? await detectChatIntent(client, modelName, userText) : { action: 'answer' as const }
      const quickRegex = /\b(search|look up|find|news|latest|open|go to|happen|happened|going on|events|today|this week|this weekend|over the weekend)\b/i
      const wantsQuick = searchEnabled && (intent.action === 'quick_web' || intent.action === 'summarize_url' || intent.action === 'open_url' || quickRegex.test(userText) || (/https?:\/\//i.test(userText)))
      let quickContext: string | undefined
      let quickHits: QuickResult[] | undefined
      if (wantsQuick) {
        try {
          const urlFromIntent = intent.url && /^https?:\/\//i.test(intent.url) ? intent.url : undefined
          const urlMatch = urlFromIntent ? [urlFromIntent] as unknown as RegExpMatchArray : userText.match(/https?:\/\/\S+/)
          if (urlMatch) {
            const readable = await fetchReadable(urlMatch[0])
            if (readable) quickContext = `Source ${urlMatch[0]}\n\n${readable}`
            quickHits = [{ title: urlMatch[0], url: urlMatch[0] }]
          } else {
            const q = intent.query || userText.replace(/^\s*(?:please\s*)?(?:search|look up|find|check)\s*/i, '').trim()
            const hits = await quickSearch(q, 3)
            if (hits.length > 0) {
              const top = hits[0]
              const readable = await fetchReadable(top.url)
              const list = hits.map((h, i) => `${i + 1}. ${h.title} - ${h.url}`).join('\n')
              quickContext = `Top results for: ${q}\n${list}\n\nPrimary source: ${top.url}\n\n${readable}`
              quickHits = hits
            }
          }
        } catch {}
      }

      const guardedMessages = [
        { role: 'system' as const, content: chatGuard },
        ...(quickContext ? [{ role: 'system' as const, content: `Web context (short):\n${quickContext}` }] : []),
        ...input.messages,
      ]

      // Inject Harmony-style reasoning level hint
      const rl = input.reasoningLevel ?? 'medium'
      const limits = rl === 'high' ? { maxTokens: 2048 } : rl === 'low' ? { maxTokens: 256 } : { maxTokens: 1024 }
      const reasoningHint = `reasoning: ${rl}`
      const systemIdx = guardedMessages.findIndex(m => m.role === 'system')
      if (systemIdx >= 0) guardedMessages[systemIdx] = { role: 'system', content: guardedMessages[systemIdx].content + `\n${reasoningHint}` }

      // Stream tokens so we can emit a dynamic thinking box when model uses analysis/commentary
<<<<<<< HEAD
      const resp = await client.chat(guardedMessages as any, modelName, { temperature: input.temperature ?? (rl === 'high' ? 0.2 : rl === 'low' ? 0.8 : 0.6), stream: false })
      const jj: any = await resp.json()
      const contentAll: string = jj?.choices?.[0]?.message?.content ?? ''
      let analysisBuf = contentAll
      let finalBuf = ''
      // Fallback if model streamed only one buffer
      const text = (finalBuf || analysisBuf)
      const extract = (() => {
        try {
          const tagFinal = text.match(/<final>([\s\S]*?)<\/final>/i)
          if (tagFinal?.[1]) return { content: tagFinal[1].trim(), thinking: analysisBuf.replace(/<final>[\s\S]*$/i, '').trim() }
          const tokIdx = text.indexOf('<|final|>')
          if (tokIdx >= 0) {
            const rest = text.slice(tokIdx + '<|final|>'.length)
            const next = rest.search(/<\|[a-z]+\|>/i)
            const content = (next >= 0 ? rest.slice(0, next) : rest).trim()
            const think = analysisBuf.slice(0, tokIdx).trim()
            return { content, thinking: think }
          }
        } catch {}
        return { content: text.trim(), thinking: '' }
      })()

      // Sanitize visible content
      let cleaned = extract.content
      cleaned = cleaned.replace(/<\|[^>]+\|>/g, '')
      cleaned = cleaned.replace(/^\s*commentary\s+to=[^\n]*$/gim, '')
      cleaned = cleaned.replace(/^\s*code\s*\{[\s\S]*$/gim, '')

      return {
        success: true,
        content: cleaned,
        model: modelName,
=======
      const response = await client.chat.completions.create({
        model: modelName,
        messages: guardedMessages,
        temperature: input.temperature ?? (rl === 'high' ? 0.2 : rl === 'low' ? 0.8 : 0.6),
        max_tokens: limits.maxTokens,
        stream: true
      })
      let analysisBuf = ''
      let finalBuf = ''
      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (!delta) continue
        // Heuristic: accumulate analysis until we see <|final|> or <final>
        if (finalBuf.length === 0) {
          analysisBuf += delta
        }
        const reachedTok = analysisBuf.includes('<|final|>') || analysisBuf.includes('<final>')
        if (reachedTok) {
          const after = analysisBuf.split(/<\|final\|>|<final>/i).slice(1).join('') + delta
          finalBuf += after
        }
      }
      // Fallback if model streamed only one buffer
      const text = (finalBuf || analysisBuf)
      const extract = (() => {
        try {
          const tagFinal = text.match(/<final>([\s\S]*?)<\/final>/i)
          if (tagFinal?.[1]) return { content: tagFinal[1].trim(), thinking: analysisBuf.replace(/<final>[\s\S]*$/i, '').trim() }
          const tokIdx = text.indexOf('<|final|>')
          if (tokIdx >= 0) {
            const rest = text.slice(tokIdx + '<|final|>'.length)
            const next = rest.search(/<\|[a-z]+\|>/i)
            const content = (next >= 0 ? rest.slice(0, next) : rest).trim()
            const think = analysisBuf.slice(0, tokIdx).trim()
            return { content, thinking: think }
          }
        } catch {}
        return { content: text.trim(), thinking: '' }
      })()

      // Sanitize visible content
      let cleaned = extract.content
      cleaned = cleaned.replace(/<\|[^>]+\|>/g, '')
      cleaned = cleaned.replace(/^\s*commentary\s+to=[^\n]*$/gim, '')
      cleaned = cleaned.replace(/^\s*code\s*\{[\s\S]*$/gim, '')

      return {
        success: true,
        content: cleaned,
        model: modelName,
>>>>>>> origin/main
        links: quickHits?.slice(0, 3),
        thinking: showThinking ? extract.thinking : ''
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        content: `Sorry, I encountered an error connecting to LM Studio. Please make sure LM Studio is running and the local server is started on ${process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234'}`
      }
    }
  })
}


