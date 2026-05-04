import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../Modal'

vi.mock('framer-motion', async () => {
  const React = await import('react')
  return {
    motion: {
      div: ({ children, variants: _v, initial: _i, animate: _a, exit: _e, transition: _tr, ...props }: React.HTMLAttributes<HTMLDivElement> & { variants?: unknown; initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown }) =>
        React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  }
})

vi.mock('@lib/motion', () => ({
  BACKDROP: {},
  MODAL_CONTENT: {},
  MODAL_TRANSITION: {},
}))

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => undefined} title="Test" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when open=true', () => {
    render(<Modal open={true} onClose={() => undefined} title="My Modal">Content</Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('shows title when provided', () => {
    render(<Modal open={true} onClose={() => undefined} title="Hello Modal" />)
    expect(screen.getByText('Hello Modal')).toBeInTheDocument()
  })

  it('shows description when provided', () => {
    render(
      <Modal open={true} onClose={() => undefined} title="T" description="Desc text" />
    )
    expect(screen.getByText('Desc text')).toBeInTheDocument()
  })

  it('renders close button when preventClose=false (default)', () => {
    render(<Modal open={true} onClose={() => undefined} title="T" />)
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
  })

  it('hides close button when preventClose=true', () => {
    render(<Modal open={true} onClose={() => undefined} title="T" preventClose />)
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="T" />)
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="T" />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose on Escape when preventClose=true', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="T" preventClose />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders footer slot when provided', () => {
    render(
      <Modal open={true} onClose={() => undefined} footer={<button>Submit</button>}>
        body
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('sets aria-modal="true" on dialog', () => {
    render(<Modal open={true} onClose={() => undefined} title="T" />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('sets aria-labelledby when title is provided', () => {
    render(<Modal open={true} onClose={() => undefined} title="Labelled" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
  })

  it('sets aria-describedby when description is provided', () => {
    render(
      <Modal open={true} onClose={() => undefined} title="T" description="Desc" />
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-describedby', 'modal-description')
  })

  it('locks body scroll when open, restores on close', () => {
    const { rerender } = render(<Modal open={true} onClose={() => undefined} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Modal open={false} onClose={() => undefined} />)
    expect(document.body.style.overflow).toBe('')
  })
})
