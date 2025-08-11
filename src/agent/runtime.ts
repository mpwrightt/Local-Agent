import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { startOrchestrator, cancelRun as cancelRunById } from './scheduler'
import { registerBuiltInWorkers, loadPlugins, watchPlugins } from './registry'
import { db } from '../db'
// import { logger } from '../shared/logger'
// import { eventBus } from './event_bus'
import { resolveConfirmation } from './confirm'
import OpenAI from 'openai'
import { getDefaultModel, setDefaultModel } from './config'

export function createAgentRuntime(ipcMain: IpcMain) {
  // Register built-ins and try loading plugins once at startup
  try { registerBuiltInWorkers() } catch {}
  try { void loadPlugins() } catch {}
  try { watchPlugins() } catch {}
  ipcMain.handle('agent/startTask', async (_event, input: { prompt: string; model?: string; deep?: boolean; dryRun?: boolean; automation?: boolean }) => {
    const sessionId = db.createSession(input.prompt)
    const runId = db.createRun(sessionId)
    const chosenModel = input.model ?? getDefaultModel() ?? process.env.LMSTUDIO_MODEL ?? 'local-model'
    db.addRunEvent(runId, { type: 'run_started', prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) })
    startOrchestrator({ sessionId, runId, prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) })
    return { runId }
  })

  ipcMain.handle('agent/getHistory', async (_event, input: { sessionId?: string }) => {
    return db.getHistory(input.sessionId)
  })

  ipcMain.handle('agent/confirmDangerous', async (_event, input: { runId: string; taskId: string; confirm: boolean }) => {
    resolveConfirmation(input.runId, input.taskId, input.confirm)
  })

  ipcMain.handle('agent/setDefaultModel', async (_event, input: { model: string }) => {
    setDefaultModel(input.model)
  })

  ipcMain.handle('agent/cancelRun', async (_event, input: { runId: string }) => {
    try {
      cancelRunById(input.runId)
      db.addRunEvent(input.runId, { type: 'run_cancelled' })
    } catch {}
  })

  ipcMain.handle('agent/openPath', async (_event, input: { path: string }) => {
    try { await shell.openPath(input.path) } catch {}
  })

  ipcMain.handle('agent/revealInFolder', async (_event, input: { path: string }) => {
    try { shell.showItemInFolder(input.path) } catch {}
  })

  // Save uploaded image to temp file
  ipcMain.handle('agent/saveUploadedImage', async (_event, input: { dataUrl: string; fileName: string }) => {
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { writeFile } = await import('fs/promises')
    
    try {
      // Extract base64 data from data URL
      const matches = input.dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
      if (!matches) {
        throw new Error('Invalid data URL format')
      }
      
      const extension = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')
      
      // Create unique filename
      const timestamp = Date.now()
      const tempFilePath = join(tmpdir(), `uploaded-image-${timestamp}.${extension}`)
      
      // Write file
      await writeFile(tempFilePath, buffer)
      
      return { success: true, filePath: tempFilePath }
    } catch (error) {
      console.error('Failed to save uploaded image:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Simple chat mode - direct LM Studio interaction without task orchestration
  ipcMain.handle('agent/simpleChat', async (_event, input: { 
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    model?: string;
    temperature?: number;
  }) => {
    try {
      // LM Studio OpenAI-compatible API configuration
      const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
      const client = new OpenAI({
        baseURL,
        apiKey: 'not-needed' // LM Studio doesn't require API key
      })

      // Get available models from LM Studio
      let modelName = input.model ?? 'gpt-oss:20b'
      if (!input.model) {
        try {
          const models = await client.models.list()
          // Prefer gpt-oss models, then any available model
          modelName = models.data.find(m => m.id.includes('gpt-oss'))?.id 
                   ?? models.data.find(m => m.id.includes('custom-test'))?.id
                   ?? models.data[0]?.id 
                   ?? 'gpt-oss:20b'
        } catch {
          modelName = 'gpt-oss:20b' // fallback to known working model
        }
      }
      
      const response = await client.chat.completions.create({
        model: modelName,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: 2000, // Allow longer responses for chat
        stream: false
      })

      const content = response.choices[0]?.message?.content ?? 'No response generated'

      return { 
        success: true, 
        content,
        model: modelName
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        content: `Sorry, I encountered an error connecting to LM Studio. Please make sure LM Studio is running and the local server is started on ${process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234'}`
      }
    }
  })
}


