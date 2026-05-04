import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../Card'

vi.mock('framer-motion', async () => {
  const React = await import('react')
  return {
    motion: {
      div: ({ children, whileHover: _wh, ...props }: React.HTMLAttributes<HTMLDivElement> & { whileHover?: unknown }) =>
        React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  }
})

vi.mock('@lib/motion', () => ({
  CARD_HOVER: { whileHover: { y: -4 } },
}))

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders header slot when provided', () => {
    render(<Card header={<span>My Header</span>}>Body</Card>)
    expect(screen.getByText('My Header')).toBeInTheDocument()
  })

  it('renders footer slot when provided', () => {
    render(<Card footer={<span>My Footer</span>}>Body</Card>)
    expect(screen.getByText('My Footer')).toBeInTheDocument()
  })

  it('does not render header/footer when not provided', () => {
    render(<Card>Just body</Card>)
    expect(screen.queryByText('My Header')).not.toBeInTheDocument()
    expect(screen.queryByText('My Footer')).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Card onClick={handleClick}>Clickable</Card>)
    fireEvent.click(screen.getByText('Clickable'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('interactive variant renders with role="button" when onClick is provided', () => {
    render(
      <Card variant="interactive" onClick={() => undefined}>
        Interactive
      </Card>,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('interactive variant without onClick has no role="button"', () => {
    render(<Card variant="interactive">No click</Card>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('interactive variant handles keyboard Enter', () => {
    const handleClick = vi.fn()
    render(
      <Card variant="interactive" onClick={handleClick}>
        Interactive
      </Card>,
    )
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('interactive variant handles keyboard Space', () => {
    const handleClick = vi.fn()
    render(
      <Card variant="interactive" onClick={handleClick}>
        Interactive
      </Card>,
    )
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it.each([
    ['default', 'bg-navy-3'],
    ['elevated', 'shadow-card'],
    ['glow', 'border-glow'],
  ] as const)('variant "%s" renders with expected class', (variant, expectedClass) => {
    const { container } = render(<Card variant={variant}>Test</Card>)
    expect(container.firstChild).toHaveClass(expectedClass)
  })

  it.each([
    ['sm', 'p-4'],
    ['md', 'p-6'],
    ['lg', 'p-10'],
  ] as const)('padding "%s" applies correct class', (padding, expectedClass) => {
    const { container } = render(<Card padding={padding}>Test</Card>)
    // The padding is on the inner content div, not the root
    expect(container.querySelector(`.${expectedClass}`)).toBeInTheDocument()
  })

  it('padding="none" renders no padding class', () => {
    const { container } = render(<Card padding="none">Test</Card>)
    expect(container.querySelector('.p-4')).not.toBeInTheDocument()
    expect(container.querySelector('.p-6')).not.toBeInTheDocument()
  })
})
