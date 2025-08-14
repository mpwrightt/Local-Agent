/// <reference types="vite/client" />

interface AgentAPI {
  startTask(input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }): Promise<{ runId: string }>
  getHistory(input: { sessionId?: string }): Promise<any>
  confirmDangerous(input: { runId: string; taskId: string; confirm: boolean }): Promise<void>
  cancelRun(input: { runId: string }): Promise<void>
  openPath(input: { path: string }): Promise<void>
  revealInFolder(input: { path: string }): Promise<void>
  onEvent(handler: (event: any) => void): () => void
}

interface ElectronAPI {
  getVisualizerVariant(): Promise<{ variant: string }>
  setVisualizerVariant(input: { variant: string }): Promise<void>
}

interface Window {
  agent: AgentAPI
  electronAPI?: ElectronAPI
}
