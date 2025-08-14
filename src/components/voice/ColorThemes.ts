export type ColorTheme = 'purple' | 'cyberpunk' | 'ocean' | 'sunset' | 'monochrome' | 'neon' | 'aurora' | 'forest'

export type VisualizerVariant = 'halo' | 'blob' | 'particles' | 'waves' | 'geometric' | 'aurora'

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  speaking: string
  listening: string
  idle: string
  glow: string
  name: string
  description: string
}

export const COLOR_THEMES: Record<ColorTheme, ThemeColors> = {
  purple: {
    primary: '#a78bfa',
    secondary: '#c4b5fd', 
    accent: '#ddd6fe',
    speaking: '#a78bfa',
    listening: '#c4b5fd',
    idle: '#ddd6fe',
    glow: 'rgba(167, 139, 250, 0.4)',
    name: 'Purple',
    description: 'Classic muted purple gradient'
  },
  cyberpunk: {
    primary: '#ff0080',
    secondary: '#00ffff',
    accent: '#ffff00',
    speaking: '#ff0080',
    listening: '#00ffff', 
    idle: '#8000ff',
    glow: 'rgba(255, 0, 128, 0.5)',
    name: 'Cyberpunk',
    description: 'Neon pink and cyan vibes'
  },
  ocean: {
    primary: '#0ea5e9',
    secondary: '#06b6d4',
    accent: '#67e8f9',
    speaking: '#0ea5e9',
    listening: '#06b6d4',
    idle: '#67e8f9',
    glow: 'rgba(14, 165, 233, 0.4)',
    name: 'Ocean',
    description: 'Deep blue and teal tones'
  },
  sunset: {
    primary: '#f97316',
    secondary: '#fbbf24',
    accent: '#fb7185',
    speaking: '#f97316',
    listening: '#fbbf24',
    idle: '#fb7185',
    glow: 'rgba(249, 115, 22, 0.4)',
    name: 'Sunset',
    description: 'Warm orange and pink hues'
  },
  monochrome: {
    primary: '#ffffff',
    secondary: '#d1d5db',
    accent: '#9ca3af',
    speaking: '#ffffff',
    listening: '#d1d5db',
    idle: '#9ca3af',
    glow: 'rgba(255, 255, 255, 0.3)',
    name: 'Monochrome',
    description: 'Clean white and gray scale'
  },
  neon: {
    primary: '#39ff14',
    secondary: '#ff073a',
    accent: '#ffff00',
    speaking: '#39ff14',
    listening: '#ff073a',
    idle: '#ffff00',
    glow: 'rgba(57, 255, 20, 0.5)',
    name: 'Neon',
    description: 'Electric green and red glow'
  },
  aurora: {
    primary: '#a855f7',
    secondary: '#06d6a0',
    accent: '#ffd60a',
    speaking: '#a855f7',
    listening: '#06d6a0',
    idle: '#ffd60a',
    glow: 'rgba(168, 85, 247, 0.4)',
    name: 'Aurora',
    description: 'Northern lights inspired'
  },
  forest: {
    primary: '#22c55e',
    secondary: '#84cc16',
    accent: '#eab308',
    speaking: '#22c55e',
    listening: '#84cc16',
    idle: '#eab308',
    glow: 'rgba(34, 197, 94, 0.4)',
    name: 'Forest',
    description: 'Natural green and yellow'
  }
}

export function getThemeColor(theme: ColorTheme, speaking: boolean, listening: boolean): string {
  const colors = COLOR_THEMES[theme]
  if (speaking) return colors.speaking
  if (listening) return colors.listening
  return colors.idle
}

export function getThemeGlow(theme: ColorTheme, intensity: number = 1): string {
  const colors = COLOR_THEMES[theme]
  const baseGlow = colors.glow
  // Adjust opacity based on intensity
  return baseGlow.replace(/[\d.]+\)$/, `${0.2 + intensity * 0.3})`)
}
