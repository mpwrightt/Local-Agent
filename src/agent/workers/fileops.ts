import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { db } from '../../db'
import { spawnOCRAgent } from './ocr'
// import { requestConfirmation } from '../confirm'

interface Ctx {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  automation?: boolean
  signal?: AbortSignal
}

export async function spawnFileOpsAgent(ctx: Ctx) {
  // If description contains a rename op JSON, perform rename directly
  try {
    const parsed = JSON.parse(ctx.task.description)
    // Open/reveal operation by name within a scope
    if (parsed?.op === 'open' && typeof parsed.name === 'string') {
      const name = String(parsed.name).toLowerCase()
      const scope: string = (parsed.scope || 'any').toLowerCase()
      const action: 'open' | 'reveal' = parsed.action === 'reveal' ? 'reveal' : 'open'
      const home = os.homedir()
      const scopes: Record<string, string> = {
        desktop: path.join(home, process.platform === 'win32' ? 'Desktop' : 'Desktop'),
        documents: path.join(home, process.platform === 'win32' ? 'Documents' : 'Documents'),
        downloads: path.join(home, process.platform === 'win32' ? 'Downloads' : 'Downloads'),
        pictures: path.join(home, process.platform === 'win32' ? 'Pictures' : 'Pictures'),
      }
      const roots = scope === 'any' ? Object.values(scopes) : [scopes[scope]].filter(Boolean)
      for (const root of roots) {
        try {
          const entries = fs.readdirSync(root)
          // Prefer exact match, then case-insensitive, then contains
          let match = entries.find(e => e.toLowerCase() === name)
          if (!match) match = entries.find(e => e.toLowerCase() === `${name} images`)
          if (!match) match = entries.find(e => e.toLowerCase().includes(name))
          if (match) {
            const target = path.join(root, match)
            if (action === 'open') {
              const { shell } = await import('electron')
              await shell.openPath(target)
            } else {
              const { shell } = await import('electron')
              shell.showItemInFolder(target)
            }
            db.addRunEvent(ctx.runId, { type: 'file_open', taskId: ctx.task.id, path: target, action })
            return { path: target, action }
          }
        } catch {}
      }
      throw new Error(`Could not find ${parsed.name} in ${scope}`)
    }
    
    // Direct OCR search operation (for uploaded images)
    if (parsed?.op === 'ocr_search' && typeof parsed.text === 'string') {
      console.log('Direct OCR search operation detected:', parsed)
      return await spawnOCRAgent(ctx)
    }
    
    // Locate operation with enhanced content search
    if (parsed?.op === 'locate' && typeof parsed.name === 'string') {
      let name = String(parsed.name)
      // If the payload carries conversational filler like: a folder I think it was named something like "X"
      // prefer the quoted content inside it
      const q = name.match(/["']([^"']+)["']/)
      if (q && q[1]) name = q[1]
      const scope: string = (parsed.scope || 'any').toLowerCase()
      const contentSearch: boolean = parsed.contentSearch || false
      const originalPrompt: string = parsed.originalPrompt || name
      const listType: 'files' | 'folders' | undefined = parsed.listType
      const home = os.homedir()
      const candidates: string[] = []
      const scopes: Record<string, string> = {
        desktop: path.join(home, 'Desktop'),
        documents: path.join(home, 'Documents'),
        downloads: path.join(home, 'Downloads'),
        pictures: path.join(home, 'Pictures'),
      }

      // If content search is requested, try OCR search first
      if (contentSearch) {
        try {
          const ocrResult = await spawnOCRAgent({
            ...ctx,
            task: {
              ...ctx.task,
              description: JSON.stringify({
                op: 'ocr_search',
                text: name,
                paths: scope === 'any' ? Object.values(scopes) : [scopes[scope]].filter(Boolean),
                originalPrompt: originalPrompt // Pass original prompt for smart filtering
              })
            }
          })
          
          if (ocrResult && ocrResult.results && ocrResult.results.length > 0) {
            // OCR found results, return them
            const ocrPaths = ocrResult.results.map(r => r.path)
            db.addRunEvent(ctx.runId, { 
              type: 'file_located', 
              taskId: ctx.task.id, 
              query: name, 
              results: ocrPaths,
              searchType: 'content',
              ocrResults: ocrResult.results
            })
            return { query: name, results: ocrPaths, searchType: 'content' }
          }
        } catch (ocrError) {
          // OCR failed, fall back to filename search
          db.addRunEvent(ctx.runId, { 
            type: 'ocr_fallback', 
            taskId: ctx.task.id, 
            message: `OCR search failed, falling back to filename search: ${ocrError}` 
          })
        }
      }

      // Standard filename/folder listing/search
      // 1) System-wide search (macOS Spotlight or Windows indexing) with safe fallbacks
      try {
        const { execSync } = await import('node:child_process')
        let out = ''
        if (process.platform === 'darwin') {
          if (!listType) {
            const cmd = `mdfind -name ${JSON.stringify(name)}`
            console.log(`[FileOps] macOS search command: ${cmd}`)
            out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
          }
        } else if (process.platform === 'win32') {
          console.log(`[FileOps] Windows search - name: "${name}", listType: "${listType}", scope: "${scope}"`)
          // Handle folder listing specifically
          if (listType === 'folders' && name === '*') {
            // List folders in the specified scope
            const targetScope = scope === 'any' ? 'desktop' : scope
            const targetPath = scopes[targetScope] || scopes.desktop
            console.log(`[FileOps] Listing folders in: ${targetPath}`)
            const ps = `Get-ChildItem -LiteralPath \"${targetPath}\" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName`
            const fullCmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${ps}"`
            console.log(`[FileOps] Windows folder listing command: ${fullCmd}`)
            out = execSync(fullCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
          } else if (listType === 'files' && name === '*') {
            // List files in the specified scope  
            const targetScope = scope === 'any' ? 'desktop' : scope
            const targetPath = scopes[targetScope] || scopes.desktop
            console.log(`[FileOps] Listing files in: ${targetPath}`)
            const ps = `Get-ChildItem -LiteralPath \"${targetPath}\" -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName`
            const fullCmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${ps}"`
            console.log(`[FileOps] Windows file listing command: ${fullCmd}`)
            out = execSync(fullCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
          } else if (!listType) {
            // PowerShell: search common libraries recursively (limited depth for speed)
            const roots = [
              scopes.desktop, scopes.documents, scopes.downloads, scopes.pictures
            ].filter(Boolean).map(r => r.replace(/`/g, '``').replace(/"/g, '``"'))
            const ps = `Get-ChildItem -LiteralPath ${roots.map(r => `\"${r}\"`).join(',')} -Recurse -Depth 3 -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like \"*${name.replace(/"/g, '""')}*\" } | Select-Object -ExpandProperty FullName`
            const fullCmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${ps}"`
            console.log(`[FileOps] Windows PowerShell search command: ${fullCmd}`)
            out = execSync(fullCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
          }
        }
        if (out) {
          const lines = out.split('\n').map(s => s.trim()).filter(Boolean)
          for (const p of lines) {
            if (scope !== 'any') {
              const base = scopes[scope]
              if (base && !p.startsWith(base)) continue
            }
            candidates.push(p)
            if (candidates.length >= 50) break
          }
        }
      } catch (error) {
        console.log(`[FileOps] PowerShell execution failed:`, error)
        db.addRunEvent(ctx.runId, { type: 'error', taskId: ctx.task.id, message: `PowerShell search failed: ${error}` })
      }
      
      // 2) Scoped directory fallback scan (shallow)
      if (candidates.length === 0) {
        const dirs = scope === 'any' ? Object.values(scopes) : [scopes[scope]].filter(Boolean)
        for (const d of dirs) {
          try {
      if (ctx.signal?.aborted) throw new Error('Cancelled')
      const items = fs.readdirSync(d, { withFileTypes: true })
            for (const it of items) {
              const full = path.join(d, it.name)
              if (listType === 'folders') {
                if (it.isDirectory()) candidates.push(full)
              } else if (listType === 'files') {
                if (it.isFile()) candidates.push(full)
              } else if (it.name.toLowerCase().includes(name.toLowerCase())) {
                candidates.push(full)
              }
            }
          } catch {}
        }
      }
      
      // Emit event and return (structured list for UI action buttons)
      if (ctx.signal?.aborted) throw new Error('Cancelled')
      db.addRunEvent(ctx.runId, { 
        type: 'file_located', 
        taskId: ctx.task.id, 
        query: listType ? `${listType} on ${scope}` : name, 
        results: candidates,
        searchType: listType ? 'listing' : 'filename'
      })
      return { query: listType ? `${listType} on ${scope}` : name, results: candidates, searchType: listType ? 'listing' : 'filename' }
    }
    // Create directory
    if (parsed?.op === 'mkdir' && typeof parsed.name === 'string') {
      const home = os.homedir()
      const scopes: Record<string, string> = {
        desktop: path.join(home, 'Desktop'),
        documents: path.join(home, 'Documents'),
        downloads: path.join(home, 'Downloads'),
        pictures: path.join(home, 'Pictures'),
      }
      const scope: string = (parsed.scope || 'documents').toLowerCase()
      const base = scopes[scope] || path.join(home, 'Documents')
      const target = path.isAbsolute(parsed.name) ? parsed.name : path.join(base, parsed.name)
      try { fs.mkdirSync(target, { recursive: true }) } catch {}
      db.addRunEvent(ctx.runId, { type: 'file_created', taskId: ctx.task.id, path: target })
      return { path: target, created: true }
    }
    // Move file/folder
    if (parsed?.op === 'move' && typeof parsed.src === 'string' && typeof parsed.dest === 'string') {
      const expand = (p: string) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
      const src = expand(parsed.src)
      const destRaw = expand(parsed.dest)
      const dest = path.isAbsolute(destRaw) ? destRaw : path.join(path.dirname(src), destRaw)
      fs.renameSync(src, dest)
      db.addRunEvent(ctx.runId, { type: 'file_moved', taskId: ctx.task.id, src, dest })
      return { src, dest }
    }
    // Copy file/folder
    if (parsed?.op === 'copy' && typeof parsed.src === 'string' && typeof parsed.dest === 'string') {
      const expand = (p: string) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
      const src = expand(parsed.src)
      const destRaw = expand(parsed.dest)
      const dest = path.isAbsolute(destRaw) ? destRaw : path.join(path.dirname(src), destRaw)
      const stat = fs.statSync(src)
      if (stat.isDirectory()) {
        // Shallow copy directory
        fs.mkdirSync(dest, { recursive: true })
        const entries = fs.readdirSync(src, { withFileTypes: true })
        for (const it of entries) {
          if (it.isFile()) {
            fs.copyFileSync(path.join(src, it.name), path.join(dest, it.name))
          }
        }
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
      }
      db.addRunEvent(ctx.runId, { type: 'file_copied', taskId: ctx.task.id, src, dest })
      return { src, dest }
    }
    if (parsed?.op === 'rename' && typeof parsed.src === 'string' && typeof parsed.dest === 'string') {
      function expandHome(p: string) {
        return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
      }
      function resolveFromPhrase(phrase: string): string | null {
        const text = phrase.trim().toLowerCase()
        // Absolute or tilde path provided
        const maybe = expandHome(phrase)
        if (path.isAbsolute(maybe) && fs.existsSync(maybe)) return maybe
        // Desktop resolution
        const desktopDir = path.join(os.homedir(), 'Desktop')
        if (text.includes('desktop')) {
          // Extract name after 'named' or 'called'
          let name = phrase
          const m = phrase.match(/(?:named|called)\s+['\"]?(.+?)['\"]?(?=\s+(?:on|to|$)|$)/i)
          if (m?.[1]) name = m[1]
          name = name.replace(/on my desktop|on desktop/gi, '').trim()
          name = name.replace(/^['\"]|['\"]$/g, '') // strip surrounding quotes
          const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
          const targetNorm = normalize(name)
          const entries = fs.existsSync(desktopDir) ? fs.readdirSync(desktopDir) : []
          // Prefer exact normalized match
          let match = entries.find((e) => normalize(e) === targetNorm)
          if (match) return path.join(desktopDir, match)
          // fallback: startsWith/contains, avoid overly generic 'untitled'
          const soft = entries
            .filter((e) => !/^untitled$/i.test(normalize(e)))
            .find((e) => normalize(e).includes(targetNorm))
          if (soft) return path.join(desktopDir, soft)
        }
        return null
      }

      // Resolve source
      let srcPath = expandHome(parsed.src)
      if (!fs.existsSync(srcPath)) {
        const guess = resolveFromPhrase(parsed.src)
        if (guess) srcPath = guess
      }
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Source not found: ${parsed.src}`)
      }

      // Resolve destination
      let destPath = expandHome(parsed.dest)
      if (!path.isAbsolute(destPath)) {
        // Put into same directory as source
        destPath = path.join(path.dirname(srcPath), parsed.dest)
      }
      fs.renameSync(srcPath, destPath)
      db.addRunEvent(ctx.runId, { type: 'file_renamed', taskId: ctx.task.id, src: srcPath, dest: destPath })
      return { src: srcPath, dest: destPath }
    }
  } catch {}

  // Default behavior: write a summary file based on research
  const home = os.homedir()
  const outDir = path.join(home, 'Documents')
  const outPath = path.join(outDir, `agent-summary-${Date.now()}.md`)
  // Pull current run research artifacts instead of global last file
  const researchResults = db.getTaskResultsByRole(ctx.runId, 'research') as any[]
  const lastResearch = researchResults[researchResults.length - 1] || {}
  const articles: Array<{ path: string; title?: string; url?: string }> = lastResearch.articles ?? []
  let extracts = ''
  for (const a of articles.slice(0, 3)) {
    try {
      const t = fs.readFileSync(a.path, 'utf8')
      extracts += `## ${a.title ?? path.basename(a.path)}\n${a.url ? a.url + '\n' : ''}\n${t.slice(0, 1200)}\n\n---\n\n`
    } catch {}
  }
  const reviews = db.getTaskResultsByRole(ctx.runId, 'reviewer') as any[]
  const reviewNote = reviews[reviews.length - 1]?.summary ?? ''
  const content = `# Summary\n\nTask: ${ctx.task.description}\n\nKey Takeaways (draft):\n\n${reviewNote}\n\nExtracts (truncated):\n\n${extracts}\nGenerated at ${new Date().toISOString()}\n`
  fs.writeFileSync(outPath, content, 'utf8')
  db.addRunEvent(ctx.runId, { type: 'file_write', taskId: ctx.task.id, path: outPath })
  return { path: outPath }

  // Dangerous operations (example for delete) would look like:
  // const confirmed = await requestConfirmation(ctx.runId, ctx.task.id)
  // if (!confirmed) { throw new Error('User denied operation') }
}


