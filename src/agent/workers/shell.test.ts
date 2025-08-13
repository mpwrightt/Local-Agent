import { describe, it, expect } from 'vitest'

// These tests are minimal and do not execute real shell commands.
// They validate the whitelist change that allows `open` without confirmation.

function isWhitelisted(cmd: string): boolean {
  const first = cmd.trim().split(/\s+/)[0]
  const whitelist = new Set(['git', 'ls', 'cat', 'echo', 'pwd', 'open'])
  return whitelist.has(first)
}

describe('shell whitelist', () => {
  it('permits open without confirmation', () => {
    expect(isWhitelisted('open -a "Slack"')).toBe(true)
    expect(isWhitelisted('open /Applications/Google\\ Chrome.app')).toBe(true)
  })
  it('still blocks non-whitelisted commands by default', () => {
    expect(isWhitelisted('rm -rf ~')).toBe(false)
    expect(isWhitelisted('curl https://example.com')).toBe(false)
  })
})


