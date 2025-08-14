import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mimeToExtension(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('m4a') || m.includes('aac')) return 'm4a'
  if (m.includes('ogg')) return 'ogg'
  return 'webm'
}

export function pickSupportedAudioMimeType(checker?: (mime: string) => boolean): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mpeg',
  ]
  const isSupported = checker
    || (typeof (globalThis as any).MediaRecorder !== 'undefined' && typeof (globalThis as any).MediaRecorder.isTypeSupported === 'function'
      ? (mime: string) => (globalThis as any).MediaRecorder.isTypeSupported(mime)
      : undefined)
  if (!isSupported) return 'audio/webm'
  for (const c of candidates) {
    try { if (isSupported(c)) return c } catch {}
  }
  return 'audio/webm'
}
