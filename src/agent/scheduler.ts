import { spawnResearchAgent } from './workers/research'
import { spawnFileOpsAgent } from './workers/fileops'
import { spawnShellAgent } from './workers/shell'
// OCR functionality is integrated into fileops worker
import { db } from '../db'
import { planTasks, type PlannedTask } from './task_planner'
import { buildResearchGraph, ResearchState } from './graph'
// import { logger } from '../shared/logger'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const activeRuns = new Map<string, AbortController>()

function envRoleConcurrency(role: string): number | undefined {
  const key = `AGENT_ROLE_CONCURRENCY_${role.toUpperCase()}`
  const raw = process.env[key]
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

function defaultRoleConcurrency(role: string): number | undefined {
  const env = envRoleConcurrency(role)
  if (env != null) return env
  const map: Record<string, number> = {
    research: 2,
    fileops: 3,
    shell: 1,
    reviewer: 1,
  }
  return map[role]
}

function createLimiter(max: number | undefined) {
  if (max == null || max <= 0 || !Number.isFinite(max)) {
    return async function <T>(fn: () => Promise<T>): Promise<T> { return fn() }
  }
  let active = 0
  const queue: Array<() => void> = []
  const runNext = () => {
    if (active >= (max as number)) return
    const next = queue.shift()
    if (!next) return
    active++
    next()
  }
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        fn().then((v) => { active--; runNext(); resolve(v) }, (e) => { active--; runNext(); reject(e) })
      }
      if (active < (max as number)) {
        active++
        task()
      } else {
        queue.push(task)
      }
    })
  }
}

function tasksToMermaid(tasks: PlannedTask[]): string {
  const lines: string[] = ['graph TD']
  for (const t of tasks) {
    const label = `${t.title.replace(/"/g, '\\"')} (${t.role})`
    lines.push(`${t.id}["${label}"]`)
  }
  for (const t of tasks) {
    for (const d of t.deps) {
      lines.push(`${d} --> ${t.id}`)
    }
  }
  return lines.join('\n')
}

export interface OrchestratorInput {
  sessionId: string
  runId: string
  prompt: string
  model?: string
  deep?: boolean
  dryRun?: boolean
  automation?: boolean
}

export async function startOrchestrator(input: OrchestratorInput) {
  const controller = new AbortController()
  activeRuns.set(input.runId, controller)
  try {
    const tasks = await planTasks(input.prompt, input.model, input.deep, input.automation)
    db.addRunEvent(input.runId, { type: 'plan', tasks })
    try {
      const mermaid = tasksToMermaid(tasks)
      db.addRunEvent(input.runId, { type: 'plan_mermaid', mermaid })
    } catch {}

    if (input.dryRun) {
      db.addRunEvent(input.runId, { type: 'dry_run' })
      db.completeRun(input.runId)
      return
    }

    // const idToTask = new Map(tasks.map(t => [t.id, t]))
    const done = new Set<string>()
    const started = new Set<string>()

    while (done.size < tasks.length) {
      if (controller.signal.aborted) {
        db.addRunEvent(input.runId, { type: 'run_cancelled' })
        break
      }
      const wave = tasks.filter(t => !started.has(t.id) && t.deps.every(d => done.has(d)))
      if (wave.length === 0) {
        // Deadlock or missing deps; mark remaining as failed
        const remaining = tasks.filter(t => !done.has(t.id))
        for (const t of remaining) {
          db.updateTaskStatus(input.runId, t.id, 'failed', { title: t.title, role: t.role })
          db.addRunEvent(input.runId, { type: 'error', taskId: t.id, message: 'Unresolvable dependencies', deps: t.deps })
          done.add(t.id)
        }
        break
      }
      for (const t of wave) started.add(t.id)
      // Concurrency per role
      const limiters = new Map<string, ReturnType<typeof createLimiter>>()
      const getLimiter = (role: string) => {
        const ex = limiters.get(role)
        if (ex) return ex
        const lim = createLimiter(defaultRoleConcurrency(role))
        limiters.set(role, lim)
        return lim
      }
      await Promise.all(wave.map(t => {
        const limiter = getLimiter((t as any).role)
        return limiter(() => executeTask(t, input, controller.signal))
      }))
      for (const t of wave) done.add(t.id)
    }
    db.completeRun(input.runId)
  } finally {
    activeRuns.delete(input.runId)
  }
}

function envDefaultSecondsForRole(role: string): number | undefined {
  const key = `AGENT_DEFAULT_BUDGET_SECONDS_${role.toUpperCase()}`
  const raw = process.env[key]
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function defaultSecondsForRole(role: string): number | undefined {
  const envVal = envDefaultSecondsForRole(role)
  if (envVal != null) return envVal
  const map: Record<string, number> = {
    research: 90,
    fileops: 15,
    shell: 30,
    reviewer: 25,
    summarizer: 15,
  }
  return map[role]
}

export function createBudgetAbortController(task: PlannedTask, runId: string, parentSignal: AbortSignal) {
  const controller = new AbortController()
  const onParentAbort = () => controller.abort()
  parentSignal.addEventListener('abort', onParentAbort)
  let timer: NodeJS.Timeout | null = null
  const explicit = (task as any)?.budgets?.seconds
  const seconds = Number(explicit ?? defaultSecondsForRole((task as any)?.role) ?? 0)
  if (seconds > 0 && Number.isFinite(seconds) && seconds > 0) {
    const ms = Math.max(1, Math.floor(seconds * 1000))
    timer = setTimeout(() => {
      try { db.addRunEvent(runId, { type: 'task_timeout', taskId: task.id, seconds }) } catch {}
      controller.abort()
    }, ms)
  }
  const dispose = () => {
    parentSignal.removeEventListener('abort', onParentAbort)
    if (timer) { clearTimeout(timer) }
  }
  return { signal: controller.signal, dispose }
}

async function executeTask(task: PlannedTask, ctx: OrchestratorInput, signal: AbortSignal) {
  const { runId, sessionId } = ctx
  db.updateTaskStatus(runId, task.id, 'running', { title: task.title, role: task.role })
  // Emit an explicit task_start event for UI state machines
  db.addRunEvent(runId, { type: 'task_start', taskId: task.id, title: task.title, role: task.role })
  try {
    const { signal: taskSignal, dispose } = createBudgetAbortController(task, runId, signal)
    try {
    let result: any
    switch (task.role) {
      case 'research':
        // Use the root prompt; enable deep mode flag to widen sources
          result = await spawnResearchAgent({ runId, sessionId, task, query: ctx.prompt, deep: ctx.deep, signal: taskSignal })
        break
      case 'fileops':
          result = await spawnFileOpsAgent({ runId, sessionId, task, automation: ctx.automation, signal: taskSignal })
        break
      case 'shell':
          result = await spawnShellAgent({ runId, sessionId, task, automation: ctx.automation, signal: taskSignal })
        break
      case 'reviewer':
        // LLM synthesis via LangGraph
        try {
          const researchResults = db.getTaskResultsByRole(runId, 'research') as any[]
          // Union all targets from all research tasks, de-duplicated by URL
          const urlSeen = new Set<string>()
          const targets: Array<{ title: string; url: string }> = []
          for (const r of researchResults) {
            for (const t of (r?.targets ?? [])) {
              if (t?.url && !urlSeen.has(t.url)) {
                urlSeen.add(t.url)
                targets.push({ title: t.title, url: t.url })
              }
            }
          }
          const limitedTargets = targets.slice(0, 12)
          // Merge aggregate corpora from all research tasks into a single file
          const corpusParts: string[] = []
          for (const r of researchResults) {
            const pth = r?.aggregatePath
            try {
              if (pth && fs.existsSync(pth)) {
                corpusParts.push(fs.readFileSync(pth, 'utf8'))
              }
            } catch {}
          }
          let aggregatePath: string | undefined = undefined
          if (corpusParts.length > 0) {
            const baseDir = path.join(os.homedir(), '.local-agent')
            if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
            aggregatePath = path.join(baseDir, `research-aggregate-merged-${Date.now()}.txt`)
            try { fs.writeFileSync(aggregatePath, corpusParts.join('\n\n---\n\n'), 'utf8') } catch {}
          }
          const graph = buildResearchGraph()
          const stateIn: typeof ResearchState.State = {
            prompt: ctx.prompt,
            deep: Boolean((ctx as any).deep),
            targets: limitedTargets,
            aggregatePath,
            synthesis: undefined,
            snippets: [],
            selected: [],
          }
          const out = await graph.invoke(stateIn)
          const summary = out.synthesis ?? 'No synthesis produced.'
          db.addRunEvent(runId, { type: 'review_note', taskId: task.id, summary })
          result = { summary }
        } catch (err) {
          result = { summary: 'Synthesis failed.' }
        }
        break
      default:
        result = { skipped: true }
    }
    db.updateTaskStatus(runId, task.id, 'done', { title: task.title, role: task.role })
    db.addRunEvent(runId, { type: 'task_result', taskId: task.id, taskRole: task.role, result })
    } finally {
      try { dispose() } catch {}
    }
  } catch (err: any) {
    db.updateTaskStatus(runId, task.id, 'failed', { title: task.title, role: task.role })
    db.addRunEvent(runId, { type: 'error', taskId: task.id, message: String(err?.message ?? err) })
  }
}

export function cancelRun(runId: string) {
  const controller = activeRuns.get(runId)
  if (controller) {
    controller.abort()
    activeRuns.delete(runId)
    // Emit cancellation immediately so UI updates even if a worker is mid-execution
    try { db.addRunEvent(runId, { type: 'run_cancelled' }) } catch {}
  }
}


