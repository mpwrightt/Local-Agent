import { useEffect, useMemo, useState, useRef } from 'react'
import { VisualizerSwitcher } from '@/components/voice/VisualizerSwitcher'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatInput, type AgentMode } from '@/components/chat-input'
import { ChatMessageBubble, type ChatMessage as V0ChatMessage } from '@/components/chat-message'
import { LogsViewer, eventToLogEntry } from '@/components/logs-viewer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { quickSearch } from '@/agent/web'

type AgentPayload = {
  type?: string
  result?: unknown
  model?: string
  screenshot?: string
  aggregatePath?: string
  articles?: Array<{ title?: string; url?: string; path: string }>
  path?: string
  dest?: string
  results?: string[]
}
type RunEvent = { created_at?: string; payload: AgentPayload; runId: string }

type Conversation = {
  id: string
  title: string
  preview: string
  messages: V0ChatMessage[]
}

export default function App() {
  const [status, setStatus] = useState<'Idle' | 'Listening' | 'Thinking' | 'Executing'>('Idle')
  const [modelName, setModelName] = useState<string>('openai/gpt-oss-20b')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [agentMode, setAgentMode] = useState<AgentMode>('chat')
  const [reasoningLevel, setReasoningLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [ollamaParams, setOllamaParams] = useState<{ temperature?: number; top_p?: number; presence_penalty?: number; frequency_penalty?: number; max_tokens?: number }>({})
  
  // Debug logging for reasoning level changes
  const debugSetReasoningLevel = (level: 'low' | 'medium' | 'high') => {
    console.log(`[Debug] Reasoning level changing to ${level}`)
    setReasoningLevel(level)
    // Verify the change took effect
    setTimeout(() => {
      console.log(`[Debug] Reasoning level is now: ${level}`)
    }, 100)
  }
  const [showLinkCards, setShowLinkCards] = useState<boolean>(true)
  const [searchEnabled, setSearchEnabled] = useState<boolean>(true)
  const [showThinking, setShowThinking] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'voice' | 'logs'>('chat')
  const [voiceBusy, setVoiceBusy] = useState<boolean>(false)
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([])
  const [voiceId, setVoiceId] = useState<string>('21m00Tcm4TlvDq8ikWAM')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [remoteMode] = useState<boolean>(false)
  const [remoteBase] = useState<string>('')
  const [remoteToken] = useState<string>('')
  const [logs, setLogs] = useState<Array<ReturnType<typeof eventToLogEntry>>>([])
  // Load models list from bridge (LM Studio and Ollama)
  useEffect(() => {
    (async () => {
      try {
        const agent = (window as any).agent
        const list = await agent?.listModels?.()
        if (Array.isArray(list) && list.length) setAvailableModels(list)
        const def = await agent?.getDefaultModel?.()
        if (def && typeof def.model === 'string' && def.model.trim()) setModelName(def.model)
      } catch {}
    })()
  }, [])
  async function refreshModels() {
    try {
      const agent = (window as any).agent
      const list = await agent?.listModels?.()
      if (Array.isArray(list) && list.length) setAvailableModels(list)
    } catch {}
  }
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 'conv-1', title: 'New chat', preview: '', messages: [] },
  ])
  const [activeId, setActiveId] = useState<string>('conv-1')
  const [uploadedImage, setUploadedImage] = useState<{
    file: File
    dataUrl: string
    name: string
  } | null>(null)
  // Guards to avoid duplicate research UI per run/task
  const renderedResearchUIRef = useRef<Set<string>>(new Set()) // keys: runId
  const renderedResearchJSONRef = useRef<Set<string>>(new Set()) // keys: runId
  const pendingDMRef = useRef<{ to: string; message?: string } | null>(null)

  const agentAny = (!remoteMode && typeof window !== 'undefined'
    ? (window as unknown as { agent?: {
    startTask?: (input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }) => Promise<{ runId: string }>
        simpleChat?: (input: { messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; model?: string; temperature?: number; reasoningLevel?: 'low' | 'medium' | 'high'; searchEnabled?: boolean }) => Promise<{ success: boolean; content: string; error?: string; model?: string; links?: Array<{ title: string; url: string; snippet?: string }> }>
    confirmDangerous?: (input: { runId: string; taskId: string; confirm: boolean }) => Promise<void>
    cancelRun?: (input: { runId: string }) => Promise<void>
    openPath?: (input: { path: string }) => Promise<void>
    revealInFolder?: (input: { path: string }) => Promise<void>
        saveUploadedImage?: (input: { dataUrl: string; fileName: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>
        onEvent?: (handler: (event: RunEvent) => void) => () => void
      } })?.agent
    : undefined)
  const hasAgent = Boolean(agentAny && typeof agentAny.onEvent === 'function')

  const activeConversation = conversations.find((c) => c.id === activeId)!

  function appendMessage(msg: V0ChatMessage) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: [...c.messages, msg],
              preview: (msg.content || '').slice(0, 32),
              title: c.title === 'New chat' && msg.role === 'user' && msg.content ? msg.content.slice(0, 60) : c.title,
            }
          : c,
      ),
    )
    // Auto-scroll to bottom after message append (next tick to allow DOM render)
    try {
      setTimeout(() => {
        const root = document.getElementById('chat-scroll-root')
        if (!root) return
        const scroller = root.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null
        if (scroller) {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
        } else {
          root.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }, 0)
    } catch {}
  }

  async function handleFileAction(action: string, path: string) {
    if (!agentAny) return
    
    try {
      if (action === 'open') {
        await agentAny.openPath?.({ path })
      } else if (action === 'reveal') {
        await agentAny.revealInFolder?.({ path })
      }
    } catch (error) {
      console.error('File action failed:', error)
    }
  }

  const handleImageUpload = async (file: File) => {
    // Create data URL for preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      
      // Set the uploaded image state for preview
      setUploadedImage({
        file,
        dataUrl,
        name: file.name
      })
    }
    
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
  }

  async function handleStop() {
    if (!agentAny || !currentRunId) return
    try {
      await agentAny.cancelRun?.({ runId: currentRunId })
    } catch (error) {
      console.error('Stop failed:', error)
    } finally {
      // Optimistically reflect cancellation in UI; backend will also emit run_cancelled
      setStatus('Idle')
      setCurrentRunId(null)
    }
  }

  function handleClearLogs() {
    setLogs([])
  }

  useEffect(() => {
    if (!hasAgent) return
    const off = agentAny!.onEvent!((e: RunEvent) => {
      const p = e?.payload
      if (!p?.type) return
      
      // Add to logs
      const runId = e.runId || currentRunId || 'unknown'
      const logEntry = eventToLogEntry(e, runId)
      setLogs(prev => [...prev, logEntry])
      
      // Handle status changes
      if (p.type === 'run_started') {
        setStatus('Thinking')
        setCurrentRunId(runId)
      }
      // Do not mark Idle on task_result; wait for run_complete to keep Stop active during post-task events
      if (p.type === 'error') {
        setStatus('Idle')
        setCurrentRunId(null)
      }
      if (p.type === 'task_start' || (p.type === 'task_status' && (p as any).status === 'running')) {
        setStatus('Executing')
      }
      if (['ocr_start','ocr_process_start','ocr_batch_start','ocr_file_start'].includes(p.type)) {
        setStatus('Executing')
      }
      if (p.type === 'run_complete') {
        setStatus('Idle')
        setCurrentRunId(null)
        // Show a concise completion message in chat
        appendMessage({ id: `done:${Date.now()}`, role: 'ai', type: 'text', content: 'Task complete.' })
        // Fallback: if DM confirmation did not arrive from worker, synthesize the card
        const pending = pendingDMRef.current
        if (pending) {
          appendMessage({ id: `dm:${Date.now()}`, role: 'ai', type: 'dm_confirm', content: '', dm: { to: pending.to, message: pending.message, at: new Date().toISOString() } as any })
          pendingDMRef.current = null
        }
      }
      if (p.type === 'run_cancelled') {
        setStatus('Idle')
        setCurrentRunId(null)
      }
      if (p.type === 'confirm_dangerous') {
        const anyPayload = p as unknown as { runId?: string; taskId?: string; path?: string; op?: string }
        const open = confirm(`Confirm ${anyPayload.op ?? 'operation'} for:\n${anyPayload.path ?? ''}\n\nThis cannot be undone. Proceed?`)
        if (anyPayload.runId && anyPayload.taskId) agentAny!.confirmDangerous?.({ runId: anyPayload.runId, taskId: anyPayload.taskId, confirm: open })
        return
      }
      // Map events to chat messages
      const createdAt = e.created_at
      if (p.type === 'task_result') {
        const resultText = (p as any)?.result
        // Suppress generic "Task complete." noise; only show meaningful string results
        if (typeof resultText === 'string') {
          const trimmed = resultText.trim()
          if (trimmed && !/^task complete\.?$/i.test(trimmed) && !/^task completed successfully$/i.test(trimmed)) {
            appendMessage({ id: `ai:${createdAt ?? Date.now()}`, role: 'ai', type: 'text', content: trimmed })
          }
        }
      } else if ((p as any)?.type === 'dm_sent') {
        const to = (p as any)?.to || 'recipient'
        const msg = (p as any)?.message || ''
        appendMessage({ id: `ai:${createdAt ?? Date.now()}`, role: 'ai', type: 'dm_confirm', content: '', dm: { to, message: msg, at: new Date().toISOString() } as any })
        pendingDMRef.current = null
      } else if ((p as any)?.type === 'dm_hint') {
        // Pre-store hint; actual confirmation may arrive later
        const to = (p as any)?.to || ''
        const msg = (p as any)?.message || ''
        pendingDMRef.current = { to, message: msg }
      } else if (p.type === 'ocr_response') {
        // Direct OCR response for uploaded images
        const payload = p as any
        appendMessage({
          id: `ocr:${createdAt ?? Date.now()}`,
          role: 'ai',
          type: 'text',
          content: payload.message || 'OCR processing completed.'
        })
      } else if (p.type === 'file_located') {
        // Convert file_located events to file operation messages with action buttons
        const payload = p as any
        const results = payload.results || []
        const query = payload.query || ''
        const searchType = payload.searchType || 'filename'
        const ocrResults = payload.ocrResults || []
        
        appendMessage({ 
          id: `file:${createdAt ?? Date.now()}`, 
          role: 'ai', 
          type: 'file_operation', 
          content: `Found ${results.length} result(s) for "${query}"${searchType === 'content' ? ' (OCR search)' : ''}`,
          file_operation: {
            operation: 'locate',
            query,
            results: results.map((path: string) => ({
              path,
              type: path.includes('.') && !path.endsWith('/') ? 'file' : 'folder'
            })),
            success: results.length > 0,
            searchType,
            ocrResults
          }
        })
      } else if (['research_result', 'file_write', 'file_renamed'].includes(p.type)) {
        const json = JSON.stringify(p, null, 2)
        // If research_result includes aggregatePath or an article path, read and render as Markdown too
        const anyP = p as any
        const agg = anyP.aggregatePath as string | undefined
        const evRunId = e.runId || currentRunId || 'unknown'
        const hasUI = renderedResearchUIRef.current.has(evRunId)
        const hasJSON = renderedResearchJSONRef.current.has(evRunId)
        if (anyP.type === 'research_result' && !hasUI && agg && (agentAny as any)?.readFileText) {
          ;(agentAny as any).readFileText({ path: agg }).then((res: any) => {
            if (res?.success && typeof res.content === 'string') {
              // Show a concise summary header and a collapsible Markdown report
              appendMessage({ id: `md:${createdAt ?? Date.now()}`, role: 'ai', type: 'markdown', content: '', markdown: { title: 'Research report', text: res.content, collapsible: true } })
              // Also render structured per-source list with quote actions
              const items = (anyP.articles || []).map((a: any) => ({ title: a.title ?? a.path.split('/').pop(), url: a.url ?? '', snippet: a.snippet ?? '', path: a.path }))
              appendMessage({ id: `sources:${createdAt ?? Date.now()}`, role: 'ai', type: 'sources', content: '', sources: items, sourcesQuery: anyP.query ?? '' })
              appendMessage({ id: `open:${createdAt ?? Date.now()}`, role: 'ai', type: 'file_operation', content: 'Open research folder', file_operation: {
                operation: 'locate',
                query: 'research output',
                results: (anyP.articles || []).map((a: any) => ({ path: a.path, type: 'file' as const }))
              } })
              renderedResearchUIRef.current.add(evRunId)
            }
          }).catch(() => {})
        }
        // Append a single collapsed JSON payload (for debugging)
        if (!hasJSON) {
          appendMessage({ id: `tool:${createdAt ?? Date.now()}`, role: 'ai', type: 'code', content: json, code: { language: 'json', code: json, collapsed: true } })
          renderedResearchJSONRef.current.add(evRunId)
        }
      }
    })
    return () => off?.()
  }, [hasAgent, agentAny, activeId])

  async function handleSend(text: string, options?: { mode?: AgentMode }) {
    // Pretty-print slash/JSON commands for the chat view
    let displayText = text
    try {
      const j = JSON.parse(text)
      if (j && typeof j === 'object') {
        const anyJ: any = j
        if (anyJ.meta?.kind === 'slack_dm') {
          const to = String(anyJ.meta.to || '').trim()
          const msg = String(anyJ.meta.message || '').trim()
          displayText = `Slack DM → ${to}${msg ? `: ${msg}` : ''}`
        } else if (anyJ.op === 'shell' && typeof anyJ.cmd === 'string') {
          const m = anyJ.cmd.match(/open\s+-a\s+"([^"]+)"/i)
          displayText = m?.[1] ? `Open ${m[1]}` : `Run shell: ${anyJ.cmd}`
        } else if (anyJ.op === 'locate') {
          const name = anyJ.name || '*'
          const scope = anyJ.scope || 'any'
          displayText = `Locate ${name} on ${scope}`
        }
      }
    } catch {}
    const userMsg: V0ChatMessage = {
      id: `user:${Date.now()}`,
      role: 'user' as const,
      type: uploadedImage ? 'image' as const : 'text' as const,
      content: displayText,
      ...(uploadedImage && {
        image: {
          src: uploadedImage.dataUrl,
          alt: uploadedImage.name
        }
      })
    }
    appendMessage(userMsg)
    
    // Clear the uploaded image after sending
    if (uploadedImage) {
      setUploadedImage(null)
    }
    
    // Browser-only fallback for simple Chat mode
    if (!hasAgent && !remoteMode) {
      if ((options?.mode ?? agentMode) === 'chat') {
        try {
          setStatus('Thinking')
          const chatHistory = activeConversation.messages
            .filter(m => m.role === 'user' || m.role === 'ai')
            .slice(-10)
            .map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.content || '' }))
          chatHistory.push({ role: 'user' as const, content: text })
          // Use Vite proxy in dev/preview to bypass CORS: /lm maps to 127.0.0.1:1234
          // In browser prod/dev, use the Vercel/Vite proxy at /lm; allow override via VITE_LMSTUDIO_HOST
          const baseURL = (import.meta as any)?.env?.VITE_LM_GATEWAY_URL || (import.meta as any)?.env?.VITE_LMSTUDIO_HOST || '/lm/v1'
          const temperature = reasoningLevel === 'high' ? 0.9 : reasoningLevel === 'low' ? 0.3 : 0.7
          
          // Debug logging for reasoning effort
          console.log(`[Browser Chat] Reasoning level: ${reasoningLevel}`)
          const requestBody = { 
            model: modelName, 
            messages: chatHistory, 
            temperature, 
            reasoning_effort: reasoningLevel  // ONLY use the format that worked in curl tests
          }
          console.log('[Browser Chat] Request body with reasoning_effort:', JSON.stringify(requestBody, null, 2))
          
          const resp = await fetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
          let content = 'Error contacting LM Studio'
          let thinkingContent = ''
          if (resp.ok) {
            const data: any = await resp.json()
            content = data?.choices?.[0]?.message?.content || content
            thinkingContent = data?.choices?.[0]?.message?.reasoning_content || ''
            
            // Debug logging to see what we got from LM Studio
            console.log('[Browser Chat] Response content:', content)
            console.log('[Browser Chat] Reasoning content:', thinkingContent)
          }
          const links = searchEnabled ? await quickSearch(text, 3) : []
          
          // Add thinking content if available and showThinking is enabled
          if (showThinking && thinkingContent) {
            appendMessage({ id: `think:${Date.now()}`, role: 'ai', type: 'thinking', content: thinkingContent })
          }
          appendMessage({ id: `ai:${Date.now()}`, role: 'ai', type: 'text', content, ...(showLinkCards && links.length ? { links } as any : {}) })
        } catch (err) {
          appendMessage({ id: `error:${Date.now()}`, role: 'ai', type: 'text', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        } finally {
          setStatus('Idle')
        }
        return
      }
      alert('Agent bridge not available in browser for this mode. Please run the Electron app or enable Remote mode for Tasks/Research.')
      return
    }

    if (remoteMode) {
      try {
        setStatus('Thinking')
        if ((options?.mode ?? agentMode) === 'chat') {
          const history = activeConversation.messages
            .filter(m => m.role === 'user' || m.role === 'ai')
            .slice(-10)
            .map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.content || '' }))
          history.push({ role: 'user' as const, content: text })
          
          // Debug logging for remote chat reasoning effort
          console.log(`[Remote Chat] Reasoning level: ${reasoningLevel}`)
          const remoteRequestBody = { 
            model: modelName, 
            messages: history, 
            reasoning_effort: reasoningLevel  // ONLY use the format that worked in curl tests
          }
          console.log('[Remote Chat] Request body:', remoteRequestBody)
          
          const resp = await fetch((((import.meta as any)?.env?.VITE_LM_GATEWAY_URL) || (import.meta as any)?.env?.VITE_LMSTUDIO_HOST || '/lm/v1').replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(remoteRequestBody)
          })
          let content = 'Error contacting LM Studio'
          let thinkingContent = ''
          if (resp.ok) { 
            const data: any = await resp.json()
            content = data?.choices?.[0]?.message?.content || content
            thinkingContent = data?.choices?.[0]?.message?.reasoning_content || ''
            
            // Debug logging for remote chat
            console.log('[Remote Chat] Response content:', content)
            console.log('[Remote Chat] Reasoning content:', thinkingContent)
          }
          const links = searchEnabled ? await quickSearch(text, 3) : []
          
          // Add thinking content if available and showThinking is enabled
          if (showThinking && thinkingContent) {
            appendMessage({ id: `think:${Date.now()}`, role: 'ai', type: 'thinking', content: thinkingContent })
          }
          appendMessage({ id: `ai:${Date.now()}`, role: 'ai', type: 'text', content, ...(showLinkCards && links.length ? { links } as any : {}) })
          setStatus('Idle')
          return
        }
        // Tasks/Research via remote agent API
        const base = remoteBase.replace(/\/$/, '') || ''
        const res = await fetch(base + '/api/startTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${remoteToken}` },
          body: JSON.stringify({ prompt: text, model: modelName, deep: (options?.mode ?? agentMode) === 'research', automation: (options?.mode ?? agentMode) === 'tasks' })
        })
        if (res.ok) {
          const { runId } = await res.json()
          setCurrentRunId(runId)
          // Attach SSE
          const ev = new EventSource(base + `/api/events?run=${encodeURIComponent(runId)}`, { withCredentials: false } as any)
          ev.onmessage = (m) => {
            try {
              const e = JSON.parse(m.data)
              // Reuse existing event mapping (minimal)
              const createdAt = e.created_at
              const p = e.payload
              if (p?.type === 'task_result' && typeof p.result === 'string') appendMessage({ id: `ai:${createdAt ?? Date.now()}`, role: 'ai', type: 'text', content: String(p.result) })
              if (p?.type === 'run_complete') { setStatus('Idle'); setCurrentRunId(null); ev.close() }
            } catch {}
          }
        } else {
          appendMessage({ id: `error:${Date.now()}`, role: 'ai', type: 'text', content: `Remote agent error: ${res.status}` })
          setStatus('Idle')
        }
      } catch (err) {
        appendMessage({ id: `error:${Date.now()}`, role: 'ai', type: 'text', content: `Remote error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        setStatus('Idle')
      }
      return
    }
    
    setStatus('Thinking')
    let mode = options?.mode ?? agentMode
    
    // Handle uploaded image for OCR processing
    let processedText = text
    let effectiveMode = mode
    
    if (uploadedImage) {
      // Auto-switch to Tasks mode for OCR processing when image is uploaded
      effectiveMode = 'tasks'
      
      try {
        const saveResult = await agentAny!.saveUploadedImage!({
          dataUrl: uploadedImage.dataUrl,
          fileName: uploadedImage.name
        })
        
        if (saveResult?.success && saveResult.filePath) {
          // Modify the text to include the image path for OCR processing
          processedText = `[UPLOADED_IMAGE_PATH:${saveResult.filePath}] ${text}`
        }
      } catch (error) {
        console.error('Failed to save uploaded image:', error)
      }
    }
    
    // Keep Chat mode for simple web lookups (runtime injects quick web context). Do not auto-switch here.

    if (effectiveMode === 'chat') {
      // Simple chat mode - direct LM Studio conversation
      try {
        const chatHistory = activeConversation.messages
          .filter(m => m.role === 'user' || m.role === 'ai')
          .slice(-10) // Keep last 10 messages for context
          .map(m => ({
            role: m.role === 'ai' ? 'assistant' as const : m.role as 'user',
            content: m.content || ''
          }))
        
        chatHistory.push({ role: 'user', content: processedText })
        
        // Prepare streaming placeholders ids
        const answerId = `ai:${Date.now()}`
        const thinkingId = `think:${Date.now()}`
        if (showThinking) {
          appendMessage({ id: thinkingId, role: 'ai', type: 'thinking', content: '' })
        }
        appendMessage({ id: answerId, role: 'ai', type: 'text', content: '' })
        const unsub = agentAny!.onEvent?.((e: any) => {
          const p = e?.payload || e
          if (!p) return
          if (p.type === 'stream_answer' && p.id === answerId) {
            // Replace last message content for this id
            setConversations(prev => prev.map(c => c.id !== activeId ? c : ({
              ...c,
              messages: c.messages.map(m => m.id === answerId ? { ...m, content: p.content || '' } as any : m)
            })))
          }
          if (p.type === 'stream_thinking' && p.id === thinkingId) {
            setConversations(prev => prev.map(c => c.id !== activeId ? c : ({
              ...c,
              messages: c.messages.map(m => m.id === thinkingId ? { ...m, content: p.content || '' } as any : m)
            })))
          }
        })
        const result = await agentAny!.simpleChat!({
          messages: chatHistory,
          model: modelName,
          temperature: reasoningLevel === 'high' ? 0.9 : reasoningLevel === 'low' ? 0.3 : 0.7,
          reasoningLevel,
          searchEnabled,
          showThinking,
          answerId,
          thinkingId,
          ...(modelName.startsWith('ollama:') ? { maxTokens: ollamaParams.max_tokens, topP: ollamaParams.top_p } : {}),
        } as any)
        if (typeof unsub === 'function') unsub()
        
        if (result.success) {
          const links = (result as any).links as Array<{ title: string; url: string; snippet?: string }> | undefined
          // finalize content (already streamed)
          setConversations(prev => prev.map(c => c.id !== activeId ? c : ({
            ...c,
            messages: c.messages.map(m => m.id === answerId ? { ...m, content: result.content, ...(showLinkCards && links?.length ? { links } : {}) } as any : m)
          })))
        } else {
          appendMessage({ 
            id: `error:${Date.now()}`, 
            role: 'ai', 
            type: 'text', 
            content: result.content || result.error || 'An error occurred'
          })
        }
      } catch (error) {
        appendMessage({ 
          id: `error:${Date.now()}`, 
          role: 'ai', 
          type: 'text', 
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
      setStatus('Idle')
        } else if (effectiveMode === 'tasks') {
      // Tasks mode - AI agent with Mac control, file ops, browser automation
      const result = await agentAny!.startTask!({
        prompt: processedText,
        model: modelName,
        deep: false, // Tasks don't need deep research
        automation: true // Enable automation capabilities
      })
      setCurrentRunId(result.runId)
    } else if (effectiveMode === 'research') {
      // Research mode - AI agent with web research and synthesis
      const result = await agentAny!.startTask!({ 
        prompt: processedText, 
        model: modelName, 
        deep: true // Enable deep research
      })
      setCurrentRunId(result.runId)
    }
  }

  function handleSelectConversation(id: string) {
    setActiveId(id)
  }

  function handleNewConversation() {
    const id = `conv-${Date.now()}`
    setConversations((prev) => [{ id, title: 'New chat', preview: '', messages: [] }, ...prev])
    setActiveId(id)
  }

  const sidebarConversations = useMemo(
    () => conversations.map((c) => ({ ...c })),
    [conversations],
  )

  return (
    <SidebarProvider>
      <AppSidebar status={status} conversations={sidebarConversations as any} activeId={activeId} onSelectConversation={handleSelectConversation} />
      <SidebarInset className="bg-[oklch(var(--background))] text-white h-svh flex flex-col overflow-hidden min-h-0" data-scheme="violet">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[oklch(var(--background))]/80 backdrop-blur supports-[backdrop-filter]:bg-[oklch(var(--background))]/60">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">Local Agent</span>
              <span className="hidden md:inline text-[11px] text-white/50">Electron + Vite</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white"
                value={modelName}
                onChange={(e) => {
                  const m = e.target.value
                  setModelName(m)
                  try { (window as any).agent?.setDefaultModel?.({ model: m }) } catch {}
                }}
                onClick={() => { refreshModels().catch(() => {}) }}
                title="LLM Model"
              >
                {[modelName, ...availableModels].filter((v, i, a) => v && a.indexOf(v) === i).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => refreshModels()} title="Refresh models">↻</Button>
              {modelName.startsWith('ollama:') && (
                <div className="flex items-center gap-2 ml-2">
                  <label className="text-[11px] text-white/60">Temp</label>
                  <input type="number" step="0.05" min="0" max="1" className="w-16 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white"
                    value={ollamaParams.temperature ?? ''}
                    onChange={(e) => setOllamaParams(p => ({ ...p, temperature: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    title="Ollama temperature"
                  />
                  <label className="text-[11px] text-white/60">TopP</label>
                  <input type="number" step="0.05" min="0" max="1" className="w-16 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white"
                    value={ollamaParams.top_p ?? ''}
                    onChange={(e) => setOllamaParams(p => ({ ...p, top_p: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    title="Ollama top_p"
                  />
                  <label className="text-[11px] text-white/60">MaxTok</label>
                  <input type="number" step="1" min="1" className="w-16 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white"
                    value={ollamaParams.max_tokens ?? ''}
                    onChange={(e) => setOllamaParams(p => ({ ...p, max_tokens: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    title="Ollama max tokens"
                  />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleNewConversation}>New Chat</Button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-t border-white/10">
            <button onClick={() => setActiveTab('chat')} className={`flex-1 px-4 py-2 text-sm font-medium transition ${activeTab === 'chat' ? 'text-white bg-white/5 border-b-2 border-purple-400' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>Chat</button>
            <button onClick={() => setActiveTab('voice')} className={`flex-1 px-4 py-2 text-sm font-medium transition ${activeTab === 'voice' ? 'text-white bg-white/5 border-b-2 border-purple-400' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>Voice</button>
            <button onClick={() => setActiveTab('logs')} className={`flex-1 px-4 py-2 text-sm font-medium transition relative ${activeTab === 'logs' ? 'text-white bg-white/5 border-b-2 border-purple-400' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>Logs{logs.length > 0 && (<span className="absolute -top-1 -right-1 h-2 w-2 bg-blue-400 rounded-full"></span>)}</button>
          </div>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {activeTab === 'chat' ? (
            <>
              <ScrollArea className="flex-1 min-h-0" onScrollCapture={() => {}}>
                <div className="flex justify-center p-4" id="chat-scroll-root">
                  <div className="w-full max-w-3xl space-y-3">
                    {activeConversation.messages.length === 0 ? (
                      <div className="mx-auto mt-24 max-w-md rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/70">
                        <div>No messages yet</div>
                        <div className="mt-1 text-white/50">Ask the agent to perform a task. Results will stream here.</div>
                      </div>
                    ) : (
                      activeConversation.messages.map((m) => (
                        <ChatMessageBubble key={m.id} message={m} onFileAction={handleFileAction} />
                  ))
                )}
              </div>
                </div>
              </ScrollArea>
              <div className="border-t border-white/10 p-3 sticky bottom-0 z-40 bg-[oklch(var(--background))]/80 backdrop-blur supports-[backdrop-filter]:bg-[oklch(var(--background))]/60">
                <div className="flex justify-center">
          <div className="w-full max-w-3xl">
                    <ChatInput 
                      status={status} 
                      running={!!currentRunId}
                      onStatusChange={setStatus} 
                      onSend={handleSend}
                      onUpload={handleImageUpload}
                      onStop={handleStop}
                      agentMode={agentMode}
                      onAgentModeChange={setAgentMode}
                      uploadedImage={uploadedImage}
                      onRemoveImage={handleRemoveImage}
              searchEnabled={searchEnabled}
              onSearchEnabledChange={setSearchEnabled}
              onEnhance={async (text) => {
                try {
                  const agent = agentAny
                  if (!agent) return text
                  // Use LM Studio via simpleChat with a prompt-engineering system message
                  const messages = [
                    { role: 'system' as const, content: 'You are a helpful prompt engineer. Rewrite the user\'s prompt to be clear, specific, and unambiguous. Preserve the user\'s intent. Prefer concise wording, include relevant qualifiers, and remove filler. Output only the improved prompt.' },
                    { role: 'user' as const, content: text },
                  ]
                  const res = await agent.simpleChat?.({ messages, model: modelName, temperature: 0.2 })
                  if (res?.success && res.content) return res.content.trim()
                  return text
                } catch {
                  return text
                }
              }}
              reasoningLevel={reasoningLevel}
              onReasoningLevelChange={debugSetReasoningLevel}
              showLinkCards={showLinkCards}
              onShowLinkCardsChange={setShowLinkCards}
              showThinking={showThinking}
              onShowThinkingChange={setShowThinking}
                    />
            {/* Settings moved into ChatInput popover */}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'voice' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-xl space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white/90 mb-2">ElevenLabs Voice</div>
                  <div className="text-xs text-white/60 mb-3">Hands-free: click mic to talk. Persona selector picks the ElevenLabs voice.</div>
                  <VoiceDuplex
                    busy={voiceBusy}
                    voiceId={voiceId}
                    onVoiceIdChange={setVoiceId}
                    voices={voices}
                    onLoadVoices={async () => {
                      try {
                        const res = await (window as any).agent?.listVoices?.()
                        if (res?.success && Array.isArray(res.voices)) setVoices(res.voices.map((v: any) => ({ id: v.id, name: v.name })))
                      } catch {}
                    }}
                    onSpeak={async (text) => {
                      setVoiceBusy(true)
                      try {
                        const res = await (window as any).agent?.voiceTTS?.({ text, voiceId })
                        if (res?.success && res.audioBase64) {
                          const src = `data:audio/mp3;base64,${res.audioBase64}`
                          if (!audioRef.current) audioRef.current = new Audio()
                          audioRef.current.src = src
                          ;(window as any).__localAgentAudioEl = audioRef.current
                          await audioRef.current.play()
                        }
                      } finally {
                        setVoiceBusy(false)
                      }
                    }}
                    onQueryNoChat={async (text) => {
                      try {
                        const agent = (window as any).agent
                        if (!agent?.simpleChat) return
                        const res = await agent.simpleChat({ 
                          messages: [ { role: 'user', content: text } ],
                          model: modelName,
                          temperature: reasoningLevel === 'high' ? 0.9 : reasoningLevel === 'low' ? 0.3 : 0.7,
                          reasoningLevel,
                          searchEnabled,
                          showThinking,
                          maxTokens: 120
                        })
                        const content = res?.success ? (res.content || '') : ''
                        if (content && content.trim()) {
                          setVoiceBusy(true)
                          try {
                            const t = await agent.voiceTTS?.({ text: content, voiceId })
                            if (t?.success && t.audioBase64) {
                              const src = `data:audio/mp3;base64,${t.audioBase64}`
                              if (!audioRef.current) audioRef.current = new Audio()
                              audioRef.current.src = src
                              ;(window as any).__localAgentAudioEl = audioRef.current
                              await audioRef.current.play()
                            }
                          } finally {
                            setVoiceBusy(false)
                          }
                        }
                      } catch {}
                    }}
                    >
                    </VoiceDuplex>
                </div>
              </div>
            </div>
          ) : (
            <LogsViewer logs={logs} onClear={handleClearLogs} />
          )}
          </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function VoiceDuplex({ busy, voiceId, onVoiceIdChange, voices, onLoadVoices, onSpeak: _onSpeak, onQueryNoChat, onUserQuery: _onUserQuery, children }: {
  busy: boolean
  voiceId: string
  onVoiceIdChange: (id: string) => void
  voices: Array<{ id: string; name: string }>
  onLoadVoices: () => Promise<void>
  onSpeak: (text: string) => Promise<void>
  onQueryNoChat: (text: string) => Promise<void>
  onUserQuery?: (text: string) => Promise<void>
  children?: any
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeRef = useRef<string>('audio/webm')
  useEffect(() => { onLoadVoices().catch(() => {}) }, [])
  useEffect(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SR) {
      const rec = new SR()
      recRef.current = rec
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (e: any) => {
        let final = ''
        let interimLocal = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) final += res[0].transcript
          else interimLocal += res[0].transcript
        }
        setInterim(interimLocal)
        if (final.trim()) {
          onQueryNoChat(final.trim())
        }
      }
      rec.onerror = () => {}
      rec.onend = () => { if (listening) { try { rec.start() } catch {} } }
      return () => { try { rec.onend = null; rec.stop() } catch {} }
    }
    recRef.current = null
    return () => {}
  }, [])
  async function toggle() {
    const sr = recRef.current
    if (sr) {
      if (listening) { try { sr.onend = null; sr.stop() } catch {}; setListening(false); setInterim(''); return }
      try { sr.start(); setListening(true); (window as any).__localAgentMicStream = null } catch {}
      return
    }
    // Fallback: MediaRecorder -> send to local Whisper via agent.speechToText
    if (listening) {
      try {
        setListening(false)
        const s = streamRef.current
        const mr: any = (globalThis as any).mediaRecorderRef
        if (mr) { try { mr.stop() } catch {} }
        if (s) { s.getTracks().forEach(t => t.stop()) }
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        chunksRef.current = []
        const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onerror = () => reject(new Error('read error'))
          fr.onload = () => {
            const result = String(fr.result || '')
            const m = result.match(/^data:[^;]+;base64,(.+)$/)
            resolve(m ? m[1] : '')
          }
          fr.readAsDataURL(b)
        })
        const b64 = await toBase64(blob)
        const res = await (window as any).agent?.speechToText?.({ audioBase64: b64, mimeType: mimeRef.current, fileName: `speech.${mimeRef.current.includes('ogg') ? 'ogg' : 'webm'}` })
        const text = (res && res.success && res.text) ? res.text : ''
        const final = (text || '').trim()
        if (final) { onQueryNoChat(final) }
      } catch {}
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      ;(window as any).__localAgentMicStream = stream
      const mime = ((): string => {
        const candidates = [
          'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'
        ]
        for (const c of candidates) { try { if ((globalThis as any).MediaRecorder?.isTypeSupported?.(c)) return c } catch {} }
        return 'audio/webm'
      })()
      mimeRef.current = mime
      const mr = new (globalThis as any).MediaRecorder(stream, { mimeType: mime })
      ;(globalThis as any).mediaRecorderRef = mr
      chunksRef.current = []
      mr.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {}
      mr.start()
      setInterim('')
      setListening(true)
    } catch {
      alert('Microphone access failed. Please allow mic permissions for Local Agent in System Settings > Privacy & Security > Microphone.')
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/70">Persona</div>
        <select className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white" value={voiceId} onChange={(e) => onVoiceIdChange(e.target.value)}>
          {[{ id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (default)' }, ...voices].map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-center mb-4">
        <VisualizerSwitcher listening={listening} speaking={busy} showControls={false} />
      </div>
      <VoiceTextBox disabled={busy} onSubmit={(t) => onQueryNoChat(t)} />
      <div className="flex items-center justify-center mb-3">
        <VisualizerSwitcher listening={false} speaking={false} showControls={true} className="settings-only" />
      </div>
      <div className="flex items-center justify-center">
        <button onClick={toggle} disabled={busy} className={`relative h-24 w-24 rounded-full border ${listening ? 'border-blue-400' : 'border-white/10'} bg-white/5 flex items-center justify-center transition-transform hover:scale-[1.03]`}>
          <span className={`h-16 w-16 rounded-full ${listening ? 'bg-blue-500/40 animate-pulse' : 'bg-white/10'}`}></span>
          <span className="absolute text-white/80 text-xs">{busy ? '...' : (listening ? 'Listening' : 'Tap to talk')}</span>
        </button>
      </div>
      {children}
      {interim && (
        <div className="text-center text-xs text-white/60">{interim}</div>
      )}
    </div>
  )
}

function VoiceTextBox({ disabled, onSubmit }: { disabled?: boolean; onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const t = value.trim()
        if (!t) return
        setValue('')
        onSubmit(t)
      }}
      className="flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type here to speak..."
        disabled={disabled}
        className="flex-1 h-9 rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/90 placeholder:text-white/40 outline-none"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="h-9 px-3 rounded-md border border-white/10 bg-white/10 text-white/90 text-sm hover:bg-white/15 disabled:opacity-50"
      >
        Speak
      </button>
    </form>
  )
}


