import { useState } from 'react'
import { type ColorTheme, type VisualizerVariant, COLOR_THEMES } from './ColorThemes'

interface VisualizerSettingsProps {
  variant: VisualizerVariant
  colorTheme: ColorTheme
  onVariantChange: (variant: VisualizerVariant) => void
  onColorThemeChange: (theme: ColorTheme) => void
  className?: string
  defaultOpen?: boolean
}

export function VisualizerSettings({ 
  variant, 
  colorTheme, 
  onVariantChange, 
  onColorThemeChange,
  className = '',
  defaultOpen = false,
}: VisualizerSettingsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const variants: { id: VisualizerVariant; name: string; description: string; icon: string }[] = [
    { id: 'halo', name: 'Halo', description: 'Glass ring with transmission effects', icon: '⭕' },
    { id: 'blob', name: 'Blob', description: 'Organic distorted sphere', icon: '🫧' },
    { id: 'particles', name: 'Particles', description: 'Floating particle cloud', icon: '✨' },
    { id: 'waves', name: 'Waves', description: 'Rippling wave surface', icon: '🌊' },
    { id: 'geometric', name: 'Geometric', description: 'Wireframe polyhedron', icon: '💎' },
    { id: 'aurora', name: 'Aurora', description: 'Flowing aurora curtain', icon: '🌌' }
  ]

  const themes = Object.entries(COLOR_THEMES).map(([id, theme]) => ({
    id: id as ColorTheme,
    ...theme
  }))

  return (
    <div className={`relative ${className}`}>
      {/* Settings Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 transition-all"
        title="Visualizer Settings"
      >
        <span className="text-sm">⚙️</span>
        <span className="text-xs">Settings</span>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Settings Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 max-h-[80vh] bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 space-y-6 max-h-[calc(80vh-2rem)] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Visualizer Settings</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-white/60 hover:text-white/90 text-xl"
                >
                  ×
                </button>
              </div>

              {/* Visualizer Variants */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white/90">Visualizer Style</h4>
                <div className="grid grid-cols-2 gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      aria-label={v.name}
                      onClick={() => onVariantChange(v.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        variant === v.id
                          ? 'border-violet-400 bg-violet-400/20 text-violet-200'
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white/90'
                      }`}
                      title={v.description}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{v.icon}</span>
                        <span className={`text-sm font-medium ${variant === v.id ? 'text-violet-200' : ''}`}>{v.name}</span>
                      </div>
                      <p className={`text-xs ${variant === v.id ? 'opacity-90 text-violet-200' : 'opacity-75'}`}>{v.description}</p>
                      <div className={`mt-2 h-px ${variant === v.id ? 'bg-violet-400' : 'bg-white/10'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Themes */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white/90">Color Theme</h4>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => onColorThemeChange(theme.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        colorTheme === theme.id
                          ? 'border-violet-400 bg-violet-400/20 text-violet-200'
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white/90'
                      }`}
                      title={theme.description}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-white/20" 
                            style={{ backgroundColor: theme.primary }}
                          />
                          <div 
                            className="w-3 h-3 rounded-full border border-white/20" 
                            style={{ backgroundColor: theme.secondary }}
                          />
                          <div 
                            className="w-3 h-3 rounded-full border border-white/20" 
                            style={{ backgroundColor: theme.accent }}
                          />
                        </div>
                        <span className="text-sm font-medium">{theme.name}</span>
                      </div>
                      <p className="text-xs opacity-75">{theme.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white/90">Preview</h4>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex gap-1">
                    <div 
                      className="w-4 h-4 rounded-full animate-pulse" 
                      style={{ 
                        backgroundColor: COLOR_THEMES[colorTheme].speaking,
                        boxShadow: `0 0 8px ${COLOR_THEMES[colorTheme].glow}`
                      }}
                    />
                    <div 
                      className="w-4 h-4 rounded-full opacity-60" 
                      style={{ backgroundColor: COLOR_THEMES[colorTheme].listening }}
                    />
                    <div 
                      className="w-4 h-4 rounded-full opacity-40" 
                      style={{ backgroundColor: COLOR_THEMES[colorTheme].idle }}
                    />
                  </div>
                  <div className="text-xs text-white/70">
                    <span style={{ color: COLOR_THEMES[colorTheme].speaking }}>Speaking</span>
                    {' • '}
                    <span style={{ color: COLOR_THEMES[colorTheme].listening }}>Listening</span>
                    {' • '}
                    <span style={{ color: COLOR_THEMES[colorTheme].idle }}>Idle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}