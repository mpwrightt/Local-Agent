import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect } from 'vitest'
import { } from '../chat-message'
// Re-export BasicMarkdown for tests (temporary) by importing compiled file path
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import ChatMessageModule from '../chat-message'

const BasicMarkdown = (ChatMessageModule as any).__esModule
  ? (ChatMessageModule as any).default?.BasicMarkdown || (ChatMessageModule as any).BasicMarkdown
  : (ChatMessageModule as any).BasicMarkdown

describe('BasicMarkdown', () => {
  it('renders headings and lists', () => {
    const text = '# Title\n\n- a\n- b\n'
    const { container } = render(<BasicMarkdown text={text} />)
    expect(container.querySelector('h2')?.textContent).toBe('Title')
    expect(container.querySelectorAll('li').length).toBe(2)
  })

  it('renders pipe tables', () => {
    const text = 'A|B\n-|-\n1|2\n'
    const { container } = render(<BasicMarkdown text={text} />)
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(container.querySelectorAll('th').length).toBe(2)
    expect(container.querySelectorAll('td').length).toBe(2)
  })

  it('renders fenced code blocks', () => {
    const text = '```js\nconsole.log(1)\n```'
    const { container } = render(<BasicMarkdown text={text} />)
    expect(container.querySelector('pre code')?.textContent).toContain('console.log')
  })
})


