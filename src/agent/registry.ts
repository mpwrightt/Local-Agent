import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import { db } from '../db'

export type WorkerContext = {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  signal?: AbortSignal
}

export type WorkerRunner = (ctx: WorkerContext) => Promise<any>

type Registered = {
  id: string
  role: string
  runner: WorkerRunner
  source: 'builtin' | 'plugin'
}

const registry = new Map<string, Registered>()
const pluginIds = new Set<string>()

export function registerWorker(role: string, id: string, runner: WorkerRunner, source: 'builtin' | 'plugin' = 'builtin') {
  registry.set(role, { id, role, runner, source })
}

export function getWorker(role: string): Registered | undefined {
  return registry.get(role)
}

// Manifest schema for plugins
const Capability = z.object({ role: z.string() })
export const ManifestSchema = z.object({
  id: z.string(),
  version: z.string(),
  entrypoint: z.string(), // module that default-exports a runner(ctx)
  capabilities: z.array(Capability).default([]),
  permissions: z.array(z.string()).default([]),
})
export type PluginManifest = z.infer<typeof ManifestSchema>

export async function loadPlugins(pluginsDir?: string) {
  const root = pluginsDir ?? path.join(process.cwd(), 'src', 'plugins')
  if (!fs.existsSync(root)) return { loaded: 0 }
  const files = fs.readdirSync(root)
  let loaded = 0
  // Clear previous plugin-sourced registrations
  for (const [role, reg] of Array.from(registry.entries())) {
    if (reg.source === 'plugin') registry.delete(role)
  }
  pluginIds.clear()
  for (const name of files) {
    try {
      const dir = path.join(root, name)
      const manifestPath = path.join(dir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) continue
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      const manifest = ManifestSchema.parse(raw)
      const modPath = path.isAbsolute(manifest.entrypoint)
        ? manifest.entrypoint
        : path.join(dir, manifest.entrypoint)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = await import(pathToFileUrlSafe(modPath))
      const runner: WorkerRunner = typeof mod.default === 'function' ? mod.default : mod.runner
      if (typeof runner !== 'function') throw new Error(`Invalid plugin runner in ${manifest.id}`)
      for (const cap of manifest.capabilities) {
        registerWorker(cap.role, manifest.id, runner, 'plugin')
      }
      pluginIds.add(manifest.id)
      loaded++
      db.addRunEvent('system', { type: 'plugin_loaded', id: manifest.id, version: manifest.version, roles: manifest.capabilities.map(c => c.role) })
    } catch (e: any) {
      db.addRunEvent('system', { type: 'plugin_error', message: String(e?.message ?? e) })
    }
  }
  return { loaded }
}

function pathToFileUrlSafe(p: string) {
  // On ESM import, Windows paths need file URL; Node also accepts absolute path in current env.
  // Keep simple: convert to file URL only if it looks like a path outside TS transpilation.
  if (p.startsWith('file://')) return p
  return pathToFileUrl(p)
}

// Local helper (no direct import to avoid Node typings issues)
function pathToFileUrl(p: string) {
  const { pathToFileURL } = require('node:url') as typeof import('node:url')
  return pathToFileURL(p).href
}

// Built-in registration convenience to wrap existing workers
export function registerBuiltInWorkers() {
  try {
    const { spawnFileOpsAgent } = require('./workers/fileops') as typeof import('./workers/fileops')
    registerWorker('fileops', 'builtin-fileops', (ctx) => spawnFileOpsAgent(ctx))
  } catch {}
  try {
    const { spawnResearchAgent } = require('./workers/research') as typeof import('./workers/research')
    registerWorker('research', 'builtin-research', (ctx) => spawnResearchAgent({ ...ctx, query: ctx.task.description, deep: false } as any))
  } catch {}
  try {
    const { spawnShellAgent } = require('./workers/shell') as typeof import('./workers/shell')
    registerWorker('shell', 'builtin-shell', (ctx) => spawnShellAgent({ ...ctx, automation: true }))
  } catch {}
}

export function watchPlugins(pluginsDir?: string) {
  const root = pluginsDir ?? path.join(process.cwd(), 'src', 'plugins')
  if (!fs.existsSync(root)) return
  let timer: NodeJS.Timeout | null = null
  const trigger = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void loadPlugins(root) }, 250)
  }
  try {
    fs.watch(root, { recursive: true }, trigger)
    db.addRunEvent('system', { type: 'plugin_watch', message: `Watching ${root}` })
  } catch (e: any) {
    db.addRunEvent('system', { type: 'plugin_watch_error', message: String(e?.message ?? e) })
  }
}


