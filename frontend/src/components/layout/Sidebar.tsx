import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@utils/cn'
import { LOGO_DOT_PULSE } from '@lib/motion'
import { ROUTES } from '@lib/constants'
import { LanguageSelector } from '../../i18n/LanguageSelector'
import { useAuthStore } from '@store/authStore'
import { api } from '@api/axios'

interface NavItem {
  labelKey: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  titleKey: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'common.nav.main',
    items: [
      { labelKey: 'common.nav.dashboard', href: ROUTES.DASHBOARD, icon: <DashboardIcon /> },
      { labelKey: 'common.nav.transactions', href: ROUTES.TRANSACTIONS, icon: <TransactionIcon /> },
      { labelKey: 'common.nav.analytics', href: ROUTES.ANALYTICS, icon: <AnalyticsIcon /> },
    ],
  },
  {
    titleKey: 'common.nav.taxes',
    items: [
      { labelKey: 'common.nav.declarations', href: ROUTES.DECLARATIONS, icon: <DeclarationIcon /> },
      { labelKey: 'common.nav.deadlines', href: ROUTES.DEADLINES, icon: <CalendarIcon /> },
    ],
  },
  {
    titleKey: 'AI',
    items: [
      { labelKey: 'common.nav.aiAdvisor', href: ROUTES.AI_ADVISOR, icon: <AIIcon /> },
    ],
  },
]

export interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col',
        'fixed top-0 left-0 bottom-0 z-40',
        'bg-navy-2 border-r border-border',
        'transition-all duration-250',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'h-[72px] flex items-center shrink-0 border-b border-border',
          collapsed ? 'justify-center px-0' : 'px-6'
        )}
      >
        <button
          onClick={() => navigate(ROUTES.DASHBOARD)}
          className="flex items-center gap-1 no-underline"
          aria-label="NalogAI — дашборд"
        >
          {collapsed ? (
            <motion.span
              {...LOGO_DOT_PULSE}
              className="w-2.5 h-2.5 rounded-full bg-green shadow-glow-logo"
            />
          ) : (
            <>
              <span className="font-display text-xl text-white">Nalog</span>
              <motion.span
                {...LOGO_DOT_PULSE}
                className="w-2 h-2 rounded-full bg-green shadow-glow-logo"
                style={{ marginBottom: 5 }}
              />
              <span className="font-display text-xl text-white">AI</span>
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-6" aria-label={t('common.appNavigation')}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="flex flex-col gap-1">
            {!collapsed && (
              <span className="px-4 mb-1 font-mono text-[10px] uppercase tracking-widest text-white-dim/60">
                {section.titleKey === 'AI' ? 'AI' : t(section.titleKey)}
              </span>
            )}
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Admin link (only visible to admins) */}
      {isAdmin && (
        <div className="px-2 pb-1">
          <SidebarNavItem
            item={{ labelKey: 'Admin', href: ROUTES.ADMIN, icon: <AdminIcon /> }}
            collapsed={collapsed}
          />
        </div>
      )}

      {/* Bottom settings */}
      <div className="border-t border-border py-3 flex flex-col gap-0.5">
        <div className={cn('px-2 pb-2', collapsed && 'px-3')}>
          <LanguageSelector compact={collapsed} />
        </div>
        <SidebarNavItem
          item={{ labelKey: 'common.nav.billing', href: ROUTES.BILLING, icon: <BillingIcon /> }}
          collapsed={collapsed}
        />
        <SidebarNavItem
          item={{ labelKey: 'common.nav.settings', href: ROUTES.SETTINGS, icon: <SettingsIcon /> }}
          collapsed={collapsed}
        />
        <button
          onClick={async () => {
            try { await api.post('/auth/logout') } catch { /* ignore */ }
            useAuthStore.getState().clearAuth()
            navigate(ROUTES.LOGIN)
          }}
          className={cn(
            'flex items-center gap-3 mx-2 rounded-lg transition-hover min-w-0 text-red/70 hover:text-red hover:bg-red/5',
            collapsed ? 'justify-center p-3' : 'px-4 py-2.5',
          )}
          title={collapsed ? 'Выйти' : undefined}
        >
          <span className="w-5 h-5 shrink-0"><LogoutIcon /></span>
          {!collapsed && (
            <span className="min-w-0 font-body text-sm font-medium">Выйти</span>
          )}
        </button>
      </div>
    </aside>
  )
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const { t } = useTranslation()
  const label = t(item.labelKey)

  return (
    <NavLink
      to={item.href}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 mx-2 rounded-lg transition-hover min-w-0',
          collapsed ? 'justify-center p-3' : 'px-4 py-2.5',
          isActive
            ? 'bg-green/10 text-green'
            : 'text-white-dim hover:text-white hover:bg-white-ghost'
        )
      }
    >
      <span className="w-5 h-5 shrink-0">{item.icon}</span>
      {!collapsed && (
        <span className="min-w-0 whitespace-normal break-words font-body text-sm font-medium leading-tight">{label}</span>
      )}
    </NavLink>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function DashboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function TransactionIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
function AnalyticsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function DeclarationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function AIIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><path d="M7 13h.01M12 13h.01M17 13h.01"/></svg>
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function BillingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function AdminIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
