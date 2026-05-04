import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@utils/cn'
import { Button } from '@components/ui/Button'
import { LOGO_DOT_PULSE, MOBILE_MENU, MOBILE_MENU_ITEM, STAGGER_CONTAINER } from '@lib/motion'
import { ROUTES } from '@lib/constants'

const NAV_LINKS = [
  { label: 'Как работает', href: '#how-it-works' },
  { label: 'Возможности', href: '#features' },
  { label: 'Тарифы', href: '#pricing' },
  { label: 'Блог', href: '/blog' },
] as const

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogin = () => { setMenuOpen(false); navigate(ROUTES.LOGIN) }
  const handleRegister = () => { setMenuOpen(false); navigate(ROUTES.REGISTER) }

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] h-[72px]',
        'flex items-center',
        'px-5 md:px-15',
        'bg-navy/85 border-b border-border',
        'backdrop-blur-navbar'
      )}
    >
      <div className="w-full max-w-container mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-1.5 no-underline"
          aria-label="NalogAI — на главную"
        >
          <span className="font-display text-[22px] text-white leading-none">
            Nalog
          </span>
          <motion.span
            {...LOGO_DOT_PULSE}
            className="w-2 h-2 rounded-full bg-green shadow-glow-logo inline-block"
            style={{ marginBottom: 6 }}
          />
          <span className="font-display text-[22px] text-white leading-none">
            AI
          </span>
        </Link>

        {/* Center nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Основная навигация">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'font-body font-medium text-sm text-white-dim',
                'hover:text-white transition-color'
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right actions — hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleLogin}>
            Войти
          </Button>
          <Button variant="primary" size="sm" onClick={handleRegister}>
            Попробовать бесплатно
          </Button>
        </div>

        {/* Hamburger — visible on mobile */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1 text-white"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
        >
          <motion.span
            animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-white rounded-full"
          />
          <motion.span
            animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-white rounded-full"
          />
          <motion.span
            animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-white rounded-full"
          />
        </button>
      </div>

      {/* Mobile overlay menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            variants={MOBILE_MENU}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed inset-0 z-[99] flex flex-col items-center justify-center',
              'bg-navy/98'
            )}
          >
            {/* Close button */}
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-white-dim hover:text-white transition-color"
              aria-label="Закрыть меню"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Nav links */}
            <motion.nav
              variants={STAGGER_CONTAINER}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center gap-6 mb-10"
            >
              {NAV_LINKS.map((link) => (
                <motion.a
                  key={link.label}
                  variants={MOBILE_MENU_ITEM}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-display text-[32px] text-white hover:text-green transition-color"
                >
                  {link.label}
                </motion.a>
              ))}
            </motion.nav>

            {/* Buttons */}
            <motion.div
              variants={MOBILE_MENU_ITEM}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex flex-col gap-3 w-64"
            >
              <Button variant="secondary" size="lg" fullWidth onClick={handleLogin}>
                Войти
              </Button>
              <Button variant="primary" size="lg" fullWidth onClick={handleRegister}>
                Попробовать бесплатно
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
