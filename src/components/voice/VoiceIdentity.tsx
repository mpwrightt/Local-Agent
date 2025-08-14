import { useEffect, useMemo } from 'react'
import { VisualizerSwitcher } from './VisualizerSwitcher'

type Props = { speaking: boolean; micStream?: MediaStream | null; audioEl?: HTMLAudioElement | null }

export function VoiceIdentity({ speaking }: Props) {
  useEffect(() => {
    console.log('VoiceIdentity mounted, speaking:', speaking)
  }, [])
  
  useEffect(() => {
    console.log('VoiceIdentity speaking changed:', speaking)
  }, [speaking])

  const speakingMemo = useMemo(() => speaking, [speaking])
  
  return (
    <div style={{ width: 260, height: 260 }} className="rounded-full flex items-center justify-center relative">
      <VisualizerSwitcher 
        listening={false} 
        speaking={speakingMemo} 
        showControls={true}
        className="w-full h-full"
      />
    </div>
  )
}