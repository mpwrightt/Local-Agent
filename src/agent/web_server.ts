import http from 'node:http'
import crypto from 'node:crypto'
import url from 'node:url'
import { db } from '../db'
import { eventBus } from './event_bus'
import { startOrchestrator } from './scheduler'

export type ServerOptions = {
  port?: number
  host?: string
  token?: string
}

export function startAgentServer(opts: ServerOptions = {}) {
  const port = opts.port ?? Number(process.env.AGENT_PORT || 8787)
  const host = opts.host ?? '0.0.0.0'
  const token = opts.token ?? process.env.AGENT_TOKEN ?? crypto.randomBytes(16).toString('hex')

  const clients = new Set<http.ServerResponse>()

  function isAuthed(req: http.IncomingMessage): boolean {
    const h = String(req.headers['authorization'] || '')
    if (!h) return false
    const m = h.match(/^Bearer\s+(.+)$/i)
    return !!(m && m[1] === token)
  }

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url || '', true)
    const method = req.method || 'GET'
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (method === 'OPTIONS') { res.statusCode = 200; res.end(); return }

    if (parsed.pathname === '/api/events' && method === 'GET') {
      if (!isAuthed(req)) { res.statusCode = 401; res.end('unauthorized'); return }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      clients.add(res)
      const handler = (payload: any) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }
      eventBus.on('event', handler)
      req.on('close', () => {
        clients.delete(res)
        eventBus.off('event', handler)
      })
      return
    }

    if (parsed.pathname === '/api/startTask' && method === 'POST') {
      if (!isAuthed(req)) { res.statusCode = 401; res.end('unauthorized'); return }
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const input = JSON.parse(body || '{}') as { prompt: string; model?: string; deep?: boolean; automation?: boolean }
          const sessionId = db.createSession(input.prompt)
          const runId = db.createRun(sessionId)
          db.addRunEvent(runId, { type: 'run_started', prompt: input.prompt, model: input.model, deep: Boolean(input.deep), automation: Boolean(input.automation) })
          startOrchestrator({ runId, sessionId, prompt: input.prompt, model: input.model ?? 'local-model', deep: Boolean(input.deep), automation: Boolean(input.automation) })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ runId, token }))
        } catch (e: any) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: String(e?.message || e) }))
        }
      })
      return
    }

    if (parsed.pathname === '/api/cancel' && method === 'POST') {
      if (!isAuthed(req)) { res.statusCode = 401; res.end('unauthorized'); return }
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const input = JSON.parse(body || '{}') as { runId: string }
          // Soft-cancel via db event; scheduler listens to abort signals; this endpoint is placeholder
          db.addRunEvent(input.runId, { type: 'run_cancel_requested' })
          res.statusCode = 200
          res.end('ok')
        } catch (e: any) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: String(e?.message || e) }))
        }
      })
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[agent] listening on http://${host}:${port}`)
    console.log(`[agent] token: ${token}`)
  })

  return { server, token }
}

// Allow running file directly: `node src/agent/web_server.ts` with ts-node loader
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  startAgentServer()
}
 

