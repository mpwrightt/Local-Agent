import OpenAI from 'openai'
import { z } from 'zod'

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  role: z.enum(['orchestrator', 'research', 'fileops', 'automation', 'shell', 'reviewer', 'summarizer']),
  deps: z.array(z.string()).default([]),
  budgets: z.object({ tokens: z.number().optional(), seconds: z.number().optional() }).default({}),
})

export type PlannedTask = z.infer<typeof TaskSchema>

export async function selectModel(client: OpenAI): Promise<string> {
  if (process.env.LMSTUDIO_MODEL && process.env.LMSTUDIO_MODEL.length > 0) {
    return process.env.LMSTUDIO_MODEL
  }
  try {
    const list = await client.models.list()
    const names = list.data.map((m: any) => m.id)
    const preferred = names.find((n: string) => n.includes('gpt-oss'))
      || names.find((n: string) => n.includes('20b'))
      || names.find((n: string) => n.includes('llama'))
      || names[0]
    if (preferred) return preferred
  } catch {}
  // Default fallback model name
  return 'local-model'
}

// Detect local file/folder locate intent
function detectLocateTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // JSON override
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'locate' && typeof j.name === 'string') {
      return [
        { id: 'locate', title: 'Locate file/folder', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Natural language patterns - enhanced to catch more conversational requests
  const patterns: RegExp[] = [
    // Direct requests
    /where\s+is\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /find\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /locate\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    // Conversational patterns
    /I\s+(?:think\s+)?(?:have|had)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /(?:there's|there\s+is)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /I\s+(?:can't\s+remember\s+where|lost|misplaced).*?(?:file|folder).*?["'](.+?)["']/i,
    /(?:somewhere\s+on\s+my\s+(?:laptop|computer|mac)).*?(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    // Pattern for "I think it's called something like..."
    /(?:I\s+think\s+)?(?:it's\s+called|named)\s+something\s+like.*?["'](.+?)["']/i,
    // Pattern without quotes for names with special characters (more precise)
    /(?:it's\s+called|named)\s+something\s+like\s+"([^"]+)"/i,
  ]
  // High-level intents like "list files/folders on desktop"
  const listFolders = p.match(/\b(list|show|find)\s+(?:all\s+)?(folders|directories)\s+(?:on\s+the\s+)?(desktop|documents|downloads|pictures)\b/i)
  if (listFolders) {
    const scope = (listFolders[3] || 'any').toLowerCase()
    const payload = { op: 'locate', name: '*', scope, listType: 'folders' }
    return [ { id: 'locate', title: 'List folders', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  const listFiles = p.match(/\b(list|show)\s+(?:all\s+)?files\s+(?:on\s+the\s+)?(desktop|documents|downloads|pictures)\b/i)
  if (listFiles) {
    const scope = (listFiles[2] || 'any').toLowerCase()
    const payload = { op: 'locate', name: '*', scope, listType: 'files' }
    return [ { id: 'locate', title: 'List files', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  
  // Check if this is a content-based search request (OCR needed)
  const contentSearchIndicators = [
    /screenshot.*?(?:with|has|contains).*?text/i,
    /image.*?(?:with|has|contains).*?text/i,
    /(?:text|words).*?(?:in|inside).*?(?:screenshot|image|picture)/i,
    /(?:screenshot|image|picture).*?(?:says|contains|has).*?["'](.+?)["']/i,
    /(?:find|locate).*?(?:screenshot|image).*?(?:text|content|saying)/i,
    /what.*?text.*?(?:do you see|in this image|in the image)/i,
    /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
    /(?:what does|what's in).*?(?:this|the).*?image.*?say/i,
  ]
  
  let isContentSearch = false
  let contentSearchText = ''
  
  for (const indicator of contentSearchIndicators) {
    const match = p.match(indicator)
    if (match) {
      isContentSearch = true
      // Try to extract the text being searched for
      const textMatch = p.match(/["']([^"']+)["']/i)
      if (textMatch) {
        contentSearchText = textMatch[1]
      } else {
        // Check if this is a general OCR request (extract all text)
        const generalOcrPatterns = [
          /what.*?text.*?(?:do you see|in this image|in the image)/i,
          /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
          /(?:what does|what's in).*?(?:this|the).*?image.*?say/i,
        ]
        
        const isGeneralOcr = generalOcrPatterns.some(pattern => pattern.test(p))
        if (isGeneralOcr) {
          contentSearchText = "*" // Special marker for "extract all text"
        } else {
          // Fall back to extracting key phrases
          const words = p.split(/\s+/).filter(w => w.length > 3)
          contentSearchText = words.slice(-3).join(' ') // Last few meaningful words
        }
      }
      break
    }
  }
  // If content search is detected, use the extracted text
  if (isContentSearch && contentSearchText) {
    const payload = { op: 'locate', name: contentSearchText, scope: 'any', contentSearch: true, originalPrompt: p }
    return [
      { id: 'locate', title: 'Search images for text content', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  
  for (const r of patterns) {
    const m = p.match(r)
    if (m && m[1]) {
      const rawName = m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
      const scopeWord = (m[3] || '').toLowerCase()
      const scope = ['desktop', 'documents', 'downloads', 'pictures'].includes(scopeWord) ? scopeWord : 'any'
      
      // Check if this might benefit from content search
      const mightNeedContentSearch = /screenshot|image|picture/i.test(p) || 
                                   /text.*(?:in|inside|contains)/i.test(p) ||
                                   /(?:says|contains|has).*text/i.test(p)
      
      const payload = { 
        op: 'locate', 
        name: rawName, 
        scope,
        contentSearch: mightNeedContentSearch,
        originalPrompt: p
      }
      
      const title = mightNeedContentSearch ? 
        'Search for files and image content' : 
        'Locate file/folder'
      
      return [
        { id: 'locate', title, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  }
  return null
}

// Detect open/reveal intents for previously mentioned or obvious folders/files
function detectOpenTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  const open = p.match(/\b(?:open|launch)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i)
  if (open && open[1]) {
    const name = open[1].trim()
    const scope = (open[2] || 'any').toLowerCase()
    const payload = { op: 'open', action: 'open', name, scope }
    return [ { id: 'open', title: `Open ${name}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  const reveal = p.match(/\b(?:show|reveal)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+in\s+finder)?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i)
  if (reveal && reveal[1]) {
    const name = reveal[1].trim()
    const scope = (reveal[2] || 'any').toLowerCase()
    const payload = { op: 'open', action: 'reveal', name, scope }
    return [ { id: 'open', title: `Reveal ${name}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
  }
  return null
}

// Simple deterministic detection for local file rename requests
function detectRenameTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // Allow JSON description
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'rename' && typeof j.src === 'string' && typeof j.dest === 'string') {
      return [
        { id: 'rename', title: 'Rename file', description: JSON.stringify(j), role: 'fileops', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Regex pattern: rename <src> to <dest>
  const m = p.match(/rename\s+['\"]?(.+?)['\"]?\s+(?:to|->)\s+['\"]?(.+?)['\"]?$/i)
  if (m && m[1] && m[2]) {
    const payload = { op: 'rename', src: m[1], dest: m[2] }
    return [
      { id: 'rename', title: 'Rename file', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  // Conversational desktop phrasing: rename the folder named X on my desktop to Y
  const m2 = p.match(/rename\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?(.+?)\s+(?:on\s+my\s+desktop|on\s+desktop)?\s+(?:to|->)\s+(.+)$/i)
  if (m2 && m2[1] && m2[2]) {
    const payload = { op: 'rename', src: `Desktop ${m2[1]}`.trim(), dest: m2[2].trim() }
    return [
      { id: 'rename', title: 'Rename file', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} },
    ]
  }
  return null
}

export async function planTasks(prompt: string, modelOverride?: string, deep?: boolean, automation?: boolean): Promise<PlannedTask[]> {
  // Check for uploaded image first
  const uploadedImageMatch = prompt.match(/\[UPLOADED_IMAGE_PATH:([^\]]+)\]\s*(.*)/)
  if (uploadedImageMatch) {
    const imagePath = uploadedImageMatch[1]
    const userQuestion = uploadedImageMatch[2].trim()
    
    console.log('Detected uploaded image:', imagePath)
    console.log('User question:', userQuestion)
    
    // Create OCR task for the specific uploaded image
    const searchText = userQuestion.toLowerCase().includes('what') && 
                      userQuestion.toLowerCase().includes('text') ? '*' : userQuestion || '*'
    
    const payload = { 
      op: 'ocr_search', 
      text: searchText,
      paths: [imagePath], // Only process this specific image
      originalPrompt: userQuestion || 'What text do you see in this image?'
    }
    
    return [
      { 
        id: 'ocr_uploaded', 
        title: 'Extract text from uploaded image', 
        description: JSON.stringify(payload), 
        role: 'fileops', 
        deps: [], 
        budgets: {} 
      },
    ]
  }
  
  // If the user asked for a direct filesystem action like rename, short-circuit the planner
  const openPlan = detectOpenTask(prompt)
  if (openPlan) return openPlan
  const locatePlan = detectLocateTask(prompt)
  if (locatePlan) return locatePlan
  const renamePlan = detectRenameTask(prompt)
  if (renamePlan) return renamePlan
  const shellPlan = detectShellTask(prompt)
  if (shellPlan) return shellPlan
  // Lightweight local plan via LM Studio. Keep token budget small for speed.
  const taskFocus = automation ? "Mac control, file operations, shell commands, browser automation" : "web research, information gathering, analysis, synthesis"
  const preferredRoles = automation ? "fileops (local file edits), shell (terminal commands), automation (browser/app control)" : "research (web), reviewer (analysis), fileops (summary writing)"
  
  const system = `You are a local orchestrator that breaks a single user task into a small DAG of concrete steps.
Return 2-5 tasks max, each with an id, title, description, role, deps (by id), and tiny budgets.

${automation ? 'TASK MODE' : 'RESEARCH MODE'}: Focus on ${taskFocus}.
Use roles: ${preferredRoles}. Prefer reversible steps first.

${automation ? 
  'For task mode: Prioritize direct actions like file operations, shell commands, opening apps, browser automation.' : 
  'For research mode: Prioritize web research, data gathering, analysis, and report generation.'
}

Respond with valid JSON only, no other text.`

  const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
  const client = new OpenAI({
    baseURL,
    apiKey: 'not-needed'
  })
  let res: any
  let modelName = modelOverride ?? (await selectModel(client))
  try {
    res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })
  } catch (e) {
    // Try again with a simpler fallback
    modelName = 'local-model'
    res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    })
  }

  let tasks: PlannedTask[] = []
  try {
    const text = res.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(text)
    const maybeArray = Array.isArray(parsed) ? parsed : parsed.tasks
    tasks = z.array(TaskSchema).parse(maybeArray)
  } catch (e) {
    // Robust fallback plan based on mode
    if (automation) {
      // Tasks mode fallback - focus on direct actions
      // Smarter fallback for listing/searching on known scopes
      const p = prompt.toLowerCase()
      const scopeMatch = p.match(/\b(desktop|documents|downloads|pictures)\b/)
      const scope = scopeMatch ? scopeMatch[1] : 'any'
      const isList = /\b(list|show)\b/.test(p)
      const wantsFolders = /\bfolders?|directories\b/.test(p)
      const wantsFiles = /\bfiles?\b/.test(p)
      if (isList && (wantsFolders || wantsFiles)) {
        const payload = { op: 'locate', name: '*', scope, listType: wantsFolders ? 'folders' : 'files' }
        tasks = [ { id: 'locate', title: `List ${wantsFolders ? 'folders' : 'files'}`, description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
      } else if (p.includes('folder') || p.includes('file')) {
        const payload = { op: 'locate', name: '*', scope }
        tasks = [ { id: 'locate', title: 'Search for file/folder', description: JSON.stringify(payload), role: 'fileops', deps: [], budgets: {} } ]
      } else {
        tasks = [
          { id: 't1', title: 'Analyze request', description: `Understand what needs to be done: ${prompt}`, role: 'fileops', deps: [], budgets: {} },
          { id: 't2', title: 'Execute task', description: prompt, role: 'shell', deps: ['t1'], budgets: {} },
        ]
      }
    } else if (deep) {
      // Research mode fallback - comprehensive research
      tasks = [
        { id: 'r1', title: 'Initial web scan', description: prompt, role: 'research', deps: [], budgets: {} },
        { id: 'r2', title: 'Broaden sources', description: `${prompt} additional perspectives`, role: 'research', deps: [], budgets: {} },
        { id: 's1', title: 'Synthesize and debate', description: 'Compare findings, note conflicts, pick best-supported claims', role: 'reviewer', deps: ['r1','r2'], budgets: {} },
        { id: 'w1', title: 'Write Summary', description: 'Create a local summary file', role: 'fileops', deps: ['s1'], budgets: {} },
      ]
    } else {
      // Simple research fallback
      tasks = [
        { id: 'r1', title: 'Quick web scan', description: prompt, role: 'research', deps: [], budgets: {} },
        { id: 'w1', title: 'Write Summary', description: 'Create a local summary file', role: 'fileops', deps: ['r1'], budgets: {} },
      ]
    }
  }
  return tasks
}


// Detect shell command intents
function detectShellTask(prompt: string): PlannedTask[] | null {
  const p = prompt.trim()
  // JSON override: { op: 'shell', cmd: 'git status' }
  try {
    const j = JSON.parse(p)
    if (j && j.op === 'shell' && typeof j.cmd === 'string') {
      return [
        { id: 'sh1', title: 'Run shell command', description: JSON.stringify({ cmd: j.cmd }), role: 'shell', deps: [], budgets: {} },
      ]
    }
  } catch {}
  // Natural language prefixes
  const m = p.match(/^(?:shell:|run:|execute:)\s*(.+)$/i)
  if (m && m[1]) {
    const payload = { cmd: m[1].trim() }
    return [
      { id: 'sh1', title: 'Run shell command', description: JSON.stringify(payload), role: 'shell', deps: [], budgets: {} },
    ]
  }
  return null
}


