import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip, Mic, MicOff, SendHorizontal, Search, MessageCircle, Zap, Square, X } from "lucide-react"
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
}) {
  const [value, setValue] = useState("")
  const [listening, setListening] = useState(false)
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
    if (!value.trim()) return
    onSend?.(value.trim(), { mode: agentMode })
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
        className="rounded-2xl border border-white/10 p-2 backdrop-blur"
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
        <div className="flex items-center justify-between px-1 pb-1">
          <div className="text-[10px] text-white/40">Enter to send • Shift+Enter for newline</div>
          <div className="flex items-center gap-2">
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

            {/* Send/Stop Button */}
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-red-500/20 bg-[linear-gradient(135deg,rgba(239,68,68,0.35),rgba(220,38,38,0.35))] text-white shadow-[0_8px_24px_rgba(239,68,68,0.3)] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-red-400/40"
                data-testid="stop-button"
                aria-label="Stop current task"
                role="button"
                style={{ pointerEvents: 'auto' }}
              >
                <Square className="mr-1 h-4 w-4" />
                Stop
              </button>
            ) : value.trim().length > 0 && (
              <Button
                onClick={handleSend}
                className="h-9 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(var(--accent-1),0.35),rgba(var(--accent-2),0.35))] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition hover:scale-[1.02]"
              >
                <SendHorizontal className="mr-1 h-4 w-4" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Controls under input */}
      <div className="flex items-center justify-between">
        {/* File upload button */}
        <button
          aria-label="Attach file"
          onClick={() => fileRef.current?.click()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:scale-[1.03] hover:bg-white/5"
        >
          <Paperclip className="h-4 w-4" />
        </button>
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

        {/* Three-Mode Selector */}
        <div className="flex h-8 rounded-lg border border-white/10 overflow-hidden bg-white/5">
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
