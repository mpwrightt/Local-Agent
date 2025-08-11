import { spawn } from 'node:child_process'
import os from 'node:os'
import { db } from '../../db'
import { requestConfirmation } from '../confirm'

interface Ctx {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  automation?: boolean
}

function parseCommandFromDescription(desc: string): string | null {
  try {
    const j = JSON.parse(desc)
    if (j && typeof j.cmd === 'string') return j.cmd
  } catch {}
  const m = desc.match(/^(?:shell:|run:|execute:)\s*(.+)$/i)
  if (m && m[1]) return m[1].trim()
  return null
}

function isWhitelisted(cmd: string): boolean {
  const first = cmd.trim().split(/\s+/)[0]
  const whitelist = new Set(['git', 'ls', 'cat', 'echo', 'pwd'])
  return whitelist.has(first)
}

export async function spawnShellAgent(ctx: Ctx) {
  const cmd = parseCommandFromDescription(ctx.task.description)
  if (!cmd) {
    throw new Error('No shell command provided')
  }
  const whitelisted = isWhitelisted(cmd)
  if (!whitelisted && !ctx.automation) {
    // Ask user for confirmation before running non-whitelisted commands
    db.addRunEvent(ctx.runId, { type: 'confirm_dangerous', runId: ctx.runId, taskId: ctx.task.id, op: 'shell', path: cmd })
    const ok = await requestConfirmation(ctx.runId, ctx.task.id)
    if (!ok) throw new Error('User denied shell command')
  }

  db.addRunEvent(ctx.runId, { type: 'shell_start', taskId: ctx.task.id, cmd })
  const shellBin = process.env.SHELL || '/bin/zsh'
  const home = os.homedir()

  return await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(shellBin, ['-lc', cmd], { cwd: home, env: process.env })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      out += chunk
      db.addRunEvent(ctx.runId, { type: 'shell_output', taskId: ctx.task.id, stream: 'stdout', chunk: chunk.slice(0, 4000) })
    })
    child.stderr.on('data', (chunk: string) => {
      err += chunk
      db.addRunEvent(ctx.runId, { type: 'shell_output', taskId: ctx.task.id, stream: 'stderr', chunk: chunk.slice(0, 4000) })
    })
    child.on('error', (e) => {
      db.addRunEvent(ctx.runId, { type: 'error', taskId: ctx.task.id, message: String((e as any)?.message ?? e) })
      reject(e)
    })
    child.on('close', (code) => {
      const exitCode = typeof code === 'number' ? code : -1
      db.addRunEvent(ctx.runId, { type: 'shell_end', taskId: ctx.task.id, exitCode })
      resolve({ exitCode, stdout: out, stderr: err })
    })
  })
}


