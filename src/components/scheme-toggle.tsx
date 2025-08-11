import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Palette } from "lucide-react"
import { cn } from "@/lib/utils"

type Scheme = "violet" | "teal"

export function SchemeToggle({ className }: { className?: string }) {
  const [scheme, setScheme] = useState<Scheme>("violet")

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("ai-scheme") as Scheme | null)) || "violet"
    setScheme(stored)
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-scheme", stored)
  }, [])

  function apply(next: Scheme) {
    setScheme(next)

    // Force update the CSS variables immediately
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-scheme", next)

      // Force a style recalculation
      document.documentElement.style.setProperty("--force-update", Math.random().toString())
    }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("ai-scheme", next)
    }
  }

  return (
    <div
      className={cn("flex items-center gap-2 rounded-xl border border-white/10 p-1.5", className)}
      style={{ background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))" }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10"
        style={{ background: "linear-gradient(135deg, rgba(var(--accent-1),0.12), rgba(var(--accent-2),0.08))" }}
      >
        <Palette className="h-3.5 w-3.5 text-white/80" aria-hidden />
      </div>
      <span className="text-xs text-white/70 font-medium">Theme</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Use Cyan to Violet scheme"
          aria-pressed={scheme === "violet"}
          onClick={() => apply("violet")}
          className={cn(
            "h-7 rounded-full border border-white/10 px-2.5 text-xs text-white/80 transition hover:scale-[1.02]",
            scheme === "violet" && "ring-1 ring-white/20 text-white",
          )}
          style={
            scheme === "violet"
              ? { background: "linear-gradient(135deg, rgba(0,191,255,0.35), rgba(168,85,247,0.35))" }
              : { background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))" }
          }
        >
          Violet
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Use Cyan to Teal scheme"
          aria-pressed={scheme === "teal"}
          onClick={() => apply("teal")}
          className={cn(
            "h-7 rounded-full border border-white/10 px-2.5 text-xs text-white/80 transition hover:scale-[1.02]",
            scheme === "teal" && "ring-1 ring-white/20 text-white",
          )}
          style={
            scheme === "teal"
              ? { background: "linear-gradient(135deg, rgba(0,191,255,0.35), rgba(20,184,166,0.35))" }
              : { background: "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))" }
          }
        >
          Teal
        </Button>
      </div>
    </div>
  )
}
