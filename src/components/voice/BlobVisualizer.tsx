export function BlobVisualizer({ listening, speaking }: { listening: boolean; speaking: boolean }) {
  const size = 180
  const hue = speaking ? 150 : listening ? 260 : 220
  return (
    <div
      style={{
        width: size,
        height: size,
        filter: 'blur(0.2px)',
        background: `radial-gradient(60% 60% at 50% 50%, hsl(${hue} 85% 65% / .9), hsl(${hue} 85% 40% / .6))`,
        boxShadow: `0 0 60px hsl(${hue} 85% 55% / .35)`,
        animation: speaking ? 'blobPulse 1.2s ease-in-out infinite' : listening ? 'blobBreathe 2s ease-in-out infinite' : 'none',
      }}
      className="rounded-full backdrop-blur-sm"
    >
      <style>{`
        @keyframes blobPulse {
          0% { transform: scale(0.96) translateZ(0); border-radius: 46% 54% 48% 52% / 50% 46% 54% 50%; }
          50% { transform: scale(1.06) translateZ(0); border-radius: 58% 42% 54% 46% / 44% 58% 42% 56%; }
          100% { transform: scale(0.96) translateZ(0); border-radius: 46% 54% 48% 52% / 50% 46% 54% 50%; }
        }
        @keyframes blobBreathe {
          0% { transform: scale(0.98) translateZ(0); border-radius: 50% 52% 48% 50% / 48% 50% 52% 50%; }
          50% { transform: scale(1.03) translateZ(0); border-radius: 46% 54% 50% 50% / 54% 46% 50% 50%; }
          100% { transform: scale(0.98) translateZ(0); border-radius: 50% 52% 48% 50% / 48% 50% 52% 50%; }
        }
      `}</style>
    </div>
  )
}


