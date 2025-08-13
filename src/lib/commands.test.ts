import { describe, it, expect } from 'vitest'
import { runSlashCommand, listSlashCommands } from './commands'

describe('slash commands', () => {
  it('parses /open', () => {
    const res = runSlashCommand('/open Slack')
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.output).toContain('open -a')
      expect(res.forceMode).toBe('tasks')
    }
  })
  it('lists suggestions', () => {
    const list = listSlashCommands('/o')
    expect(list.length).toBeGreaterThan(0)
  })
  it('parses /reveal', () => {
    const res = runSlashCommand('/reveal "Notes.txt" --scope desktop')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.output).toContain('"action":"reveal"')
  })
  it('parses /mkdir', () => {
    const res = runSlashCommand('/mkdir "Invoices 2025" --scope documents')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.output).toContain('"op":"mkdir"')
  })
  it('parses /move', () => {
    const res = runSlashCommand('/move "a.txt" -> "b.txt"')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.output).toContain('"op":"move"')
  })
  it('parses /copy', () => {
    const res = runSlashCommand('/copy "a.txt" -> "b.txt"')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.output).toContain('"op":"copy"')
  })
  it('parses /volume set', () => {
    const res = runSlashCommand('/volume set 25')
    expect(res.ok).toBe(true)
  })
  it('parses /search into research mode', () => {
    const res = runSlashCommand('/search TypeScript 5 release notes')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.forceMode).toBe('research')
  })
})


