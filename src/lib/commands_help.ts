export type SlashHelp = {
  label: string
  description?: string
  usage?: string
  examples?: string[]
}

export const COMMAND_HELP: Record<string, SlashHelp> = {
  // App control
  open: {
    label: 'open',
    description: 'Open a macOS application',
    usage: '/open <app name>',
    examples: ['/open slack', '/open google chrome', '/open "Visual Studio Code"'],
  },
  quit: {
    label: 'quit',
    description: 'Quit a macOS application',
    usage: '/quit <app name>',
    examples: ['/quit google chrome', '/quit Slack'],
  },
  focus: {
    label: 'focus',
    description: 'Bring an app to front',
    usage: '/focus <app name>',
    examples: ['/focus Slack'],
  },
  hide: {
    label: 'hide',
    description: 'Hide an app',
    usage: '/hide <app name>',
    examples: ['/hide Slack'],
  },
  restart: {
    label: 'restart',
    description: 'Restart an app (quit then reopen)',
    usage: '/restart <app name>',
    examples: ['/restart Slack'],
  },
  lock: {
    label: 'lock',
    description: 'Lock the screen immediately',
    usage: '/lock',
    examples: ['/lock'],
  },
  sleep: {
    label: 'sleep',
    description: 'Put the Mac to sleep',
    usage: '/sleep',
    examples: ['/sleep'],
  },
  volume: {
    label: 'volume',
    description: 'Control system volume',
    usage: '/volume <up|down|mute|unmute|set N>',
    examples: ['/volume up', '/volume set 30', '/volume mute'],
  },
  mute: {
    label: 'mute',
    description: 'Mute system audio',
    usage: '/mute',
    examples: ['/mute'],
  },
  unmute: {
    label: 'unmute',
    description: 'Unmute system audio',
    usage: '/unmute',
    examples: ['/unmute'],
  },

  // Slack
  slack: {
    label: 'slack',
    description: 'Open Slack or DM a person by name (uses quick switcher)',
    usage: '/slack [full name]',
    examples: ['/slack', '/slack Matthew Wright'],
  },
  dm: {
    label: 'dm',
    description: 'Open or send a DM in Slack by full name',
    usage: '/dm <full name>: <message>  or  /dm <full name>',
    examples: ['/dm Matthew Wright', '/dm Matthew Wright: Running 10 mins late'],
  },

  // Files
  locate: {
    label: 'locate',
    description: 'Locate a file/folder (optionally by scope)',
    usage: '/locate "My File" [--scope desktop|documents|downloads|pictures] [--content]',
    examples: ['/locate "Budget.xlsx" --scope documents', '/locate screenshot --content'],
  },
  reveal: {
    label: 'reveal',
    description: 'Show a file/folder in Finder',
    usage: '/reveal "My File" [--scope desktop|documents|downloads|pictures] ',
    examples: ['/reveal "Notes.txt" --scope desktop'],
  },
  rename: {
    label: 'rename',
    description: 'Rename a file or folder',
    usage: '/rename "Old Name" -> "New Name"',
    examples: ['/rename "Notes.txt" -> "Notes-2025.txt"'],
  },
  mkdir: {
    label: 'mkdir',
    description: 'Create a new folder in a scope (default: Documents)',
    usage: '/mkdir "Folder Name" [--scope desktop|documents|downloads|pictures]',
    examples: ['/mkdir "Invoices 2025" --scope documents'],
  },
  move: {
    label: 'move',
    description: 'Move a file or folder',
    usage: '/move "Source" -> "Destination"',
    examples: ['/move "~/Downloads/Report.pdf" -> "~/Documents"'],
  },
  copy: {
    label: 'copy',
    description: 'Copy a file or folder',
    usage: '/copy "Source" -> "Destination"',
    examples: ['/copy "~/Documents/Report.pdf" -> "~/Desktop/Report Copy.pdf"'],
  },
  ocr: {
    label: 'ocr',
    description: 'Search images for text via OCR',
    usage: '/ocr <folder-or-file> [--text "query" | --all]',
    examples: ['/ocr ~/Desktop --text "invoice"', '/ocr ~/Downloads --all'],
  },
  list: {
    label: 'list',
    description: 'List files or folders in a scope',
    usage: '/list <files|folders> <desktop|documents|downloads|pictures>',
    examples: ['/list files desktop', '/list folders documents'],
  },

  // Research & shell
  search: {
    label: 'search',
    description: 'Web search and research (research mode)',
    usage: '/search <query>',
    examples: ['/search TypeScript 5 release notes']
  },
  news: {
    label: 'news',
    description: 'News-focused research (research mode)',
    usage: '/news <topic>',
    examples: ['/news AI regulation']
  },
  run: {
    label: 'run',
    description: 'Run a shell command',
    usage: '/run <command>',
    examples: ['/run ls -la', '/run whoami']
  },
  git: {
    label: 'git',
    description: 'Shortcut for git commands',
    usage: '/git <args>',
    examples: ['/git status', '/git log --oneline']
  },
  kill: {
    label: 'kill',
    description: 'Kill a process by name',
    usage: '/kill <process>',
    examples: ['/kill node', '/killall Slack']
  },
  screenshot: {
    label: 'screenshot',
    description: 'Take a screenshot to Desktop (full screen by default)',
    usage: '/screenshot [--window|--selection] [--out ~/Desktop/file.png]',
    examples: ['/screenshot', '/screenshot --window', '/screenshot --out ~/Desktop/shot.png']
  },
  say: {
    label: 'say',
    description: 'Speak text using macOS TTS',
    usage: '/say <text>',
    examples: ['/say Hello there']
  },
  notify: {
    label: 'notify',
    description: 'Show a macOS notification',
    usage: '/notify <title>: <message>  or  /notify <message>',
    examples: ['/notify Build Complete: All tests passed', '/notify Hello world']
  },
  openurl: {
    label: 'openurl',
    description: 'Open a URL in the default browser',
    usage: '/openurl <url>',
    examples: ['/openurl https://example.com']
  },
  clip: {
    label: 'clip',
    description: 'Get or set clipboard text',
    usage: '/clip get  or  /clip set "text"',
    examples: ['/clip get', '/clip set "Meeting moved to 3pm"']
  },
  trash: {
    label: 'trash',
    description: 'Move a file to Trash',
    usage: '/trash "path-or-name"',
    examples: ['/trash "~/Desktop/old.png"']
  },
}


