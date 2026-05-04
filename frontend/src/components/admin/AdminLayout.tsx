import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '@utils/cn'
import { ROUTES } from '@lib/constants'

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin', icon: <DashboardIcon /> },
  { label: 'Users', href: '/admin/users', icon: <UsersIcon /> },
  { label: 'Support', href: '/admin/support', icon: <SupportIcon /> },
  { label: 'Audit Trail', href: '/admin/support', icon: <AuditIcon /> },
]

export function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-navy flex">
      {/* Admin Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 w-56 bg-navy-2 border-r border-border">
        {/* Logo */}
        <div className="h-[72px] flex items-center shrink-0 border-b border-border px-4">
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex items-center gap-2 no-underline"
            aria-label="Back to app"
          >
            <span className="w-2 h-2 rounded-full bg-red shadow-glow-logo" />
            <span className="font-display text-lg text-white">Admin</span>
            <span className="font-display text-lg text-white-dim">Panel</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1" aria-label="Admin navigation">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 mx-2 px-4 py-2.5 rounded-lg transition-hover min-w-0',
                  isActive
                    ? 'bg-red/10 text-red'
                    : 'text-white-dim hover:text-white hover:bg-white-ghost',
                )
              }
            >
              <span className="w-5 h-5 shrink-0">{item.icon}</span>
              <span className="min-w-0 font-body text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Back to app */}
        <div className="border-t border-border py-3">
          <NavLink
            to={ROUTES.DASHBOARD}
            className="flex items-center gap-3 mx-2 px-4 py-2.5 rounded-lg text-white-dim hover:text-white hover:bg-white-ghost transition-hover"
          >
            <span className="w-5 h-5 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </span>
            <span className="font-body text-sm font-medium">Back to App</span>
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:pl-56">
        <div className="w-full max-w-[1400px] mx-auto px-5 md:px-10 py-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function AuditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}
