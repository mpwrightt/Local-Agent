import { describe, it, expect } from 'vitest'
import { mimeToExtension, pickSupportedAudioMimeType } from './utils'

describe('audio utils', () => {
  it('mimeToExtension maps common types', () => {
    expect(mimeToExtension('audio/mpeg')).toBe('mp3')
    expect(mimeToExtension('audio/wav')).toBe('wav')
    expect(mimeToExtension('audio/x-m4a')).toBe('m4a')
    expect(mimeToExtension('audio/ogg;codecs=opus')).toBe('ogg')
    expect(mimeToExtension('audio/webm;codecs=opus')).toBe('webm')
  })

  it('pickSupportedAudioMimeType chooses first supported', () => {
    const supported = new Set(['audio/ogg;codecs=opus'])
    const mime = pickSupportedAudioMimeType((m) => supported.has(m))
    expect(mime).toBe('audio/ogg;codecs=opus')
  })
})


