import type { IpcMain } from 'electron'
import { eventBus } from './event_bus'

export function wireEventsToRenderer(_ipcMain: IpcMain) {
  // No-op: events are emitted via db.addRunEvent which uses eventBus.
}

export function setupEventForwarding(win: Electron.BrowserWindow) {
  const handler = (payload: any) => {
    win.webContents.send('agent/event', payload)
  }
  eventBus.on('event', handler)
  return () => eventBus.off('event', handler)
}


