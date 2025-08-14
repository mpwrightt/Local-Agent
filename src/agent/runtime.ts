import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { startOrchestrator, cancelRun as cancelRunById } from './scheduler'
import { registerBuiltInWorkers, loadPlugins, watchPlugins } from './registry'
// import { logger } from '../shared/logger'
import { eventBus } from './event_bus'
import { resolveConfirmation } from './confirm'
// Use fetch-based LM Studio client to avoid openai package in web/electron builds
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }
class LMClient {
  private baseURL: string
  constructor(baseURL: string) {
    this.baseURL = baseURL
  }
  async listModels(): Promise<string[]> {
    const r = await fetch(this.baseURL.replace(/\/$/, '') + '/models')
    const j: any = await r.json()
    return Array.isArray(j?.data) ? j.data.map((m: any) => m.id) : []
  }
  async chat(
    messages: ChatMessage[],
    model: string,
    opts?: { temperature?: number; topP?: number; presencePenalty?: number; frequencyPenalty?: number; stream?: boolean; reasoningEffort?: 'low' | 'medium' | 'high'; maxTokens?: number }
  ) {
    const body: any = {
      model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      stream: Boolean(opts?.stream)
    }
    if (opts?.reasoningEffort) {
      // Use ONLY the format that worked in direct curl tests
      body.reasoning_effort = opts.reasoningEffort
      
      // Debug logging to track what we're sending
      console.log(`[LMClient] Sending reasoning effort: ${opts.reasoningEffort}`)
      console.log(`[LMClient] Direct to LM Studio - no proxy`)
    }
    if (typeof opts?.maxTokens === 'number') body.max_tokens = opts.maxTokens
    if (typeof opts?.topP === 'number') (body as any).top_p = opts.topP
    if (typeof opts?.presencePenalty === 'number') (body as any).presence_penalty = opts.presencePenalty
    if (typeof opts?.frequencyPenalty === 'number') (body as any).frequency_penalty = opts.frequencyPenalty
    // Enhanced debug logging
    if (opts?.reasoningEffort) {
      console.log(`[LMClient] Full request body with reasoning effort:`, JSON.stringify(body, null, 2))
    }
    
    const r = await fetch(this.baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    
    if (opts?.reasoningEffort) {
      console.log(`[LMClient] Response status:`, r.status)
      const responseClone = r.clone()
      const responseData = await responseClone.json()
      console.log(`[LMClient] Response reasoning_content length:`, responseData?.choices?.[0]?.message?.reasoning_content?.length || 0)
    }
    return r
  }
}
import { getDefaultModel, setDefaultModel, getRetentionDays, getVisualizerVariant, setVisualizerVariant } from './config'
import { db } from '../db'
import { quickSearch, fetchReadable, type QuickResult } from './web'

export function createAgentRuntime(ipcMain: IpcMain) {
  async function getElevenLabsKey(): Promise<string | null> {
    try {
      if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0) {
        return process.env.ELEVENLABS_API_KEY.trim()
      }
    } catch {}
    try {
      const { readFileSync, existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const roots = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), 'resources')]
      for (const r of roots) {
        const p = join(r, 'keys.md')
        if (existsSync(p)) {
          const t = readFileSync(p, 'utf8')
          const m = t.match(/eleven\s*labs\s*key\s*:\s*([a-zA-Z0-9_\-]+)\b/i)
          if (m && m[1]) return m[1].trim()
        }
      }
    } catch {}
    return null
  }
  // Reserved for future use
  // function detectChatIntent() { return { action: 'answer' as const } }
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
    const chosenModel = input.model
      ?? getDefaultModel()
      ?? process.env.LMSTUDIO_MODEL
      ?? process.env.OLLAMA_MODEL
      ?? 'local-model'
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
  
  ipcMain.handle('agent/getDefaultModel', async () => {
    try { return { model: getDefaultModel() } } catch { return { model: undefined } }
  })

  ipcMain.handle('agent/listModels', async () => {
    const results = new Set<string>()
    // LM Studio models via OpenAI-compatible /models
    try {
      const baseURL = process.env.LM_GATEWAY_URL ?? process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const r = await fetch(baseURL.replace(/\/$/, '') + '/models')
      if (r.ok) {
        const j: any = await r.json()
        const names: string[] = Array.isArray(j?.data) ? j.data.map((m: any) => String(m.id)) : []
        for (const n of names) results.add(n)
      }
    } catch {}
    // Ollama models
    try {
      const ollama = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
      const r = await fetch(ollama + '/api/tags')
      if (r.ok) {
        const j: any = await r.json()
        const arr: any[] = Array.isArray(j?.models) ? j.models : []
        for (const m of arr) {
          const name = String(m?.model || m?.name || '')
          if (name) results.add('ollama:' + name)
        }
      }
    } catch {}
    return Array.from(results)
  })

  ipcMain.handle('agent/getVisualizerVariant', async () => {
    return { variant: getVisualizerVariant() }
  })

  ipcMain.handle('agent/setVisualizerVariant', async (_event, input: { variant: string }) => {
    setVisualizerVariant(input.variant)
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

  // ElevenLabs TTS proxy (avoids exposing API key to renderer)
  ipcMain.handle('agent/voiceTTS', async (_event, input: { text: string; voiceId?: string; modelId?: string }) => {
    try {
      const key = await getElevenLabsKey()
      if (!key) {
        return { success: false, error: 'Missing ELEVENLABS_API_KEY (or keys.md entry: "eleven labs key:")' }
      }
      const voiceId = (input.voiceId || '21m00Tcm4TlvDq8ikWAM').trim() // Default: Rachel
      const modelId = (input.modelId || 'eleven_multilingual_v2').trim()
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({ text: input.text || '', model_id: modelId })
      })
      if (!r.ok) {
        const msg = await r.text().catch(() => '')
        return { success: false, error: `TTS error ${r.status}: ${msg.slice(0, 200)}` }
      }
      const buf = Buffer.from(await r.arrayBuffer())
      const b64 = buf.toString('base64')
      return { success: true, audioBase64: b64, format: 'mp3' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ElevenLabs: list voices
  ipcMain.handle('agent/elevenVoices', async () => {
    try {
      const key = await getElevenLabsKey()
      if (!key) return { success: false, error: 'Missing ELEVENLABS_API_KEY or keys.md' }
      const r = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key }
      })
      if (!r.ok) return { success: false, error: `HTTP ${r.status}` }
      const j: any = await r.json()
      const voices = Array.isArray(j?.voices) ? j.voices.map((v: any) => ({ id: v.voice_id || v.voiceID || v.id, name: v.name || 'Voice', category: v.category || '', labels: v.labels || {} })) : []
      return { success: true, voices }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Speech-to-Text: Prefer local Whisper HTTP server if configured; fallback to OpenAI Whisper
  ipcMain.handle('agent/speechToText', async (_event, input: { audioBase64: string; mimeType?: string; fileName?: string }) => {
    try {
      const getLocalWhisperUrl = async (): Promise<string | null> => {
        if (process.env.WHISPER_HTTP_URL && process.env.WHISPER_HTTP_URL.trim()) return process.env.WHISPER_HTTP_URL.trim()
        try {
          const { readFileSync, existsSync } = await import('node:fs')
          const { join } = await import('node:path')
          const roots = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), 'resources')]
          for (const r of roots) {
            const p = join(r, 'keys.md')
            if (existsSync(p)) {
              const t = readFileSync(p, 'utf8')
              const m = t.match(/whisper\s*url\s*:\s*(https?:[^\s]+)\b/i)
              if (m && m[1]) return m[1].trim()
            }
          }
        } catch {}
        return null
      }

      const mime = (input.mimeType || 'audio/webm').trim()
      const fileName = (input.fileName || `speech.${mime.includes('mp3') ? 'mp3' : mime.includes('wav') ? 'wav' : mime.includes('m4a') ? 'm4a' : 'webm'}`).trim()
      const binary = Buffer.from(input.audioBase64, 'base64')
      const form = new FormData()
      const blob = new Blob([binary], { type: mime })
      form.append('file', blob, fileName)
      form.append('model', 'whisper-1')

      // Local HTTP server path (OpenAI-compatible)
      const localUrl = await getLocalWhisperUrl()
      if (localUrl) {
        const r = await fetch(localUrl, { method: 'POST', body: form as any })
        if (!r.ok) {
          const msg = await r.text().catch(() => '')
          return { success: false, error: `Local STT error ${r.status}: ${msg.slice(0, 200)}` }
        }
        const j: any = await r.json()
        const txt = typeof j?.text === 'string' ? j.text : (typeof j?.transcription === 'string' ? j.transcription : '')
        return { success: true, text: txt }
      }

      // Remote OpenAI Whisper fallback
      const getKey = async (): Promise<string | null> => {
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) return process.env.OPENAI_API_KEY.trim()
        try {
          const { readFileSync, existsSync } = await import('node:fs')
          const { join } = await import('node:path')
          const roots = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), 'resources')]
          for (const r of roots) {
            const p = join(r, 'keys.md')
            if (existsSync(p)) {
              const t = readFileSync(p, 'utf8')
              const m = t.match(/openai\s*key\s*:\s*([a-zA-Z0-9_\-]+)\b/i)
              if (m && m[1]) return m[1].trim()
            }
          }
        } catch {}
        return null
      }
      const key = await getKey()
      if (!key) return { success: false, error: 'Missing OPENAI_API_KEY (or keys.md entry: "openai key:") and no WHISPER_HTTP_URL configured' }
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${key}` }, body: form as any })
      if (!r.ok) {
        const msg = await r.text().catch(() => '')
        return { success: false, error: `STT error ${r.status}: ${msg.slice(0, 200)}` }
      }
      const j: any = await r.json()
      const text: string = j?.text || ''
      return { success: true, text }
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
    reasoningLevel?: 'low' | 'medium' | 'high';
    maxTokens?: number;
    stream?: boolean;
    answerId?: string;
    thinkingId?: string;
  }) => {
    const searchEnabled = (input as any).searchEnabled !== false
    const showThinking = (input as any).showThinking !== false
    try {
      // LM Studio OpenAI-compatible API configuration
      const baseURL = process.env.LM_GATEWAY_URL ?? process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const client = new LMClient(baseURL)

      // Get available models from LM Studio
      let modelName = input.model ?? 'gpt-oss:20b'
      if (!input.model) {
        try {
          const models = await client.listModels()
          modelName = models.find(m => m.includes('openai/gpt-oss'))
                   ?? models.find(m => m.includes('gpt-oss'))
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
        'If the API supports it, place your chain-of-thought in reasoning_content and put only the final answer in content.',
        'If reasoning_content is not supported, stream your chain-of-thought inside <think>...</think> and put the final answer outside the think block. Do not use any other custom tags.'
      ].join(' ')

      // Fast-path intent heuristics (skip LLM router for latency)
      const userText = input.messages.slice().reverse().find(m => m.role === 'user')?.content ?? ''
      const quickRegex = /\b(search|look up|find|news|latest|open\s+url|go to)\b/i
      const urlMatchHeuristic = /https?:\/\/\S+/i.test(userText)
      const wantsQuick = searchEnabled && (quickRegex.test(userText) || urlMatchHeuristic)
      let quickContext: string | undefined
      let quickHits: QuickResult[] | undefined
      if (wantsQuick) {
        try {
          const urlMatch = userText.match(/https?:\/\/\S+/)
          if (urlMatch) {
            const readable = await fetchReadable(urlMatch[0])
            if (readable) quickContext = `Source ${urlMatch[0]}\n\n${readable}`
            quickHits = [{ title: urlMatch[0], url: urlMatch[0] }]
          } else {
            const q = userText.replace(/^\s*(?:please\s*)?(?:search|look up|find|check)\s*/i, '').trim()
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
      // Heuristic knobs to emulate LM Studio effort locally when server ignores reasoning fields
      const effortToTemp = rl === 'high' ? 0.2 : rl === 'low' ? 0.8 : 0.6
      const effortToTopP = rl === 'high' ? 0.4 : rl === 'low' ? 0.95 : 0.8
      const effortToPresence = rl === 'high' ? -0.2 : rl === 'low' ? 0.4 : 0.1
      const effortToFreq = rl === 'high' ? -0.2 : rl === 'low' ? 0.4 : 0.1
      const reasoningHint = `reasoning: ${rl}\nReasoning Effort: ${rl}`
      const systemIdx = guardedMessages.findIndex(m => m.role === 'system')
      if (systemIdx >= 0) guardedMessages[systemIdx] = { role: 'system', content: guardedMessages[systemIdx].content + `\n${reasoningHint}` }

      // Streaming support: default ON for chat unless explicitly disabled
      const doStream = (input as any).stream !== false
      // Ollama path (supports streaming)
      if (typeof modelName === 'string' && modelName.startsWith('ollama:')) {
        try {
          const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
          const userMax = typeof (input as any).maxTokens === 'number' ? (input as any).maxTokens : undefined
          const userTopP = typeof (input as any).topP === 'number' ? (input as any).topP : undefined
          const resp = await fetch(base + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelName.replace(/^ollama:/, ''),
              messages: guardedMessages.map(m => ({ role: m.role, content: m.content })),
              stream: doStream,
              think: showThinking,
              options: {
                temperature: input.temperature ?? effortToTemp,
                top_p: userTopP ?? effortToTopP,
                presence_penalty: effortToPresence,
                frequency_penalty: effortToFreq,
                num_predict: userMax ?? 512,
              }
            })
          })
          if (!resp.ok) {
            const msg = await resp.text().catch(() => '')
            return { success: false, error: `Ollama HTTP ${resp.status}: ${msg.slice(0, 200)}`, content: '' }
          }
          if (doStream && resp.body) {
            // NDJSON-style stream: one JSON object per line
            const reader = (resp.body as any).getReader ? resp.body.getReader() : null
            let raw = ''
            let rawThinking = ''
            let buffer = ''
            const decoder = new TextDecoder()
            async function flush() {
              // Prefer explicit thinking stream when available; otherwise derive from <think> tags
              let thinkingOut = rawThinking
              let answerOut = raw
              try {
                if (!thinkingOut) {
                  const thinkMatch = answerOut.match(/<think>([\s\S]*?)<\/think>/i)
                  if (thinkMatch?.[1]) {
                    thinkingOut = (thinkingOut + thinkMatch[1]).trim()
                    answerOut = answerOut.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
                  }
                }
              } catch {}
              if (showThinking && input.thinkingId) {
                eventBus.emit('event', { type: 'stream_thinking', id: input.thinkingId, content: thinkingOut })
              }
              if (input.answerId) {
                eventBus.emit('event', { type: 'stream_answer', id: input.answerId, content: answerOut })
              }
            }
            if (reader) {
              while (true) {
                const { value, done } = await reader.read()
                if (done) break
                const text = decoder.decode(value, { stream: true })
                buffer += text
                const lines = buffer.split(/\n/)
                buffer = lines.pop() || ''
                for (const line of lines) {
                  const trimmed = line.trim()
                  if (!trimmed) continue
                  try {
                    const obj: any = JSON.parse(trimmed)
                    const piece = String(obj?.message?.content || '')
                    const thinkPiece = String(obj?.message?.thinking ?? obj?.thinking ?? '')
                    if (piece) raw += piece
                    if (thinkPiece) rawThinking += thinkPiece
                    await flush()
                  } catch {
                    // ignore parse errors
                  }
                }
              }
              // final flush once stream ends
              await flush()
              // return final content snapshot
              let finalThinking = rawThinking
              let finalAnswer = raw
              try {
                if (!finalThinking) {
                  const finalThinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i)
                  finalThinking = finalThinkMatch?.[1]?.trim() || ''
                  finalAnswer = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
                }
              } catch {}
              return { success: true, content: finalAnswer, model: modelName, links: quickHits?.slice(0, 3), thinking: showThinking ? finalThinking : '' }
            } else {
              // Fallback: no reader (older runtime) – treat as non-stream
              const text = await resp.text()
              try {
                const jj: any = JSON.parse(text)
                raw = String(jj?.message?.content || '')
                rawThinking = String(jj?.message?.thinking ?? jj?.thinking ?? '')
              } catch { raw = text }
              let thinking = rawThinking
              let answer = raw
              try {
                if (!thinking) {
                  const m = raw.match(/<think>([\s\S]*?)<\/think>/i)
                  thinking = m?.[1]?.trim() || ''
                  answer = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
                }
              } catch {}
              if (showThinking && input.thinkingId && thinking) eventBus.emit('event', { type: 'stream_thinking', id: input.thinkingId, content: thinking })
              return { success: true, content: answer, model: modelName, links: quickHits?.slice(0, 3), thinking: showThinking ? thinking : '' }
            }
          } else {
            // Non-stream
            const jj: any = await resp.json()
            let content: string = String(jj?.message?.content || '')
            let thinking: string = String(jj?.message?.thinking ?? jj?.thinking ?? '')
            try {
              if (!thinking) {
                const m = content.match(/<think>([\s\S]*?)<\/think>/i)
                if (m && m[1]) {
                  thinking = m[1].trim()
                  content = content.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
                }
              }
            } catch {}
            if (showThinking && input.thinkingId && thinking) {
              eventBus.emit('event', { type: 'stream_thinking', id: input.thinkingId, content: thinking })
            }
            return { success: true, content, model: modelName, links: quickHits?.slice(0, 3), thinking: showThinking ? thinking : '' }
          }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Ollama error', content: '' }
        }
      }
      if (doStream) {
        const resp = await client.chat(guardedMessages as any, modelName, {
          temperature: input.temperature ?? effortToTemp,
          topP: effortToTopP,
          presencePenalty: effortToPresence,
          frequencyPenalty: effortToFreq,
          stream: true,
          reasoningEffort: rl,
          maxTokens: typeof (input as any).maxTokens === 'number' ? (input as any).maxTokens : 512,
        })
        // LM Studio streams SSE. Read chunks robustly and parse `data:` lines.
        let answer = ''
        let thinking = ''
        let rawAllContent = ''
        const body: any = resp.body
        const decoder = new TextDecoder()
        let buffer = ''
        async function handleText(text: string) {
          buffer += text
          const events = buffer.split(/\n\n/)
          buffer = events.pop() || ''
          for (const evt of events) {
            const dataLines = evt.split(/\n/).filter(l => l.startsWith('data:'))
            const payload = dataLines.map(l => l.replace(/^data:\s*/, '')).join('\n').trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const delta = JSON.parse(payload)
              const piece = delta?.choices?.[0]?.delta || {}
              if (typeof piece?.reasoning_content === 'string') {
                thinking += piece.reasoning_content
              }
              if (typeof piece?.content === 'string') {
                rawAllContent += piece.content
              }
              // Derive <think> ... </think> from raw content, even mid-stream
              let derivedThinking = ''
              let derivedAnswer = rawAllContent
              try {
                const closedSegments = derivedAnswer.match(/<think>[\s\S]*?<\/think>/g) || []
                derivedThinking = closedSegments.map(s => s.replace(/^<think>/i, '').replace(/<\/think>$/i, '').slice(0)).join('')
                // Handle an open <think> without closing yet
                const lastOpen = derivedAnswer.lastIndexOf('<think>')
                const lastClose = derivedAnswer.lastIndexOf('</think>')
                if (lastOpen > -1 && lastOpen > lastClose) {
                  derivedThinking += derivedAnswer.slice(lastOpen + 7)
                }
                // Remove all <think> blocks (closed and open tail) from the answer view
                derivedAnswer = derivedAnswer.replace(/<think>[\s\S]*?<\/think>/g, '')
                if (lastOpen > -1 && lastOpen > lastClose) {
                  derivedAnswer = derivedAnswer.slice(0, lastOpen)
                }
              } catch {}
              const combinedThinking = (thinking + derivedThinking).trim()
              if (showThinking && input.thinkingId) {
                eventBus.emit('event', { type: 'stream_thinking', id: input.thinkingId, content: combinedThinking })
              }
              answer = derivedAnswer
              if (input.answerId) {
                eventBus.emit('event', { type: 'stream_answer', id: input.answerId, content: answer })
              }
            } catch {
              // ignore bad json
            }
          }
        }
        if (body?.getReader) {
          const reader = body.getReader()
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            await handleText(decoder.decode(value, { stream: true }))
          }
        } else if (body) {
          for await (const chunk of body as any) {
            await handleText(decoder.decode(chunk, { stream: true }))
          }
        }
        return { success: true, content: answer.trim(), model: modelName, links: quickHits?.slice(0, 3), thinking: showThinking ? thinking : '' }
      } else {
        // Non-streamed request
        const resp = await client.chat(
          guardedMessages as any,
          modelName,
          {
            temperature: input.temperature ?? effortToTemp,
            topP: effortToTopP,
            presencePenalty: effortToPresence,
            frequencyPenalty: effortToFreq,
            stream: false,
            reasoningEffort: rl,
            maxTokens: typeof (input as any).maxTokens === 'number' ? (input as any).maxTokens : 512,
          }
        )
        const jj: any = await resp.json()
        const contentAll: string = jj?.choices?.[0]?.message?.content ?? ''
        const reasoningSeparated: string = jj?.choices?.[0]?.message?.reasoning_content || ''
        const extract = (() => {
          try {
            const tagFinal = contentAll.match(/<final>([\s\S]*?)<\/final>/i)
            if (tagFinal?.[1]) return { content: tagFinal[1].trim(), thinking: contentAll.replace(/<final>[\s\S]*$/i, '').trim() }
          } catch {}
          return { content: contentAll.trim(), thinking: '' }
        })()
        let cleaned = extract.content
        cleaned = cleaned.replace(/<\|[^>]+\|>/g, '')
        cleaned = cleaned.replace(/^\s*commentary\s+to=[^\n]*$/gim, '')
        cleaned = cleaned.replace(/^\s*code\s*\{[\s\S]*$/gim, '')
        return { success: true, content: cleaned, model: modelName,
          links: quickHits?.slice(0, 3),
          thinking: showThinking ? (reasoningSeparated || extract.thinking) : ''
        }
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


