import { useEffect, useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Command as CommandIcon, Save, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMMAND_HELP } from '@/lib/commands_help'

type SavedCommand = { id: string; label: string; description?: string; template: string }

function loadSaved(): SavedCommand[] {
  try {
    const s = localStorage.getItem('custom-commands')
    if (!s) return []
    const arr = JSON.parse(s)
    if (Array.isArray(arr)) return arr
  } catch {}
  return []
}

function saveAll(list: SavedCommand[]) {
  try { localStorage.setItem('custom-commands', JSON.stringify(list)) } catch {}
}

export function CommandBuilder({ onInsert }: { onInsert?: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'reference' | 'builder'>('reference')
  const [prompt, setPrompt] = useState('Open Slack and start a new message to John')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SavedCommand[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTemplate, setEditTemplate] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => setSaved(loadSaved()), [])

  const categories = useMemo(() => {
    const map: Record<string, string> = {
      // Apps
      open: 'Apps', quit: 'Apps', focus: 'Apps', hide: 'Apps', restart: 'Apps',
      // Slack
      slack: 'Slack', dm: 'Slack',
      // Files
      locate: 'Files', reveal: 'Files', rename: 'Files', mkdir: 'Files', move: 'Files', copy: 'Files', ocr: 'Files', list: 'Files', trash: 'Files',
      // System
      screenshot: 'System', say: 'System', notify: 'System', openurl: 'System', clip: 'System', lock: 'System', sleep: 'System', volume: 'System', mute: 'System', unmute: 'System',
      // Research
      search: 'Research', news: 'Research',
      // Shell
      run: 'Shell', git: 'Shell', kill: 'Shell',
      // General
      help: 'General',
    }
    const groups: Record<string, Array<{ key: string; label: string }>> = {}
    for (const key of Object.keys(COMMAND_HELP)) {
      const cat = map[key] || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ key, label: '/' + COMMAND_HELP[key].label })
    }
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.label.localeCompare(b.label))
    const order = ['Apps', 'Files', 'Slack', 'System', 'Research', 'Shell', 'General', 'Other']
    return order.filter(o => groups[o]?.length).map(o => ({ name: o, items: groups[o] }))
  }, [])

  const [activeCategory, setActiveCategory] = useState<string>('Apps')

  async function generate() {
    // Simple heuristic mapping to our slash syntax
    const p = prompt.toLowerCase()
    if (/open\s+.+/.test(p)) {
      const app = prompt.replace(/.*open\s+/i, '').trim()
      setDraft(`/open ${app}`)
      return
    }
    if (/rename\s+.+\s+to\s+.+/.test(p)) {
      const m = prompt.match(/rename\s+(.+)\s+to\s+(.+)/i)
      if (m) setDraft(`/rename "${m[1]}" -> "${m[2]}"`)
      return
    }
    if (/find|locate/.test(p)) {
      const name = prompt.replace(/.*?(find|locate)\s+/i, '')
      setDraft(`/locate "${name}"`)
      return
    }
    // fallback
    setDraft('/open Slack')
  }

  function doSave() {
    if (!draft.trim()) return
    setSaving(true)
    const id = 'cmd-' + Date.now()
    const label = (draft.trim().startsWith('/') ? draft.trim().slice(1) : draft.trim()).split(/\s+/)[0]
    const item: SavedCommand = { id, label, template: draft, description: prompt }
    const next = [item, ...saved].slice(0, 50)
    setSaved(next)
    saveAll(next)
    setSaving(false)
  }

  function beginEdit(item: SavedCommand) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditTemplate(item.template)
    setEditDescription(item.description || '')
  }

  function applyEdit() {
    if (!editingId) return
    const next = saved.map(s => s.id === editingId ? { ...s, label: editLabel.trim() || s.label, template: editTemplate.trim() || s.template, description: editDescription } : s)
    setSaved(next)
    saveAll(next)
    setEditingId(null)
  }

  function remove(id: string) {
    const next = saved.filter(s => s.id !== id)
    setSaved(next)
    saveAll(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              aria-label="Command builder"
              className={cn('flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:scale-[1.03]')}
            >
              <CommandIcon className="h-4.5 w-4.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Create command</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[560px] p-3">
        <div className="space-y-3 text-sm text-white/90">
          {/* View switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('reference')}
              className={cn('px-2 py-1 rounded-md border text-xs', view==='reference' ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/10')}
            >Commands</button>
            <button
              onClick={() => setView('builder')}
              className={cn('px-2 py-1 rounded-md border text-xs', view==='builder' ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/10')}
            >Create</button>
          </div>

          {view === 'reference' ? (
            <div className="space-y-3">
              {/* Category chips */}
              <div className="flex flex-wrap gap-1">
                {categories.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setActiveCategory(c.name)}
                    className={cn('px-2 py-1 rounded-full border text-[11px]', activeCategory===c.name ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/10')}
                  >{c.name}</button>
                ))}
              </div>
              {/* Commands grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-auto pr-1">
                {categories
                  .filter(c => c.name === activeCategory)[0]?.items.map(({ key }) => {
                    const it = (COMMAND_HELP as any)[key]
                    return (
                      <div key={key} className="rounded-lg border border-white/10 bg-white/5 p-2">
                        <div className="text-white font-medium">/{it.label}</div>
                        {it.description && <div className="text-xs text-white/70 mt-0.5">{it.description}</div>}
                        {it.usage && <div className="text-xs text-white/60 mt-1">Usage: <span className="text-white/80">{it.usage}</span></div>}
                        <div className="mt-2 flex items-center gap-2">
                          {it.examples?.[0] && (
                            <button
                              onClick={() => onInsert?.(it.examples[0])}
                              className="px-2 py-1 rounded-md border border-white/10 bg-white/10 text-xs"
                            >Insert example</button>
                          )}
                          {it.usage && (
                            <button
                              onClick={() => onInsert?.(it.usage.startsWith('/') ? it.usage : `/${it.usage}`)}
                              className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs"
                            >Insert usage</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs text-white/60">Describe your command</div>
                <textarea className="w-full h-16 rounded-lg bg-white/5 border border-white/10 p-2 text-white" value={prompt} onChange={e => setPrompt(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-xs text-white/60">Generated slash command</div>
                <input className="w-full rounded-lg bg-white/5 border border-white/10 p-2 text-white" value={draft} onChange={e => setDraft(e.target.value)} placeholder="/open Slack" />
                <div className="text-[11px] text-white/50 mt-1">Tip: You can edit the command before inserting or saving.</div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={generate} className="px-2 py-1 rounded-md border border-white/10 bg-white/5">Generate</button>
                <button onClick={() => draft && onInsert?.(draft)} className="px-2 py-1 rounded-md border border-white/10 bg-white/10">Insert</button>
                <button onClick={doSave} disabled={saving || !draft.trim()} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/5">
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </div>
              {saved.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-white/60">Saved</div>
                  <div className="grid gap-1 max-h-32 overflow-auto pr-1">
                    {saved.map(s => (
                      <div key={s.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                        {editingId === s.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <input className="col-span-1 rounded bg-white/5 border border-white/10 p-1 text-xs text-white" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="label (no /)" />
                              <input className="col-span-2 rounded bg-white/5 border border-white/10 p-1 text-xs text-white" value={editTemplate} onChange={e => setEditTemplate(e.target.value)} placeholder="/open Slack" />
                            </div>
                            <input className="w-full rounded bg-white/5 border border-white/10 p-1 text-xs text-white" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="description" />
                            <div className="flex items-center gap-2">
                              <button onClick={applyEdit} className="px-2 py-1 rounded-md border border-white/10 bg-white/10 text-xs">Save</button>
                              <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs">
                              <div className="font-medium">/{s.label}</div>
                              <div className="text-white/70">{s.template}</div>
                              {s.description && <div className="text-white/60">{s.description}</div>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button title="Insert" onClick={() => onInsert?.(s.template)} className="px-2 py-1 rounded-md border border-white/10 bg-white/10 text-xs">Insert</button>
                              <button title="Edit" onClick={() => beginEdit(s)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70"><Pencil className="h-3.5 w-3.5" /></button>
                              <button title="Delete" onClick={() => remove(s.id)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}


