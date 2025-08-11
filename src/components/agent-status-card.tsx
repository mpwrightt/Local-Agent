import { cn } from "@/lib/utils"
import { CheckCircle2, Loader2, Mic, Timer } from "lucide-react"

export function AgentStatusCard({
  status = "Idle",
}: {
  status?: "Idle" | "Listening" | "Thinking" | "Executing"
}) {
  const color = {
    Idle: "bg-white/30",
    Listening: "bg-[rgba(0,191,255,0.9)]",
    Thinking: "bg-[rgba(255,0,255,0.9)]",
    Executing: "bg-amber-400",
  }[status]

  const labelIcon =
    status === "Idle" ? Timer : status === "Listening" ? Mic : status === "Thinking" ? Loader2 : CheckCircle2

  const Icon = labelIcon

  return (
    <div
      className={cn("rounded-xl p-3", "ring-1 ring-white/10")}
      style={{
        background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))",
        backdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className={cn("block h-3 w-3 rounded-full", color)} />
          {(status === "Listening" || status === "Thinking") && (
            <span
              className="absolute inset-[-6px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(0,191,255,0.25), transparent 70%)",
                animation: "pulseGlow 1.8s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Icon className={cn("h-4 w-4", status === "Thinking" && "animate-spin")} />
          <span>{status === 'Executing' ? 'Running' : status}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/50">
        The assistant adapts status as it listens, thinks, and executes tasks.
      </p>
      <style>{`
        @keyframes pulseGlow {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
