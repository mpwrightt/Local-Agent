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
      await Promise.all(wave.map(t => executeTask(t, input, controller.signal)))
      for (const t of wave) done.add(t.id)
    }
    db.completeRun(input.runId)
  } finally {
    activeRuns.delete(input.runId)
  }
}

async function executeTask(task: PlannedTask, ctx: OrchestratorInput, signal: AbortSignal) {
  const { runId, sessionId } = ctx
  db.updateTaskStatus(runId, task.id, 'running', { title: task.title, role: task.role })
  // Emit an explicit task_start event for UI state machines
  db.addRunEvent(runId, { type: 'task_start', taskId: task.id, title: task.title, role: task.role })
  try {
    let result: any
    switch (task.role) {
      case 'research':
        // Use the root prompt; enable deep mode flag to widen sources
        result = await spawnResearchAgent({ runId, sessionId, task, query: ctx.prompt, deep: ctx.deep, signal })
        break
      case 'fileops':
        result = await spawnFileOpsAgent({ runId, sessionId, task, automation: ctx.automation, signal })
        break
      case 'shell':
        result = await spawnShellAgent({ runId, sessionId, task, automation: ctx.automation })
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


