export type SlashResult = {
  ok: true
  output: string
  forceMode?: 'tasks' | 'chat' | 'research'
} | {
  ok: false
  hint?: string
}

export type SlashCommand = {
  id: string
  label: string // e.g., 'open'
  description?: string
  usage?: string
  examples?: string[]
  parse: (input: string) => SlashResult
}

import { COMMAND_HELP } from './commands_help'

// Helpers
function unquote(s: string): string {
  return s.replace(/^\s*["']|["']\s*$/g, '')
}

function extractAppName(raw: string): string {
  // Strip trailing instructions like "and ...", commas, etc.
  let s = raw.replace(/\s+and\s+.*$/i, '').trim()
  s = s.replace(/[,.;]+\s*$/, '').trim()
  return s
}

function makeSlackDMCommand(name?: string): string {
  if (!name || !name.trim()) {
    return 'open -a "Slack"'
  }
  const safe = name.replace(/"/g, '\\"')
  // AppleScript: activate Slack, open quick switcher (Cmd+K), type name, press Return
  return [
    'osascript',
    `-e 'tell application "Slack" to activate'`,
    `-e 'delay 0.2'`,
    `-e 'tell application "System Events" to keystroke "k" using {command down}'`,
    `-e 'delay 0.2'`,
    `-e 'tell application "System Events" to keystroke "${safe}"'`,
    `-e 'delay 0.4'`,
    `-e 'tell application "System Events" to key code 36'`
  ].join(' ')
}

function makeSlackDMSendCommand(name: string, message: string): string {
  const safeName = name.replace(/"/g, '\\"')
  const safeMsg = message.replace(/"/g, '\\"')
  return [
    'osascript',
    `-e 'set oldClip to the clipboard'`,
    `-e 'set the clipboard to "${safeMsg}"'`,
    `-e 'tell application "Slack" to activate'`,
    `-e 'delay 0.2'`,
    `-e 'tell application "System Events" to keystroke "k" using {command down}'`,
    `-e 'delay 0.2'`,
    `-e 'tell application "System Events" to keystroke "${safeName}"'`,
    `-e 'delay 0.4'`,
    `-e 'tell application "System Events" to key code 36'`,
    `-e 'delay 0.3'`,
    `-e 'tell application "System Events" to keystroke "v" using {command down}'`,
    `-e 'delay 0.1'`,
    `-e 'tell application "System Events" to key code 36'`,
    `-e 'delay 0.1'`,
    `-e 'set the clipboard to oldClip'`
  ].join(' ')
}

// Built-in commands
const builtin: SlashCommand[] = [
  {
    id: 'open-app',
    label: 'open',
    description: 'Open a macOS application',
    usage: '/open <app name>',
    examples: ['/open slack', '/open google chrome', '/open "Visual Studio Code"'],
    parse: (input) => {
      const m = input.match(/^\s*\/open\s+(.+)$/i)
      if (!m) return { ok: false }
      const app = extractAppName(unquote(m[1].trim()))
      if (!app) return { ok: false, hint: 'Provide an app name' }
      const json = { op: 'shell', cmd: `open -a "${app}"` }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'screenshot',
    label: 'screenshot',
    description: 'Take a screenshot to Desktop (full screen by default)',
    usage: '/screenshot [--window|--selection] [--out ~/Desktop/file.png]',
    examples: ['/screenshot', '/screenshot --window', '/screenshot --out ~/Desktop/shot.png'],
    parse: (input) => {
      const m = input.match(/^\s*\/screenshot(?:\s+(--window|--selection))?(?:\s+--out\s+(.+))?\s*$/i)
      if (!m) return { ok: false }
      const mode = (m[1] || '').toLowerCase()
      const out = m[2] ? unquote(m[2].trim()) : undefined
      const parts: string[] = ['screencapture']
      if (mode === '--window') parts.push('-w')
      if (mode === '--selection') parts.push('-i')
      const target = out ? out : `~/Desktop/screenshot-$(date +%s).png`
      const cmd = `${parts.join(' ')} ${JSON.stringify(target)}`
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'say',
    label: 'say',
    description: 'Speak text using macOS TTS',
    usage: '/say <text>',
    examples: ['/say Hello there'],
    parse: (input) => {
      const m = input.match(/^\s*\/say\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const text = unquote(m[1].trim())
      const cmd = `say ${JSON.stringify(text)}`
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'notify',
    label: 'notify',
    description: 'Show a macOS notification',
    usage: '/notify <title>: <message>  or  /notify <message>',
    examples: ['/notify Build Complete: All tests passed', '/notify Hello world'],
    parse: (input) => {
      const withTitle = input.match(/^\s*\/notify\s+(.+?)\s*:\s*(.+)\s*$/i)
      let cmd = ''
      if (withTitle) {
        const title = unquote(withTitle[1].trim())
        const msg = unquote(withTitle[2].trim())
        cmd = `osascript -e 'display notification ${JSON.stringify(msg)} with title ${JSON.stringify(title)}'`
      } else {
        const m = input.match(/^\s*\/notify\s+(.+?)\s*$/i)
        if (!m) return { ok: false }
        const msg = unquote(m[1].trim())
        cmd = `osascript -e 'display notification ${JSON.stringify(msg)}'`
      }
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'openurl',
    label: 'openurl',
    description: 'Open a URL in the default browser',
    usage: '/openurl <url>',
    examples: ['/openurl https://example.com'],
    parse: (input) => {
      const m = input.match(/^\s*\/openurl\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const url = unquote(m[1].trim())
      const cmd = `open ${JSON.stringify(url)}`
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'clip',
    label: 'clip',
    description: 'Get or set clipboard text',
    usage: '/clip get  or  /clip set "text"',
    examples: ['/clip get', '/clip set "Meeting moved to 3pm"'],
    parse: (input) => {
      const get = input.match(/^\s*\/clip\s+get\s*$/i)
      const set = input.match(/^\s*\/clip\s+set\s+(.+?)\s*$/i)
      if (!get && !set) return { ok: false }
      let cmd = ''
      if (get) cmd = 'pbpaste'
      else if (set) {
        const text = unquote(set[1].trim()).replace(/'/g, "'\\''")
        cmd = `printf '%s' '${text}' | pbcopy`
      }
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'trash',
    label: 'trash',
    description: 'Move a file to Trash',
    usage: '/trash "path-or-name"',
    examples: ['/trash "~/Desktop/old.png"'],
    parse: (input) => {
      const m = input.match(/^\s*\/trash\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const raw = unquote(m[1].trim())
      // Use AppleScript to move to trash so Finder reflects it
      const cmd = `osascript -e 'tell app "Finder" to delete POSIX file ${JSON.stringify(raw)}'`
      return { ok: true, output: JSON.stringify({ op: 'shell', cmd }), forceMode: 'tasks' }
    }
  },
  {
    id: 'help',
    label: 'help',
    description: 'Show help for all commands or a specific one',
    usage: '/help [command]',
    examples: ['/help', '/help rename'],
    parse: (input) => {
      const m = input.match(/^\s*\/help(?:\s+(\w+))?\s*$/i)
      if (!m) return { ok: false }
      const key = (m[1] || '').toLowerCase()
      const lines: string[] = []
      if (key) {
        const help = COMMAND_HELP[key]
        if (!help) {
          return { ok: true, output: `No help found for "${key}". Try /help for all commands.` }
        }
        lines.push(`/${help.label}`)
        if (help.description) lines.push(`- ${help.description}`)
        if (help.usage) lines.push(`Usage: ${help.usage}`)
        if (help.examples && help.examples.length > 0) {
          lines.push('Examples:')
          for (const ex of help.examples) lines.push(`- ${ex}`)
        }
      } else {
        lines.push('Available commands:')
        const labels = Object.values(COMMAND_HELP).map(h => `/${h.label}`).sort()
        lines.push(labels.join(', '))
        lines.push('Type /help <command> for details. Example: /help rename')
      }
      return { ok: true, output: lines.join('\n'), forceMode: 'chat' }
    }
  },
  {
    id: 'slack-dm',
    label: 'slack',
    description: 'Open Slack or DM a person by name (uses quick switcher)',
    usage: '/slack [full name]',
    examples: ['/slack', '/slack Matthew Wright'],
    parse: (input) => {
      const m = input.match(/^\s*\/slack(?:\s+(.+))?\s*$/i)
      if (!m) return { ok: false }
      const who = m[1] ? unquote(m[1].trim()) : ''
      const cmd = makeSlackDMCommand(who)
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'dm',
    label: 'dm',
    description: 'Open or send a DM in Slack by full name',
    usage: '/dm <full name>: <message>  or  /dm <full name>',
    examples: ['/dm Matthew Wright', '/dm Matthew Wright: Running 10 mins late'],
    parse: (input) => {
      const withMsg = input.match(/^\s*\/dm\s+(.+?)\s*:\s*(.+)\s*$/i)
      if (withMsg) {
        const who = unquote(withMsg[1].trim())
        const msg = unquote(withMsg[2].trim())
        const cmd = makeSlackDMSendCommand(who, msg)
        const json = { op: 'shell', cmd, meta: { kind: 'slack_dm', to: who, message: msg } }
        return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
      }
      const m = input.match(/^\s*\/dm\s+(.+)$/i)
      if (!m) return { ok: false }
      const who = unquote(m[1].trim())
      const cmd = makeSlackDMCommand(who)
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'quit-app',
    label: 'quit',
    description: 'Quit a macOS application',
    usage: '/quit <app name>',
    examples: ['/quit google chrome', '/quit Slack'],
    parse: (input) => {
      const m = input.match(/^\s*\/quit\s+(.+)$/i)
      if (!m) return { ok: false }
      const app = extractAppName(unquote(m[1].trim()))
      if (!app) return { ok: false, hint: 'Provide an app name' }
      const cmd = `osascript -e 'tell application "${app}" to quit'`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'focus-app',
    label: 'focus',
    description: 'Bring an app to front',
    usage: '/focus <app name>',
    examples: ['/focus Slack'],
    parse: (input) => {
      const m = input.match(/^\s*\/focus\s+(.+)$/i)
      if (!m) return { ok: false }
      const app = extractAppName(unquote(m[1].trim()))
      if (!app) return { ok: false, hint: 'Provide an app name' }
      const cmd = `osascript -e 'tell application "${app}" to activate'`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'hide-app',
    label: 'hide',
    description: 'Hide an app',
    usage: '/hide <app name>',
    examples: ['/hide Slack'],
    parse: (input) => {
      const m = input.match(/^\s*\/hide\s+(.+)$/i)
      if (!m) return { ok: false }
      const app = extractAppName(unquote(m[1].trim()))
      if (!app) return { ok: false, hint: 'Provide an app name' }
      const cmd = `osascript -e 'tell application "${app}" to hide'`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'restart-app',
    label: 'restart',
    description: 'Restart an app (quit then reopen)',
    usage: '/restart <app name>',
    examples: ['/restart Slack'],
    parse: (input) => {
      const m = input.match(/^\s*\/restart\s+(.+)$/i)
      if (!m) return { ok: false }
      const app = extractAppName(unquote(m[1].trim()))
      if (!app) return { ok: false, hint: 'Provide an app name' }
      const cmd = `osascript -e 'tell application "${app}" to quit' && open -a "${app}"`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'reveal',
    label: 'reveal',
    description: 'Show a file/folder in Finder',
    usage: '/reveal "My File" [--scope desktop|documents|downloads|pictures] ',
    examples: ['/reveal "Notes.txt" --scope desktop'],
    parse: (input) => {
      const m = input.match(/^\s*\/reveal\s+(.+?)(?:\s+--scope\s+(desktop|documents|downloads|pictures))?\s*$/i)
      if (!m) return { ok: false }
      const name = unquote(m[1].trim())
      const scope = (m[2] || 'any').toLowerCase()
      const json = { op: 'open', action: 'reveal', name, scope }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'list',
    label: 'list',
    description: 'List files or folders in a scope',
    usage: '/list <files|folders> <desktop|documents|downloads|pictures>',
    examples: ['/list files desktop', '/list folders documents'],
    parse: (input) => {
      const m = input.match(/^\s*\/list\s+(files|folders)\s+(desktop|documents|downloads|pictures)\s*$/i)
      if (!m) return { ok: false }
      const listType = m[1].toLowerCase()
      const scope = m[2].toLowerCase()
      const json = { op: 'locate', name: '*', scope, listType }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'mkdir',
    label: 'mkdir',
    description: 'Create a new folder in a scope (default: Documents)',
    usage: '/mkdir "Folder Name" [--scope desktop|documents|downloads|pictures]',
    examples: ['/mkdir "Invoices 2025" --scope documents'],
    parse: (input) => {
      const m = input.match(/^\s*\/mkdir\s+(.+?)(?:\s+--scope\s+(desktop|documents|downloads|pictures))?\s*$/i)
      if (!m) return { ok: false }
      const name = unquote(m[1].trim())
      const scope = (m[2] || 'documents').toLowerCase()
      const json = { op: 'mkdir', name, scope }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'move',
    label: 'move',
    description: 'Move a file or folder',
    usage: '/move "Source" -> "Destination"',
    examples: ['/move "~/Downloads/Report.pdf" -> "~/Documents"'],
    parse: (input) => {
      const m = input.match(/^\s*\/move\s+['"]?(.+?)['"]?\s+->\s+['"]?(.+?)['"]?\s*$/i)
      if (!m) return { ok: false }
      const src = m[1]
      const dest = m[2]
      const json = { op: 'move', src, dest }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'copy',
    label: 'copy',
    description: 'Copy a file or folder',
    usage: '/copy "Source" -> "Destination"',
    examples: ['/copy "~/Documents/Report.pdf" -> "~/Desktop/Report Copy.pdf"'],
    parse: (input) => {
      const m = input.match(/^\s*\/copy\s+['"]?(.+?)['"]?\s+->\s+['"]?(.+?)['"]?\s*$/i)
      if (!m) return { ok: false }
      const src = m[1]
      const dest = m[2]
      const json = { op: 'copy', src, dest }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'lock',
    label: 'lock',
    description: 'Lock the screen immediately',
    usage: '/lock',
    examples: ['/lock'],
    parse: (input) => {
      const m = input.match(/^\s*\/lock\s*$/i)
      if (!m) return { ok: false }
      const cmd = `/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'sleep',
    label: 'sleep',
    description: 'Put the Mac to sleep',
    usage: '/sleep',
    examples: ['/sleep'],
    parse: (input) => {
      const m = input.match(/^\s*\/sleep\s*$/i)
      if (!m) return { ok: false }
      const cmd = `osascript -e 'tell application "System Events" to sleep'`
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'volume',
    label: 'volume',
    description: 'Control system volume',
    usage: '/volume <up|down|mute|unmute|set N>',
    examples: ['/volume up', '/volume set 30', '/volume mute'],
    parse: (input) => {
      const m1 = input.match(/^\s*\/volume\s+(up|down)\s*$/i)
      const m2 = input.match(/^\s*\/volume\s+set\s+(\d{1,3})\s*$/i)
      const m3 = input.match(/^\s*\/volume\s+(mute|unmute)\s*$/i)
      let cmd = ''
      if (m1) {
        const dir = m1[1].toLowerCase()
        cmd = [
          'osascript',
          `-e 'set vol to output volume of (get volume settings)'`,
          dir === 'up' ? `-e 'set volume output volume (vol + 10)'` : `-e 'set volume output volume (vol - 10)'`,
        ].join(' ')
      } else if (m2) {
        const n = Math.max(0, Math.min(100, parseInt(m2[1], 10)))
        cmd = `osascript -e 'set volume output volume ${n}'`
      } else if (m3) {
        const which = m3[1].toLowerCase()
        cmd = which === 'mute'
          ? `osascript -e 'set volume output muted true'`
          : `osascript -e 'set volume output muted false'`
      } else {
        return { ok: false }
      }
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'mute',
    label: 'mute',
    description: 'Mute system audio',
    usage: '/mute',
    examples: ['/mute'],
    parse: (input) => {
      const m = input.match(/^\s*\/mute\s*$/i)
      if (!m) return { ok: false }
      const json = { op: 'shell', cmd: `osascript -e 'set volume output muted true'` }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'unmute',
    label: 'unmute',
    description: 'Unmute system audio',
    usage: '/unmute',
    examples: ['/unmute'],
    parse: (input) => {
      const m = input.match(/^\s*\/unmute\s*$/i)
      if (!m) return { ok: false }
      const json = { op: 'shell', cmd: `osascript -e 'set volume output muted false'` }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'run',
    label: 'run',
    description: 'Run a shell command',
    usage: '/run <command>',
    examples: ['/run ls -la', '/run whoami'],
    parse: (input) => {
      const m = input.match(/^\s*\/run\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const cmd = m[1]
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'git',
    label: 'git',
    description: 'Shortcut for git commands',
    usage: '/git <args>',
    examples: ['/git status', '/git log --oneline'],
    parse: (input) => {
      const m = input.match(/^\s*\/git\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const cmd = 'git ' + m[1]
      const json = { op: 'shell', cmd }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'kill',
    label: 'kill',
    description: 'Kill a process by name',
    usage: '/kill <process>',
    examples: ['/kill node', '/killall Slack'],
    parse: (input) => {
      const m = input.match(/^\s*\/kill\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const name = m[1].trim()
      const json = { op: 'shell', cmd: `killall ${name}` }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'search',
    label: 'search',
    description: 'Web search and research (research mode)',
    usage: '/search <query>',
    examples: ['/search TypeScript 5 release notes'],
    parse: (input) => {
      const m = input.match(/^\s*\/search\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const query = unquote(m[1].trim())
      return { ok: true, output: query, forceMode: 'research' }
    }
  },
  {
    id: 'news',
    label: 'news',
    description: 'News-focused research (research mode)',
    usage: '/news <topic>',
    examples: ['/news AI regulation'],
    parse: (input) => {
      const m = input.match(/^\s*\/news\s+(.+?)\s*$/i)
      if (!m) return { ok: false }
      const topic = unquote(m[1].trim())
      const q = `latest ${topic} news`
      return { ok: true, output: q, forceMode: 'research' }
    }
  },
  {
    id: 'locate',
    label: 'locate',
    description: 'Locate a file/folder (optionally by scope)',
    usage: '/locate "My File" [--scope desktop|documents|downloads|pictures] [--content]',
    examples: ['/locate "Budget.xlsx" --scope documents', '/locate screenshot --content'],
    parse: (input) => {
      const re = /^\s*\/locate\s+(.+?)(?:\s+--scope\s+(desktop|documents|downloads|pictures))?(?:\s+(--content))?\s*$/i
      const m = input.match(re)
      if (!m) return { ok: false }
      const name = unquote(m[1].trim())
      const scope = (m[2] || 'any').toLowerCase()
      const contentSearch = Boolean(m[3])
      const json = { op: 'locate', name, scope, ...(contentSearch ? { contentSearch: true } : {}) }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'rename',
    label: 'rename',
    description: 'Rename a file or folder',
    usage: '/rename "Old Name" -> "New Name"',
    examples: ['/rename "Notes.txt" -> "Notes-2025.txt"'],
    parse: (input) => {
      const m = input.match(/^\s*\/rename\s+['"]?(.+?)['"]?\s+->\s+['"]?(.+?)['"]?\s*$/i)
      if (!m) return { ok: false }
      const src = m[1]
      const dest = m[2]
      const json = { op: 'rename', src, dest }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
  {
    id: 'ocr',
    label: 'ocr',
    description: 'Search images for text via OCR',
    usage: '/ocr <folder-or-file> [--text "query" | --all]',
    examples: ['/ocr ~/Desktop --text "invoice"', '/ocr ~/Downloads --all'],
    parse: (input) => {
      const m = input.match(/^\s*\/ocr\s+(.+?)(?:\s+--text\s+(.+?)|\s+--all)?\s*$/i)
      if (!m) return { ok: false }
      const target = unquote(m[1].trim())
      const textArg = m[2] ? unquote(m[2].trim()) : '*'
      const json = { op: 'ocr_search', text: textArg || '*', paths: [target] }
      return { ok: true, output: JSON.stringify(json), forceMode: 'tasks' }
    }
  },
]

// Public API
export function listSlashCommands(query?: string): SlashCommand[] {
  const q = (query || '').toLowerCase().replace(/^\//, '').trim()
  const enrich = (c: SlashCommand): SlashCommand => {
    const help = COMMAND_HELP[c.label]
    if (!help) return c
    return { ...c, description: help.description ?? c.description, usage: help.usage ?? c.usage, examples: help.examples ?? c.examples }
  }
  if (!q) return builtin.map(enrich)
  return builtin.filter(c => c.label.toLowerCase().includes(q)).map(enrich)
}

export function runSlashCommand(input: string): SlashResult {
  const text = input.trim()
  if (!text.startsWith('/')) return { ok: false }
  for (const cmd of builtin) {
    const res = cmd.parse(text)
    if (res.ok) return res
  }
  return { ok: false }
}


