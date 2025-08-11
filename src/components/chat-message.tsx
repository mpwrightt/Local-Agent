"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Bot, Check, Clipboard, ClipboardCheck, Download, File, ImageIcon, UserRound, FolderOpen, ExternalLink } from "lucide-react"
import { useState } from "react"

export type ChatMessage = {
  id: string
  role: "ai" | "user"
  type?: "text" | "summary" | "code" | "task" | "image" | "file_operation"
  content: string
  summary?: { title: string; bullets: string[] }
  code?: { language: string; code: string }
  task?: { title: string; steps: { label: string; done: boolean }[] }
  image?: { src: string; alt: string }
  file_operation?: { 
    operation: "locate" | "create" | "edit" | "delete" | "rename"
    query?: string
    results?: Array<{ path: string; type: "file" | "folder" }>
    success?: boolean
    searchType?: string
    ocrResults?: Array<{ path: string; extractedText: string; confidence: number; matchScore: number }>
  }
  suggestions?: string[]
}

function BasicMarkdown({ text }: { text: string }) {
  // Lightweight renderer: headers, bold, italics, lists, fenced code, and simple tables
  // Convert triple backticks blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const parts: Array<{ type: 'code' | 'html'; content: string; lang?: string }> = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = codeBlockRegex.exec(text))) {
    if (m.index > lastIndex) {
      parts.push({ type: 'html', content: text.slice(lastIndex, m.index) })
    }
    parts.push({ type: 'code', content: m[2], lang: m[1] || 'text' })
    lastIndex = codeBlockRegex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ type: 'html', content: text.slice(lastIndex) })

  function renderInline(s: string) {
    // headings
    s = s.replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    s = s.replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    s = s.replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    // bold/italic
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>')
    // lists
    s = s.replace(/^-\s+(.*)$/gm, '<li>$1</li>')
    s = s.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`) 
    // tables (pipe format)
    s = s.replace(/^(?:\|.*\|\n)+/gm, (block) => {
      const rows = block
        .trim()
        .split('\n')
        .filter((r) => !/^\|?\s*-+\s*(\|\s*-+\s*)+\|?$/.test(r)) // drop separator row
        .map((r) => r.trim().replace(/^\||\|$/g, ''))
      if (rows.length === 0) return block
      const cells = rows.map((r) => r.split('|').map((c) => c.trim()))
      const head = cells.shift()!
      const thead = `<thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${cells.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
      return `<table class="min-w-full border-separate border-spacing-y-1">${thead}${tbody}</table>`
    })
    // paragraphs
    s = s.replace(/\n{2,}/g, '</p><p>')
    s = `<p>${s}</p>`
    return s
  }

  return (
    <div className="prose prose-invert max-w-none">
      {parts.map((p, i) =>
        p.type === 'code' ? (
          <pre key={i} className="overflow-x-auto p-3 text-xs leading-relaxed text-white/90 bg-black/40 rounded-md border border-white/10">
            <code>{p.content}</code>
          </pre>
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: renderInline(p.content) }} />
        ),
      )}
    </div>
  )
}

export function ChatMessageBubble({
  message,
  onSuggestedAction,
  onFileAction,
}: {
  message: ChatMessage
  onSuggestedAction?: (a: string) => void
  onFileAction?: (action: string, path: string) => void
}) {
  const isAI = message.role === "ai"

  return (
    <div
      className={cn(
        "flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1",
        isAI ? "justify-start" : "justify-end",
      )}
    >
      {isAI && (
        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <Bot className="h-4 w-4 text-white/80" />
        </div>
      )}

      <div
        className={cn("max-w-[88%] rounded-2xl p-3 md:p-4", isAI ? "ai-bubble" : "user-bubble")}
        style={
          isAI
            ? {
                background: "linear-gradient(135deg, rgba(var(--accent-1),0.15), rgba(var(--accent-2),0.15))",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.4)",
              }
            : {
                background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)",
              }
        }
      >
        <div className={cn("prose prose-invert max-w-none", "text-sm leading-relaxed")}>
          <MessageContent message={message} onFileAction={onFileAction} />
        </div>

        {isAI && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestedAction?.(s)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:scale-[1.02] hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isAI && (
        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <UserRound className="h-4 w-4 text-white/80" />
        </div>
      )}
    </div>
  )
}

function MessageContent({ message, onFileAction }: { message: ChatMessage; onFileAction?: (action: string, path: string) => void }) {
  switch (message.type) {
    case "summary":
      return <SummaryCard title={message.summary?.title ?? "Summary"} bullets={message.summary?.bullets ?? []} />
    case "code":
      return <CodeBlock language={message.code?.language ?? "text"} code={message.code?.code ?? message.content} />
    case "task":
      return <TaskCard title={message.task?.title ?? "Task"} steps={message.task?.steps ?? []} />
    case "image":
      return (
        <ImageCard
          src={message.image?.src ?? "/placeholder.svg?height=180&width=320&query=image"}
          alt={message.image?.alt ?? "Image"}
          name={message.content}
        />
      )
    case "file_operation":
      return <FileOperationCard fileOp={message.file_operation!} onFileAction={onFileAction} />
    default:
      return <BasicMarkdown text={message.content} />
  }
}

function SummaryCard({ title, bullets }: { title: string; bullets: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = `${title}\n- ${bullets.join("\n- ")}`
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white/90">{title}</h4>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 gap-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-white/50">{language}</span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 gap-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20"
          onClick={async () => {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function TaskCard({ title, steps }: { title: string; steps: { label: string; done: boolean }[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h4 className="mb-2 text-sm font-semibold text-white/90">{title}</h4>
      <ul className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-white/80">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md ring-1 ring-white/10",
                s.done ? "bg-emerald-500/20" : "bg-white/5",
              )}
            >
              {s.done ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <File className="h-3.5 w-3.5 text-white/50" />
              )}
            </span>
            <span className={cn(s.done ? "line-through text-white/50" : "")}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImageCard({ src, alt, name }: { src: string; alt: string; name: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="truncate">{name}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 gap-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="text-xs">Download</span>
        </Button>
      </div>
      <img src={src || "/placeholder.svg"} alt={alt} className="max-h-72 w-full object-cover" />
    </div>
  )
}

function FileOperationCard({ fileOp, onFileAction }: { 
  fileOp: NonNullable<ChatMessage['file_operation']>
  onFileAction?: (action: string, path: string) => void 
}) {
  const operationTitles = {
    locate: "File Search Results",
    create: "File Created",
    edit: "File Modified", 
    delete: "File Deleted",
    rename: "File Renamed"
  }

  const title = operationTitles[fileOp.operation] || "File Operation"
  const hasResults = fileOp.results && fileOp.results.length > 0
  
  // Check if this is an OCR/content search result
  const isContentSearch = (fileOp as any).searchType === 'content' || 
                         (fileOp as any).ocrResults?.length > 0

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-white/70" />
          <h4 className="text-sm font-semibold text-white/90">
            {isContentSearch ? "Image Content Search Results" : title}
          </h4>
          {isContentSearch && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md">
              OCR
            </span>
          )}
        </div>
        {fileOp.query && (
          <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-md">
            "{fileOp.query}"
          </span>
        )}
      </div>

      {hasResults ? (
        <div className="space-y-2">
          {fileOp.results!.map((result, index) => {
            // Get OCR data if available
            const ocrData = (fileOp as any).ocrResults?.find((ocr: any) => ocr.path === result.path)
            
            return (
              <div key={index} className="rounded-lg bg-white/5 border border-white/5 p-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {result.type === 'folder' ? (
                      <FolderOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-white/70 flex-shrink-0" />
                    )}
                    <span className="text-sm text-white/80 truncate" title={result.path}>
                      {result.path.split('/').pop() || result.path}
                    </span>
                    {ocrData && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-md">
                        {Math.round(ocrData.confidence * 100)}% match
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20 text-xs px-2"
                      onClick={() => onFileAction?.('open', result.path)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20 text-xs px-2"
                      onClick={() => onFileAction?.('reveal', result.path)}
                    >
                      <FolderOpen className="h-3 w-3" />
                      Show
                    </Button>
                  </div>
                </div>
                
                {/* Show extracted text preview if available */}
                {ocrData && ocrData.extractedText && (
                  <div className="mt-2 p-2 rounded bg-black/20 border border-white/5">
                    <div className="text-xs text-white/50 mb-1">Extracted text:</div>
                    <div className="text-xs text-white/70 line-clamp-3">
                      {ocrData.extractedText}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          
          <div className="text-xs text-white/50 mt-2">
            Found {fileOp.results!.length} {fileOp.results!.length === 1 ? 'result' : 'results'}
            {isContentSearch && ' with matching text content'}
          </div>
        </div>
      ) : (
        <div className="text-sm text-white/60">
          {fileOp.success === false ? 'No results found' : 'Processing...'}
        </div>
      )}
    </div>
  )
}
