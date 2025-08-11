import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('agent', {
  startTask: (input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }) => ipcRenderer.invoke('agent/startTask', input),
  simpleChat: (input: { messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; model?: string; temperature?: number; reasoningLevel?: 'low' | 'medium' | 'high'; searchEnabled?: boolean; showThinking?: boolean }) => ipcRenderer.invoke('agent/simpleChat', input),
  getHistory: (input: { sessionId?: string }) => ipcRenderer.invoke('agent/getHistory', input),
  confirmDangerous: (input: { runId: string; taskId: string; confirm: boolean }) => ipcRenderer.invoke('agent/confirmDangerous', input),
      cancelRun: (input: { runId: string }) => ipcRenderer.invoke('agent/cancelRun', input),
    setDefaultModel: (input: { model: string }) => ipcRenderer.invoke('agent/setDefaultModel', input),
    openPath: (input: { path: string }) => ipcRenderer.invoke('agent/openPath', input),
    revealInFolder: (input: { path: string }) => ipcRenderer.invoke('agent/revealInFolder', input),
    saveUploadedImage: (input: { dataUrl: string; fileName: string }) => ipcRenderer.invoke('agent/saveUploadedImage', input),
    readFileText: (input: { path: string }) => ipcRenderer.invoke('agent/readFileText', input),
  onEvent: (handler: (event: any) => void) => {
    const listener = (_: any, payload: any) => handler(payload)
    ipcRenderer.on('agent/event', listener)
    return () => ipcRenderer.removeListener('agent/event', listener)
  },
})

declare global {
  interface Window {
    agent: {
      startTask: (input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }) => Promise<{ runId: string }>
      simpleChat: (input: { messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; model?: string; temperature?: number; reasoningLevel?: 'low' | 'medium' | 'high'; searchEnabled?: boolean; showThinking?: boolean }) => Promise<{ success: boolean; content: string; error?: string; model?: string; links?: Array<{ title: string; url: string; snippet?: string }>; thinking?: string }>
      getHistory: (input: { sessionId?: string }) => Promise<any>
      confirmDangerous: (input: { runId: string; taskId: string; confirm: boolean }) => Promise<void>
      cancelRun: (input: { runId: string }) => Promise<void>
          setDefaultModel: (input: { model: string }) => Promise<void>
      openPath: (input: { path: string }) => Promise<void>
      revealInFolder: (input: { path: string }) => Promise<void>
      readFileText: (input: { path: string }) => Promise<{ success: boolean; content?: string; error?: string }>
      onEvent: (handler: (event: any) => void) => () => void
    }
  }
}


