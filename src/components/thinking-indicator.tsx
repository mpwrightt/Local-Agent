export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </div>
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{
        background: "radial-gradient(circle at 30% 30%, rgba(0,191,255,0.95), rgba(255,0,255,0.9))",
        animation: "tdot 1.2s ease-in-out infinite",
        animationDelay: `${delay}ms`,
        boxShadow: "0 0 8px rgba(255,0,255,0.3)",
      }}
    />
  )
}
