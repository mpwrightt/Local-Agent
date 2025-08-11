import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAgentRuntime } from '../src/agent/runtime'
import { logger } from '../src/shared/logger'
import { setupEventForwarding } from '../src/agent/ipc_bridge'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Local Agent',
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    await mainWindow.loadURL(devUrl)
    // DevTools are disabled by default; press Cmd+Alt+I to open manually if needed.
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  const ok = globalShortcut.register('CommandOrControl+/', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
  if (!ok) {
    logger.warn('Failed to register global shortcut Cmd+/')
  }
}

app.whenReady().then(async () => {
  await createWindow()
  if (mainWindow) {
    setupEventForwarding(mainWindow)
  }
  createAgentRuntime(ipcMain)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})


