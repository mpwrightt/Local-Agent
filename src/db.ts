// better-sqlite3 lacks bundled types; import as any to satisfy TS strict settings
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { eventBus } from './agent/event_bus'

const dataDir = path.join(os.homedir(), '.local-agent')
const overridePath = process.env.LOCAL_AGENT_DB_PATH
const dbPath = overridePath ? path.resolve(overridePath) : path.join(dataDir, 'agent.db')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const sqliteDb = new Database(dbPath)
sqliteDb.pragma('journal_mode = WAL')

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    status TEXT,
    created_at TEXT,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS run_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    created_at TEXT,
    payload TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT,
    run_id TEXT,
    title TEXT,
    role TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT,
    PRIMARY KEY (id, run_id)
  );
  CREATE INDEX IF NOT EXISTS idx_run_events_run_id_id ON run_events(run_id, id);
  CREATE INDEX IF NOT EXISTS idx_tasks_run_id_id_status ON tasks(run_id, id, status);
`)

function newId(): string {
  return 'id-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export const dbApi = {
  createSession(title: string) {
    const id = newId()
    const created_at = new Date().toISOString()
    sqliteDb.prepare('INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)').run(id, title, created_at)
    return id
  },
  createRun(sessionId: string) {
    const id = newId()
    const created_at = new Date().toISOString()
    sqliteDb.prepare('INSERT INTO runs (id, session_id, status, created_at) VALUES (?, ?, ?, ?)')
      .run(id, sessionId, 'running', created_at)
    return id
  },
  completeRun(runId: string) {
    const finished_at = new Date().toISOString()
    sqliteDb.prepare('UPDATE runs SET status = ?, finished_at = ? WHERE id = ?').run('done', finished_at, runId)
    // Emit completion event for UI/notifications
    this.addRunEvent(runId, { type: 'run_complete' })
  },
  addRunEvent(runId: string, payload: any, createdAtOverride?: string) {
    const created_at = createdAtOverride ?? new Date().toISOString()
    sqliteDb.prepare('INSERT INTO run_events (run_id, created_at, payload) VALUES (?, ?, ?)')
      .run(runId, created_at, JSON.stringify(payload))
    eventBus.emit('event', { runId, created_at, payload })
  },
  updateTaskStatus(runId: string, taskId: string, status: string, meta?: { title?: string; role?: string }) {
    const now = new Date().toISOString()
    const exists = sqliteDb.prepare('SELECT 1 FROM tasks WHERE id = ? AND run_id = ?').get(taskId, runId)
    if (!exists) {
      sqliteDb.prepare('INSERT INTO tasks (id, run_id, title, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(taskId, runId, meta?.title ?? '', meta?.role ?? '', status, now, now)
    } else {
      sqliteDb.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND run_id = ?')
        .run(status, now, taskId, runId)
    }
    this.addRunEvent(runId, { type: 'task_status', taskId, status })
  },
  getHistory(sessionId?: string) {
    if (sessionId) {
      const runs = sqliteDb.prepare('SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC').all(sessionId)
      const events = sqliteDb.prepare('SELECT * FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE session_id = ?) ORDER BY id ASC').all(sessionId)
      return { runs, events }
    } else {
      const runs = sqliteDb.prepare('SELECT * FROM runs ORDER BY created_at DESC').all()
      const events = sqliteDb.prepare('SELECT * FROM run_events ORDER BY id ASC').all()
      return { runs, events }
    }
  },
  getTaskResultsByRole(runId: string, role: string) {
    const rows = sqliteDb.prepare('SELECT payload FROM run_events WHERE run_id = ? ORDER BY id ASC').all(runId)
    const results: any[] = []
    for (const r of rows) {
      try {
        const payload = JSON.parse(r.payload)
        if (payload?.type === 'task_result' && payload?.taskRole === role) {
          results.push(payload.result)
        }
      } catch {}
    }
    return results
  },
  pruneOldData(retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
    sqliteDb.prepare('DELETE FROM run_events WHERE created_at < ?').run(cutoff)
    sqliteDb.prepare('DELETE FROM runs WHERE finished_at IS NOT NULL AND finished_at < ?').run(cutoff)
    sqliteDb.prepare('DELETE FROM sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM runs)').run()
    try { sqliteDb.prepare('VACUUM').run() } catch {}
  }
}

export const db = dbApi


