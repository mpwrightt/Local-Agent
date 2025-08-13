import type { ReactNode } from 'react'

export function Tabs({ children }: { value?: string; onValueChange?: (v: string) => void; children: ReactNode }) { return <div>{children}</div> }

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="flex border-t border-white/10">{children}</div>
}

export function TabsTrigger({ active, onClick, children }: { value?: string; active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm font-medium transition ${active ? 'text-white bg-white/5 border-b-2 border-purple-400' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}
    >
      {children}
    </button>
  )
}

export function TabsContent({ hidden, children }: { hidden?: boolean; children: ReactNode }) {
  return hidden ? null : <>{children}</>
}


