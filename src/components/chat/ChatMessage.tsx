import { cn } from '../../lib/cn'

type Role = 'user' | 'assistant' | 'tool' | 'system'

export function ChatMessage({
  role,
  content,
  children,
}: {
  role: Role
  content?: string
  children?: React.ReactNode
}) {
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'
  const isTool = role === 'tool'
  const bubble = cn(
    'rounded-xl border px-3 py-2 text-sm',
    isAssistant && 'bg-violet-900/30 border-violet-900/40 text-violet-100',
    isUser && 'bg-neutral-800 border-neutral-700 text-neutral-100',
    isTool && 'bg-indigo-900/25 border-indigo-900/40 text-indigo-100',
    role === 'system' && 'bg-neutral-900 border-neutral-800 text-neutral-400',
  )
  const label = isUser ? 'You' : isAssistant ? 'Agent' : isTool ? 'Tool' : 'System'

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-8 w-8 shrink-0 select-none rounded-full bg-gradient-to-b from-violet-600 to-violet-800 text-xs grid place-items-center text-white">
          {label[0]}
        </div>
      )}
      <div className="min-w-0 max-w-[min(780px,90%)]">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
        <div className={bubble}>
          {content && <div className="whitespace-pre-wrap break-words">{content}</div>}
          {children}
        </div>
      </div>
      {isUser && (
        <div className="h-8 w-8 shrink-0 select-none rounded-full bg-gradient-to-b from-violet-500 to-violet-700 text-xs grid place-items-center text-white">
          Y
        </div>
      )}
    </div>
  )
}

export function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
    </div>
  )
}


