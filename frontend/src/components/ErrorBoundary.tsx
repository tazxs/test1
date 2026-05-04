import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { Sentry } from '@lib/sentry'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  errorId: string | null
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    errorId: null,
    hasError: false,
  }

  static getDerivedStateFromError(): Pick<ErrorBoundaryState, 'hasError'> {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = Sentry.withScope((scope) => {
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      })

      return Sentry.captureException(error)
    })

    this.setState({ errorId })
  }

  private reloadPage = () => {
    window.location.reload()
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-dvh bg-navy flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-lg rounded-lg border border-border bg-navy-4 p-6 text-center shadow-xl shadow-black/20">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-red/30 bg-red/10 text-xl text-red">
            !
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="mt-3 font-body text-sm leading-6 text-white-dim">
            Что-то пошло не так. Мы уже получили технические детали и проверим проблему.
          </p>
          {this.state.errorId ? (
            <p className="mt-4 font-mono text-xs text-white-dim">
              Код ошибки: {this.state.errorId}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.reloadPage}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-green px-5 font-body text-sm font-semibold text-navy transition-colors hover:bg-green-dim focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 focus:ring-offset-navy"
          >
            Обновить страницу
          </button>
        </section>
      </main>
    )
  }
}
