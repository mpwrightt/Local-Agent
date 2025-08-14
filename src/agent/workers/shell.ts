import { spawn } from 'node:child_process'
import os from 'node:os'
import { db } from '../../db'
import { requestConfirmation } from '../confirm'

interface Ctx {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  automation?: boolean
  signal?: AbortSignal
}

type ParsedShell = { cmd: string; meta?: any }

function parseCommandFromDescription(desc: string): ParsedShell | null {
  try {
    const j = JSON.parse(desc)
    if (j && typeof j.cmd === 'string') return { cmd: j.cmd, meta: (j as any).meta }
  } catch {}
  const m = desc.match(/^(?:shell:|run:|execute:)\s*(.+)$/i)
  if (m && m[1]) return { cmd: m[1].trim() }
  return null
}

function isWhitelisted(cmd: string): boolean {
  const first = cmd.trim().split(/\s+/)[0]
  const whitelist = new Set([
    // cross-platform basics
    'git', 'ls', 'cat', 'echo', 'pwd',
    // macOS helpers
    'open', 'osascript', 'killall',
    // Windows helpers (PowerShell and cmd)
    'Start-Process', 'Get-Process', 'Stop-Process', 'taskkill', 'cmd', 'powershell', 'Add-Type',
    // Windows PowerShell equivalents
    'Get-ChildItem', 'Get-Content', 'Set-Location', 'Get-Location', 'dir', 'type',
    // cmd.exe equivalents  
    'cd', 'md', 'rd', 'copy', 'move', 'del'
  ])
  return whitelist.has(first)
}

export async function spawnShellAgent(ctx: Ctx) {
  const parsed = parseCommandFromDescription(ctx.task.description)
  if (!parsed) {
    throw new Error('No shell command provided')
  }
  let cmd = parsed.cmd
  // Normalize commands for Windows PowerShell
  if (process.platform === 'win32') {
    // open -a "App" → Start-Process "App"
    const openMatch = cmd.match(/^open\s+-a\s+"([^"]+)"/i)
    if (openMatch) {
      const app = openMatch[1].replace('"', '""')
      cmd = `Start-Process -FilePath \"${app}\"`
    }
    // osascript quit → Stop-Process
    const osaQuit = cmd.match(/^osascript\b.+?tell application \"([^\"]+)\" to quit/i)
    if (osaQuit) {
      const app = osaQuit[1].replace('"', '""')
      cmd = `Get-Process -Name \"${app}\" -ErrorAction SilentlyContinue | Stop-Process -Force`
    }
    // ls → Get-ChildItem (PowerShell equivalent) or fallback to dir
    if (cmd.match(/^ls\b/)) {
      // Try PowerShell first, but provide a simpler fallback
      if (cmd.includes('Desktop') || cmd.includes('desktop')) {
        // For desktop listing, use a simple approach
        cmd = cmd.replace(/^ls\b.*/, 'Get-ChildItem "$env:USERPROFILE\\Desktop" | Select-Object Name, Mode, LastWriteTime, Length | Format-Table -AutoSize')
      } else {
        cmd = cmd.replace(/^ls\b/, 'Get-ChildItem')
        // Handle common ls options
        cmd = cmd.replace(/\s+-la?\b/, ' | Format-Table Name, Mode, LastWriteTime, Length -AutoSize')
        cmd = cmd.replace(/\s+-l\b/, ' | Format-Table Name, Mode, LastWriteTime, Length -AutoSize')
        cmd = cmd.replace(/\s+-a\b/, ' -Force')
      }
    }
    // pwd → Get-Location
    if (cmd.match(/^pwd\b/)) {
      cmd = cmd.replace(/^pwd\b/, 'Get-Location')
    }
    // cat → Get-Content
    if (cmd.match(/^cat\b/)) {
      cmd = cmd.replace(/^cat\b/, 'Get-Content')
    }
    // Handle desktop path specifically
    if (process.env.FORCE_CMD === '1') {
      // cmd.exe equivalents
      cmd = cmd.replace(/\$HOME\/Desktop/g, '%USERPROFILE%\\Desktop')
      cmd = cmd.replace(/~\/Desktop/g, '%USERPROFILE%\\Desktop')
      // Convert PowerShell commands to cmd equivalents
      cmd = cmd.replace(/^Get-ChildItem\b.*/, 'dir "%USERPROFILE%\\Desktop"')
      cmd = cmd.replace(/^Get-Location\b/, 'cd')
      cmd = cmd.replace(/^Get-Content\b/, 'type')
    } else {
      // PowerShell paths
      cmd = cmd.replace(/\$HOME\/Desktop/g, '$env:USERPROFILE\\Desktop')
      cmd = cmd.replace(/~\/Desktop/g, '$env:USERPROFILE\\Desktop')
    }
  }
  const meta = parsed.meta
  const whitelisted = isWhitelisted(cmd)
  if (!whitelisted && !ctx.automation) {
    // Ask user for confirmation before running non-whitelisted commands
    db.addRunEvent(ctx.runId, { type: 'confirm_dangerous', runId: ctx.runId, taskId: ctx.task.id, op: 'shell', path: cmd })
    const ok = await requestConfirmation(ctx.runId, ctx.task.id)
    if (!ok) throw new Error('User denied shell command')
  }

  db.addRunEvent(ctx.runId, { type: 'shell_start', taskId: ctx.task.id, cmd })
  // For DM flows, store a lightweight hint so UI can synthesize a card if worker confirmation is missed
  if (meta && meta.kind === 'slack_dm') {
    db.addRunEvent(ctx.runId, { type: 'dm_hint', taskId: ctx.task.id, to: meta.to, message: meta.message })
  }
  const shellBin = process.platform === 'win32'
    ? (process.env.FORCE_CMD === '1' ? 'cmd.exe' : 'powershell.exe')
    : (process.env.SHELL || '/bin/zsh')
  const home = os.homedir()
  
  // Add debug logging for Windows
  if (process.platform === 'win32') {
    console.log(`[Shell] Windows command: ${cmd}`)
    console.log(`[Shell] Shell binary: ${shellBin}`)
    console.log(`[Shell] Home directory: ${home}`)
  }

  return await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const args = process.platform === 'win32'
      ? (shellBin === 'cmd.exe' 
          ? ['/c', cmd] 
          : ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd])
      : ['-lc', cmd]
    const child = spawn(shellBin, args, { cwd: home, env: process.env })
    let out = ''
    let err = ''
    let aborted = false
    const onAbort = () => {
      if (aborted) return
      aborted = true
      try { db.addRunEvent(ctx.runId, { type: 'shell_cancelled', taskId: ctx.task.id, cmd }) } catch {}
      try { child.kill('SIGTERM') } catch {}
      // Fallback hard kill shortly after if still running
      setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 500)
    }
    if (ctx.signal?.aborted) onAbort()
    ctx.signal?.addEventListener('abort', onAbort)
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
      // Emit friendly domain events for known automations
      if (!aborted && exitCode === 0 && meta && meta.kind === 'slack_dm') {
        db.addRunEvent(ctx.runId, { type: 'dm_sent', taskId: ctx.task.id, to: meta.to, message: meta.message })
      }
      if (aborted) {
        reject(new Error('Cancelled'))
      } else {
        resolve({ exitCode, stdout: out, stderr: err })
      }
    })
    // Cleanup abort listener when done
    child.on('close', () => {
      try { ctx.signal?.removeEventListener('abort', onAbort) } catch {}
    })
  })
}


