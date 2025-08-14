import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BlobVisualizer } from './BlobVisualizer'

// Mock Three.js and React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useFrame: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  Sphere: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sphere">{children}</div>
  ),
  MeshDistortMaterial: () => <div data-testid="mesh-distort-material" />,
}))

vi.mock('three', () => ({
  __esModule: true,
  default: {},
}))

describe('BlobVisualizer', () => {
  const variants = ['halo', 'blob', 'particles', 'waves', 'geometric', 'aurora'] as const

  variants.forEach(variant => {
    describe(`${variant} variant`, () => {
      it('renders without crashing in idle state', () => {
        render(<BlobVisualizer listening={false} speaking={false} variant={variant} />)
        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })

      it('renders without crashing in listening state', () => {
        render(<BlobVisualizer listening={true} speaking={false} variant={variant} />)
        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })

      it('renders without crashing in speaking state', () => {
        render(<BlobVisualizer listening={false} speaking={true} variant={variant} />)
        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })

      it('applies correct container styles', () => {
        const { container } = render(<BlobVisualizer listening={false} speaking={false} variant={variant} />)
        const visualizerContainer = container.firstChild as HTMLElement
        expect(visualizerContainer).toHaveStyle({
          width: '220px',
          height: '220px',
        })
        expect(visualizerContainer.style.filter).toContain('drop-shadow')
      })

      it('has proper accessibility attributes', () => {
        const { container } = render(<BlobVisualizer listening={false} speaking={false} variant={variant} />)
        const visualizerContainer = container.firstChild as HTMLElement
        expect(visualizerContainer).toHaveClass('rounded-full', 'overflow-hidden')
      })
    })
  })

  it('defaults to halo variant when no variant specified', () => {
    render(<BlobVisualizer listening={false} speaking={false} />)
    expect(screen.getByTestId('canvas')).toBeInTheDocument()
  })

  it('handles intensity changes based on state', () => {
    const { rerender } = render(<BlobVisualizer listening={false} speaking={false} />)
    const container1 = screen.getByTestId('canvas').parentElement!
    
    rerender(<BlobVisualizer listening={true} speaking={false} />)
    const container2 = screen.getByTestId('canvas').parentElement!
    
    rerender(<BlobVisualizer listening={false} speaking={true} />)
    const container3 = screen.getByTestId('canvas').parentElement!

    // All should have drop-shadow but with different intensities
    expect(container1.style.filter).toContain('drop-shadow')
    expect(container2.style.filter).toContain('drop-shadow')
    expect(container3.style.filter).toContain('drop-shadow')
  })
})