import { useState, useEffect } from 'react'
import { BlobVisualizer } from './BlobVisualizer'
import { VisualizerSettings } from './VisualizerSettings'
import { type ColorTheme, type VisualizerVariant } from './ColorThemes'

export type { VisualizerVariant } from './ColorThemes'

interface VisualizerSwitcherProps {
  listening: boolean
  speaking: boolean
  showControls?: boolean
  className?: string
}

export function VisualizerSwitcher({ listening, speaking, showControls = false, className = '' }: VisualizerSwitcherProps) {
  const [variant, setVariant] = useState<VisualizerVariant>('halo')
  const [colorTheme, setColorTheme] = useState<ColorTheme>('purple')
  const [isLoading, setIsLoading] = useState(true)

  // Load variant from persistent config
  useEffect(() => {
    const loadVariant = async () => {
      try {
        if (window.electronAPI?.getVisualizerVariant) {
          const result = await window.electronAPI.getVisualizerVariant()
          setVariant((result.variant as VisualizerVariant) || 'halo')
        } else {
          // Fallback to localStorage for web builds
          const storedVariant = localStorage.getItem('visualizerVariant')
          if (storedVariant && ['halo', 'blob', 'particles', 'waves', 'geometric', 'aurora'].includes(storedVariant)) {
            setVariant(storedVariant as VisualizerVariant)
          }
          
          const storedTheme = localStorage.getItem('visualizerColorTheme')
          if (storedTheme && ['purple', 'cyberpunk', 'ocean', 'sunset', 'monochrome', 'neon', 'aurora', 'forest'].includes(storedTheme)) {
            setColorTheme(storedTheme as ColorTheme)
          }
        }
      } catch {
        // Use default on error
      } finally {
        // Allow one tick so initial loading text can be asserted synchronously in tests
        setTimeout(() => setIsLoading(false), 0)
      }
    }
    loadVariant()
  }, [])

  // Listen for storage changes to sync between components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'visualizerVariant' && e.newValue) {
        if (['halo', 'blob', 'particles', 'waves', 'geometric', 'aurora'].includes(e.newValue)) {
          setVariant(e.newValue as VisualizerVariant)
        }
      }
      if (e.key === 'visualizerColorTheme' && e.newValue) {
        if (['purple', 'cyberpunk', 'ocean', 'sunset', 'monochrome', 'neon', 'aurora', 'forest'].includes(e.newValue)) {
          setColorTheme(e.newValue as ColorTheme)
        }
      }
    }

    // Listen for custom events (for same-window updates)
    const handleCustomUpdate = (e: CustomEvent) => {
      if (e.detail.type === 'visualizer-variant') {
        setVariant(e.detail.value)
      }
      if (e.detail.type === 'visualizer-theme') {
        setColorTheme(e.detail.value)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('visualizer-update', handleCustomUpdate as EventListener)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('visualizer-update', handleCustomUpdate as EventListener)
    }
  }, [])

  const handleVariantChange = async (newVariant: VisualizerVariant) => {
    setVariant(newVariant)
    try {
      if (window.electronAPI?.setVisualizerVariant) {
        try {
          await window.electronAPI.setVisualizerVariant({ variant: newVariant })
        } catch {}
      } else {
        // Fallback to localStorage for web builds
        localStorage.setItem('visualizerVariant', newVariant)
        // Dispatch custom event for same-window sync
        window.dispatchEvent(new CustomEvent('visualizer-update', { 
          detail: { type: 'visualizer-variant', value: newVariant }
        }))
      }
    } catch {
      // Ignore save errors
    }
  }

  const handleColorThemeChange = async (newTheme: ColorTheme) => {
    setColorTheme(newTheme)
    try {
      // Save to localStorage for web builds
      localStorage.setItem('visualizerColorTheme', newTheme)
      // Dispatch custom event for same-window sync
      window.dispatchEvent(new CustomEvent('visualizer-update', { 
        detail: { type: 'visualizer-theme', value: newTheme }
      }))
    } catch {
      // Ignore save errors
    }
  }


  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: 220, height: 220 }}>
        <div className="text-white/50 text-sm">Loading...</div>
      </div>
    )
  }

  // Settings-only mode (just show the settings button)
  if (className?.includes('settings-only')) {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {showControls && (
          <VisualizerSettings
            variant={variant}
            colorTheme={colorTheme}
            onVariantChange={handleVariantChange}
            onColorThemeChange={handleColorThemeChange}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {showControls && (
        <VisualizerSettings
          variant={variant}
          colorTheme={colorTheme}
          onVariantChange={handleVariantChange}
          onColorThemeChange={handleColorThemeChange}
          defaultOpen
        />
      )}
      <BlobVisualizer listening={listening} speaking={speaking} variant={variant} colorTheme={colorTheme} />
    </div>
  )
}
