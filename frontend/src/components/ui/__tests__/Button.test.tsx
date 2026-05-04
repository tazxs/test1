import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

// framer-motion uses browser APIs not available in jsdom
vi.mock('framer-motion', async () => {
  const React = await import('react')
  return {
    motion: {
      button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown; transition?: unknown }>(
        ({ children, whileHover: _wh, whileTap: _wt, transition: _tr, ...props }, ref) =>
          React.createElement('button', { ...props, ref }, children)
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  }
})

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Press</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when loading is true', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows spinner instead of leftIcon when loading', () => {
    render(<Button loading leftIcon={<span data-testid="icon" />}>Save</Button>)
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
    // Spinner is an svg with animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not show spinner when not loading', () => {
    render(<Button leftIcon={<span data-testid="icon" />}>Save</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('applies fullWidth class', () => {
    render(<Button fullWidth>Full</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('does not render rightIcon when loading', () => {
    render(<Button loading rightIcon={<span data-testid="right" />}>Save</Button>)
    expect(screen.queryByTestId('right')).not.toBeInTheDocument()
  })

  it('renders rightIcon when not loading', () => {
    render(<Button rightIcon={<span data-testid="right" />}>Save</Button>)
    expect(screen.getByTestId('right')).toBeInTheDocument()
  })

  it.each([
    ['primary', 'bg-green'],
    ['secondary', 'border-border'],
    ['ghost', 'bg-transparent'],
    ['danger', 'bg-red/10'],
  ] as const)('variant "%s" renders with expected class', (variant, expectedClass) => {
    render(<Button variant={variant}>Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass(expectedClass)
  })

  it.each([
    ['sm', 'h-8'],
    ['md', 'h-10'],
    ['lg', 'h-12'],
  ] as const)('size "%s" renders with expected height class', (size, expectedClass) => {
    render(<Button size={size}>Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass(expectedClass)
  })
})
