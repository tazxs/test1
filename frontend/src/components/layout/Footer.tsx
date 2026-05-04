import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { LOGO_DOT_PULSE } from '@lib/motion'
import { ROUTES } from '@lib/constants'

const FOOTER_COLUMNS = [
  {
    title: 'Продукт',
    links: [
      { label: 'Возможности', href: '#features' },
      { label: 'Тарифы', href: ROUTES.PRICING },
      { label: 'AI Советник', href: ROUTES.AI_ADVISOR },
      { label: 'Интеграции с банками', href: '#integrations' },
    ],
  },
  {
    title: 'Ресурсы',
    links: [
      { label: 'Блог', href: '/blog' },
      { label: 'Справочник НК РК', href: '/tax-guide' },
      { label: 'Калькулятор ЕСП', href: '/calculator' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'О нас', href: '/about' },
      { label: 'Контакты', href: '/contact' },
      { label: 'Политика конфиденциальности', href: '/privacy' },
      { label: 'Пользовательское соглашение', href: '/terms' },
    ],
  },
] as const

export function Footer() {
  return (
    <footer className="bg-navy-2 border-t border-border">
      <div className="max-w-container mx-auto px-5 py-12 md:px-15 md:py-20">
        {/* Main grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="flex flex-col gap-5">
            <Link to={ROUTES.HOME} className="inline-flex items-center gap-1 no-underline">
              <span className="font-display text-xl text-white">Nalog</span>
              <motion.span
                {...LOGO_DOT_PULSE}
                className="w-2 h-2 rounded-full bg-green shadow-glow-logo"
                style={{ marginBottom: 4 }}
              />
              <span className="font-display text-xl text-white">AI</span>
            </Link>
            <p className="font-body text-sm text-white-dim leading-relaxed max-w-[220px]">
              AI-ассистент по налогам для самозанятых и ИП в Казахстане и СНГ.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <a
                href="https://t.me/nalogai"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-lg',
                  'bg-white-ghost border border-border',
                  'text-white-dim hover:text-white hover:border-white/20 transition-hover'
                )}
                aria-label="Telegram"
              >
                <TelegramIcon />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h4 className="font-body text-sm font-semibold text-white">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className={cn(
                        'font-body text-sm text-white-dim',
                        'hover:text-white transition-color'
                      )}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className={cn(
          'mt-15 pt-8 border-t border-border',
          'flex flex-col items-start gap-3',
          'md:flex-row md:items-center md:justify-between'
        )}>
          <p className="font-body text-xs text-white-dim">
            © {new Date().getFullYear()} NalogAI. Все права защищены. Не является
            юридической консультацией.
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white-dim/50">Казахстан, Алматы</span>
            <span className="text-white-dim/30">·</span>
            <span className="font-mono text-xs text-green">🇰🇿</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
  )
}
