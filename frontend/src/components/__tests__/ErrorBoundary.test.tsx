import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => 'event-id'),
  setContext: vi.fn(),
}))

vi.mock('@lib/sentry', () => ({
  Sentry: {
    captureException: sentryMocks.captureException,
    withScope: (callback: (scope: { setContext: typeof sentryMocks.setContext }) => string) =>
      callback({ setContext: sentryMocks.setContext }),
  },
}))

function BrokenComponent(): JSX.Element {
  throw new Error('render exploded')
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
    sentryMocks.captureException.mockClear()
    sentryMocks.setContext.mockClear()
  })

  it('shows a crash fallback and reports the exception to Sentry', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText(/Что-то пошло не так/i)).toBeInTheDocument()
    expect(screen.getByText(/Код ошибки: event-id/i)).toBeInTheDocument()
    expect(sentryMocks.captureException).toHaveBeenCalledOnce()
    expect(sentryMocks.setContext).toHaveBeenCalledWith('react', expect.any(Object))
  })
})
