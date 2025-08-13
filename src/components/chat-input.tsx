import { useEffect, useRef, useState } from "react"
// Button removed after merging Send/Stop into a single native button
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Paperclip, Mic, MicOff, SendHorizontal, Search, MessageCircle, Zap, Square, X, Wand2, SlidersHorizontal } from "lucide-react"
import { listSlashCommands, runSlashCommand } from "@/lib/commands"
import { CommandBuilder } from './command-builder'
import { cn } from "@/lib/utils"

export type AgentMode = "chat" | "tasks" | "research"

export function ChatInput({
  status: _status = "Idle",
  running = false,
  onStatusChange,
  onSend,
  onUpload,
  onStop,
  agentMode = "chat",
  onAgentModeChange,
  uploadedImage,
  onRemoveImage,
  searchEnabled = false,
  onSearchEnabledChange,
  onEnhance,
  reasoningLevel = 'medium',
  onReasoningLevelChange,
  showLinkCards = true,
  onShowLinkCardsChange,
  showThinking = true,
  onShowThinkingChange,
}: {
  status?: "Idle" | "Listening" | "Thinking" | "Executing"
  running?: boolean
  onStatusChange?: (s: "Idle" | "Listening" | "Thinking" | "Executing") => void
  onSend?: (text: string, options?: { mode?: AgentMode }) => void
  onUpload?: (file: File) => void
  onStop?: () => void
  agentMode?: AgentMode
  onAgentModeChange?: (mode: AgentMode) => void
  uploadedImage?: { file: File; dataUrl: string; name: string } | null
  onRemoveImage?: () => void
  searchEnabled?: boolean
  onSearchEnabledChange?: (enabled: boolean) => void
  onEnhance?: (text: string) => Promise<string>
  reasoningLevel?: 'low' | 'medium' | 'high'
  onReasoningLevelChange?: (level: 'low' | 'medium' | 'high') => void
  showLinkCards?: boolean
  onShowLinkCardsChange?: (v: boolean) => void
  showThinking?: boolean
  onShowThinkingChange?: (v: boolean) => void
}) {
  const [value, setValue] = useState("")
  const [listening, setListening] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // auto-resize textarea
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "0px"
    ta.style.height = Math.min(180, ta.scrollHeight) + "px"
  }, [value])

  function toggleListening() {
    const next = !listening
    setListening(next)
    onStatusChange?.(next ? "Listening" : "Idle")
  }

  function handleSend() {
    const text = value.trim()
    if (!text) return
    // Slash command handling
    if (text.startsWith('/')) {
      const res = runSlashCommand(text)
      if (res.ok) {
        onSend?.(res.output, { mode: res.forceMode ?? agentMode })
        setValue("")
        return
      }
    }
    onSend?.(text, { mode: agentMode })
    setValue("")
  }

  function handleStop() {
    onStop?.()
  }

  const isRunning = running || _status === "Thinking" || _status === "Executing"

  return (
    <div className="space-y-2 relative z-10">
      {/* Image Preview */}
      {uploadedImage && (
        <div className="flex items-start gap-2 p-2 rounded-lg border border-white/10 bg-white/5">
          <div className="relative">
            <img
              src={uploadedImage.dataUrl}
              alt={uploadedImage.name}
              className="w-12 h-12 object-cover rounded-md border border-white/10"
            />
            <button
              onClick={onRemoveImage}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/70 truncate">{uploadedImage.name}</div>
            <div className="text-xs text-white/50">Image ready to send with your message</div>
          </div>
        </div>
      )}
      
      {/* Main input area */}
      <div
        className="relative rounded-2xl border border-white/10 p-2 backdrop-blur"
        style={{
          background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask me anything, or type '/' for commands..."
          aria-label="Message input"
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent px-2 py-2 text-sm text-white/90 outline-none placeholder:text-white/40",
          )}
        />
        {/* Compact slash suggestions (floating, non-intrusive) */}
        {value.startsWith('/') && (
          <div className="absolute left-2 bottom-12 z-20 w-[min(360px,calc(100%-16px))] rounded-lg border border-white/10 bg-[oklch(var(--background))]/95 p-2 text-xs text-white/80 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/10">
            <div className="grid gap-1">
              {listSlashCommands(value).slice(0,4).map(cmd => (
                <div key={cmd.id} className="flex items-start gap-2 px-1 py-1 rounded-md hover:bg-white/5">
                  <div>
                    <div className="font-medium text-white/90">/{cmd.label}</div>
                    {cmd.description && <div className="text-white/60 line-clamp-1 max-w-[320px]">{cmd.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between px-1 pb-1">
          <div className="text-[10px] text-white/40">Enter to send · Shift+Enter for newline</div>
          <div className="flex items-center gap-2">
            {/* Enhance prompt button (icon-only) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async () => {
                    if (!onEnhance || !value.trim() || enhancing) return
                    try {
                      setEnhancing(true)
                      const improved = await onEnhance(value.trim())
                      if (typeof improved === 'string' && improved.trim()) setValue(improved.trim())
                    } finally {
                      setEnhancing(false)
                    }
                  }}
                  aria-label="Enhance prompt"
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:scale-[1.03]",
                    enhancing ? "bg-white/10" : "bg-white/5"
                  )}
                >
                  <Wand2 className={cn("h-4.5 w-4.5", enhancing ? "animate-pulse" : "")}/>
                </button>
              </TooltipTrigger>
              <TooltipContent>Enhance prompt</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleListening}
                  aria-pressed={listening}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:scale-[1.03]",
                    listening && "ring-2 ring-[rgba(0,191,255,0.5)]",
                  )}
                  style={{ background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))" }}
                >
                  {listening ? (
                    <>
                      <Mic className="h-4.5 w-4.5 text-[rgba(0,191,255,0.9)]" />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -z-10 rounded-xl"
                        style={{
                          inset: -6,
                          background: "radial-gradient(circle, rgba(0,191,255,0.16), transparent 60%)",
                          animation: "micPulse 1.8s ease-in-out infinite",
                        }}
                      />
                    </>
                  ) : (
                    <MicOff className="h-4.5 w-4.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{listening ? 'Stop voice input' : 'Start voice input'}</TooltipContent>
            </Tooltip>

            {/* Command Builder */}
            <CommandBuilder onInsert={(text) => setValue(text)} />

            {/* Settings popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Chat settings"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:scale-[1.03]"
                  )}
                >
                  <SlidersHorizontal className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <div className="space-y-3 text-sm text-white/90">
                  <div>
                    <div className="mb-1 text-xs text-white/60">Reasoning</div>
                    <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-0.5">
                      {(['low','medium','high'] as const).map(l => (
                        <button
                          key={l}
                          onClick={() => onReasoningLevelChange?.(l)}
                          className={cn(
                            "px-2 py-1 rounded-[6px] text-xs",
                            reasoningLevel===l ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'
                          )}
                        >{l}</button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/80">Show top links as cards</span>
                    <input aria-label="Show top links as cards" type="checkbox" checked={!!showLinkCards} onChange={e => onShowLinkCardsChange?.(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/80">Show reasoning box</span>
                    <input aria-label="Show reasoning box" type="checkbox" checked={!!showThinking} onChange={e => onShowThinkingChange?.(e.target.checked)} />
                  </label>
                </div>
              </PopoverContent>
            </Popover>

            {/* Search toggle moved into chatbox toolbar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSearchEnabledChange?.(!searchEnabled)}
                  aria-pressed={searchEnabled}
                  aria-label="Toggle quick web search"
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:scale-[1.03]",
                    searchEnabled ? "bg-[rgba(0,191,255,0.2)] text-[rgba(0,191,255,0.9)]" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  <Search className="h-4.5 w-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Quick web search</TooltipContent>
            </Tooltip>

            {/* Primary action: toggles between Send and Stop */}
            <button
              type="button"
              onClick={isRunning ? handleStop : handleSend}
              className={cn(
                "inline-flex items-center justify-center h-9 px-3 rounded-xl border transition hover:scale-[1.02]",
                isRunning
                  ? "border-red-500/20 bg-[linear-gradient(135deg,rgba(239,68,68,0.35),rgba(220,38,38,0.35))] text-white shadow-[0_8px_24px_rgba(239,68,68,0.3)]"
                  : "border-white/10 bg-[linear-gradient(135deg,rgba(var(--accent-1),0.35),rgba(var(--accent-2),0.35))] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
              )}
              data-testid={isRunning ? "stop-button" : "send-button"}
              aria-label={isRunning ? "Stop current task" : "Send message"}
              role="button"
              style={{ pointerEvents: 'auto' }}
              disabled={!isRunning && value.trim().length === 0}
            >
              {isRunning ? (
                <>
                  <Square className="mr-1 h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <SendHorizontal className="mr-1 h-4 w-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Controls under input */}
      <div className="grid grid-cols-[96px_1fr_96px] items-center gap-2">
        {/* File upload button (fixed-width column keeps layout stable) */}
        <div className="w-[96px] flex justify-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Attach image"
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:scale-[1.03] hover:bg-white/5"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Attach image</TooltipContent>
          </Tooltip>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload?.(f)
              e.currentTarget.value = ""
            }}
          />
        </div>

        {/* Three-Mode Selector (center column) */}
        <div className="justify-self-center flex h-8 rounded-lg border border-white/10 overflow-hidden bg-white/5">
          {/* Chat Mode */}
          <button
            onClick={() => onAgentModeChange?.("chat")}
            className={cn(
              "flex items-center gap-1 px-2 text-xs font-medium transition-all hover:bg-white/10",
              agentMode === "chat"
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/70"
            )}
            title="Chat mode: Simple conversation with AI"
          >
            <MessageCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Chat</span>
          </button>
          
          {/* Tasks Mode */}
          <button
            onClick={() => onAgentModeChange?.("tasks")}
            className={cn(
              "flex items-center gap-1 px-2 text-xs font-medium transition-all hover:bg-white/10 border-x border-white/10",
              agentMode === "tasks"
                ? "bg-[rgba(255,165,0,0.2)] text-[rgba(255,165,0,0.9)] shadow-sm"
                : "text-white/70"
            )}
            title="Tasks mode: AI controls Mac, files, browser automation"
          >
            <Zap className="h-3 w-3" />
            <span className="hidden sm:inline">Tasks</span>
          </button>
          
          {/* Research Mode */}
          <button
            onClick={() => onAgentModeChange?.("research")}
            className={cn(
              "flex items-center gap-1 px-2 text-xs font-medium transition-all hover:bg-white/10",
              agentMode === "research"
                ? "bg-[rgba(0,191,255,0.2)] text-[rgba(0,191,255,0.9)] shadow-sm"
                : "text-white/70"
            )}
            title="Research mode: AI researches web and writes reports"
          >
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline">Research</span>
          </button>
        </div>

        {/* Right spacer to balance layout (search moved into chatbox) */}
        <div className="w-[96px] h-8" aria-hidden />
      </div>

      <style>{`
        @keyframes micPulse {
          0% { transform: scale(0.96); opacity: 0.6; }
          50% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(0.96); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
