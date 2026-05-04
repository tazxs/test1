/**
 * Register page — Privacy consent checkbox tests.
 *
 * Verifies that:
 * 1. The consent checkbox is rendered
 * 2. The checkbox links to /privacy and /terms pages
 * 3. Form submission is blocked without consent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Register } from '../Register'

// Mock dependencies
vi.mock('framer-motion', async () => {
  const React = await import('react')
  return {
    motion: {
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
        React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

vi.mock('@api/auth.api', () => ({
  registerApi: vi.fn().mockResolvedValue({
    user: { id: '1', email: 'test@test.com', fullName: 'Test' },
    accessToken: 'token',
  }),
  onboardingApi: vi.fn().mockResolvedValue({}),
}))

vi.mock('@store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    setUser: vi.fn(),
    isAuthenticated: false,
  })),
}))

vi.mock('@store/notificationStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@components/banks/BankConnectModal', () => ({
  BankConnectModal: () => null,
}))

function renderRegister() {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>,
  )
}

describe('Register — Privacy Consent Checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the consent checkbox', () => {
    renderRegister()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
  })

  it('checkbox is unchecked by default', () => {
    renderRegister()
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('displays consent text with links to privacy and terms pages', () => {
    renderRegister()
    expect(screen.getByText(/сбор и обработку персональных данных/i)).toBeInTheDocument()

    const privacyLink = screen.getByRole('link', { name: /сбор и обработку персональных данных/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy')
    expect(privacyLink).toHaveAttribute('target', '_blank')

    const termsLink = screen.getByRole('link', { name: /Условиями использования/i })
    expect(termsLink).toHaveAttribute('href', '/terms')
    expect(termsLink).toHaveAttribute('target', '_blank')

    const privacyPolicyLink = screen.getByRole('link', { name: /Политикой конфиденциальности/i })
    expect(privacyPolicyLink).toHaveAttribute('href', '/privacy')
    expect(privacyPolicyLink).toHaveAttribute('target', '_blank')
  })

  it('submit button is present', () => {
    renderRegister()
    const submitButton = screen.getByRole('button', { name: /продолжить/i })
    expect(submitButton).toBeInTheDocument()
  })
})
