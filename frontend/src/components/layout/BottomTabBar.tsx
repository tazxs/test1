import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@utils/cn'
import { ROUTES } from '@lib/constants'

interface TabItem {
  labelKey: string
  href: string
  icon: React.ReactNode
  activeIcon: React.ReactNode
}

const TABS: TabItem[] = [
  {
    labelKey: 'common.nav.dashboard',
    href: ROUTES.DASHBOARD,
    icon: <DashboardIcon filled={false} />,
    activeIcon: <DashboardIcon filled />,
  },
  {
    labelKey: 'common.nav.transactions',
    href: ROUTES.TRANSACTIONS,
    icon: <TransactionIcon filled={false} />,
    activeIcon: <TransactionIcon filled />,
  },
  {
    labelKey: 'AI',
    href: ROUTES.AI_ADVISOR,
    icon: <AIIcon filled={false} />,
    activeIcon: <AIIcon filled />,
  },
  {
    labelKey: 'common.nav.billing',
    href: ROUTES.BILLING,
    icon: <BillingIcon filled={false} />,
    activeIcon: <BillingIcon filled />,
  },
  {
    labelKey: 'common.nav.settings',
    href: ROUTES.SETTINGS,
    icon: <SettingsIcon filled={false} />,
    activeIcon: <SettingsIcon filled />,
  },
]

export function BottomTabBar() {
  const { t } = useTranslation()

  return (
    <nav
      className={cn(
        'lg:hidden',
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-navy-2/95 border-t border-border',
        'flex items-stretch',
        // Safe area for iPhone notch
        'pb-safe',
        'backdrop-blur-[16px]',
      )}
      aria-label={t('common.appNavigation')}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.href}
          to={tab.href}
          className="flex-1"
        >
          {({ isActive }) => (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-150',
                isActive ? 'text-green' : 'text-white-dim',
              )}
            >
              {/* Icon with active indicator dot */}
              <div className="relative">
                <span className="w-6 h-6 block">
                  {isActive ? tab.activeIcon : tab.icon}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green"
                  />
                )}
              </div>
              <span className="max-w-full px-0.5 text-center font-body text-[10px] font-medium leading-[1.05] line-clamp-2 break-words">
                {tab.labelKey === 'AI' ? 'AI' : t(tab.labelKey)}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function DashboardIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.2} />
      <rect x="14" y="3" width="7" height="7" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.2} />
      <rect x="14" y="14" width="7" height="7" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.2} />
      <rect x="3" y="14" width="7" height="7" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.2} />
    </svg>
  )
}

function TransactionIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}


function AIIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.15} />
      <path d="M7 13h.01M12 13h.01M17 13h.01" strokeWidth={2.5} />
    </svg>
  )
}

function SettingsIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function BillingIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" fill={filled ? 'currentColor' : 'none'} fillOpacity={0.15} />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
