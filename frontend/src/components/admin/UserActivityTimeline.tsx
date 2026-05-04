/**
 * UserActivityTimeline — Zero-Trust Non-Repudiation Audit Timeline
 *
 * Displays a chronological, unalterable ledger of a user's actions.
 * Every entry shows absolute timestamps (never relative), IP address badges,
 * device type indicators, and highlighted KZT amounts in monospace font.
 *
 * Dark theme: navy-3 card backgrounds, rgba(240,244,255,0.1) connecting lines.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getUserLogs, type AuditLogEntry } from '@api/admin.api'
import { cn } from '@utils/cn'

// ── Action Category Config ────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FINANCIAL: { label: 'Финансовый', color: 'text-green', bg: 'bg-green/10' },
  SECURITY:  { label: 'Безопасность', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SYSTEM:    { label: 'Система', color: 'text-blue-400', bg: 'bg-blue-400/10' },
}

// ── Action Labels (Russian) ───────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTER: 'Регистрация',
  USER_LOGIN: 'Вход в систему',
  USER_LOGOUT: 'Выход из системы',
  ONBOARDING_COMPLETE: 'Онбординг завершён',
  PAYMENT_INITIATED: 'Платёж инициирован',
  PAYMENT_SUCCESS: 'Платёж успешен',
  PAYMENT_FAILED: 'Платёж не удался',
  PAYMENT_WEBHOOK_RECEIVED: 'Webhook получен',
  PAYMENT_WEBHOOK_DUPLICATE_BLOCKED: 'Дубль webhook заблокирован',
  SUBSCRIPTION_CANCELED: 'Подписка отменена',
  DECLARATION_CREATED: 'Декларация создана',
  DECLARATION_SUBMITTED: 'Декларация отправлена',
  DECLARATION_PDF_GENERATED: 'PDF декларации сгенерирован',
  TRANSACTION_CREATED: 'Транзакция создана',
  TRANSACTION_UPDATED: 'Транзакция обновлена',
  TRANSACTION_DELETED: 'Транзакция удалена',
  ADMIN_SUBSCRIPTION_OVERRIDE: 'Переопределение подписки',
  ADMIN_UNMASK_IIN: 'Раскрытие ИИН',
  ADMIN_VIEW_USER_DETAIL: 'Просмотр профиля',
  ADMIN_VIEW_USER_LOGS: 'Просмотр логов',
}

// ── Device Detection ──────────────────────────────────────────────────────────

function detectDevice(userAgent: string | null): { icon: string; label: string } {
  if (!userAgent || userAgent === 'NalogAI-Internal/1.0' || userAgent === 'SYSTEM') {
    return { icon: '🤖', label: 'Система' }
  }
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return { icon: '📱', label: 'Мобильный' }
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return { icon: '📱', label: 'Планшет' }
  }
  return { icon: '🖥️', label: 'Десктоп' }
}

// ── Timestamp Formatting ──────────────────────────────────────────────────────
// Always absolute time: dd.MM.yyyy HH:mm:ss — NEVER relative time for audit logs.

function formatAbsoluteTime(isoString: string): string {
  const date = new Date(isoString)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`
}

// ── KZT Amount Extraction & Formatting ────────────────────────────────────────

function extractAmount(details: Record<string, unknown> | null): number | null {
  if (!details) return null
  if (typeof details.amount === 'number') return details.amount
  if (typeof details.amount === 'string') return parseFloat(details.amount)
  return null
}

function formatKZT(amount: number): string {
  return amount.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₸'
}

// ── Summary Extraction ────────────────────────────────────────────────────────

function getSummary(log: AuditLogEntry): string {
  if (log.details && typeof log.details === 'object' && typeof log.details.summary === 'string') {
    return log.details.summary
  }
  return ACTION_LABELS[log.action] ?? log.action
}

// ── Timeline Entry Component ──────────────────────────────────────────────────

function TimelineEntry({ log, index }: { log: AuditLogEntry; index: number }) {
  const category = CATEGORY_CONFIG[log.actionCategory] ?? CATEGORY_CONFIG.SYSTEM
  const device = detectDevice(log.userAgent)
  const amount = extractAmount(log.details)
  const summary = getSummary(log)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="relative flex gap-4"
    >
      {/* Timeline connector line */}
      {index > 0 && (
        <div
          className="absolute left-[15px] -top-4 w-px h-4"
          style={{ backgroundColor: 'rgba(240,244,255,0.1)' }}
        />
      )}

      {/* Timeline dot */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div
          className={cn(
            'w-[30px] h-[30px] rounded-full flex items-center justify-center text-[13px] border',
            log.actionCategory === 'FINANCIAL'
              ? 'bg-green/10 border-green/30 text-green'
              : log.actionCategory === 'SECURITY'
                ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
                : 'bg-blue-400/10 border-blue-400/30 text-blue-400',
          )}
        >
          {log.actionCategory === 'FINANCIAL' ? '₸' : log.actionCategory === 'SECURITY' ? '🔒' : '⚙️'}
        </div>
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-xl border p-4 mb-3"
        style={{
          backgroundColor: 'rgba(15,20,35,0.8)',
          borderColor: 'rgba(240,244,255,0.1)',
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action label */}
            <span className="font-body text-sm font-semibold text-white">
              {ACTION_LABELS[log.action] ?? log.action}
            </span>
            {/* Category badge */}
            <span
              className={cn(
                'inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
                category.bg,
                category.color,
              )}
            >
              {category.label}
            </span>
          </div>

          {/* Absolute timestamp */}
          <span className="font-mono text-[11px] text-white-dim/60 whitespace-nowrap flex-shrink-0">
            {formatAbsoluteTime(log.createdAt)}
          </span>
        </div>

        {/* Summary / Financial payload */}
        <p className="font-body text-[13px] text-white-dim leading-relaxed mb-2">
          {summary}
        </p>

        {/* KZT Amount highlight */}
        {amount !== null && (
          <div className="mb-2">
            <span className="font-mono text-lg font-bold text-green tracking-tight">
              {formatKZT(amount)}
            </span>
          </div>
        )}

        {/* Network identity badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* IP Address badge */}
          {log.ipAddress && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white-dim/10 bg-white-ghost/30 px-2 py-0.5">
              <span className="text-[11px]">🌐</span>
              <span className="font-mono text-[11px] text-white-dim/70">{log.ipAddress}</span>
            </span>
          )}

          {/* Device badge */}
          {log.userAgent && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white-dim/10 bg-white-ghost/30 px-2 py-0.5">
              <span className="text-[11px]">{device.icon}</span>
              <span className="font-mono text-[11px] text-white-dim/70">{device.label}</span>
            </span>
          )}

          {/* Actor info */}
          {log.actor && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white-dim/10 bg-white-ghost/30 px-2 py-0.5">
              <span className="text-[11px]">👤</span>
              <span className="font-mono text-[11px] text-white-dim/70">
                {log.actor.fullName || log.actor.email}
              </span>
            </span>
          )}
        </div>

        {/* Expandable raw details (collapsed by default) */}
        {log.details && Object.keys(log.details).length > 0 && (
          <details className="mt-2">
            <summary className="font-mono text-[10px] text-white-dim/40 cursor-pointer hover:text-white-dim/60 transition-colors select-none">
              RAW DATA
            </summary>
            <pre className="mt-1 rounded-lg bg-navy p-3 font-mono text-[10px] text-white-dim/50 overflow-x-auto max-h-40 overflow-y-auto">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Timeline Component ───────────────────────────────────────────────────

interface UserActivityTimelineProps {
  userId: string
  limit?: number
}

export function UserActivityTimeline({ userId, limit = 100 }: UserActivityTimelineProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUserLogs(userId, limit, categoryFilter || undefined)
      setLogs(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs'
      setError(message)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [userId, limit, categoryFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div>
      {/* Header with filter */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-lg text-white flex items-center gap-2">
          <span className="text-green">🛡️</span>
          Хронология действий
        </h2>

        {/* Action Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-navy-3 px-3 py-2 font-mono text-[11px] text-white-dim focus:border-green focus:outline-none focus:ring-1 focus:ring-green/30"
        >
          <option value="">Все категории</option>
          <option value="FINANCIAL">₸ Финансовые</option>
          <option value="SECURITY">🔒 Безопасность</option>
          <option value="SYSTEM">⚙️ Системные</option>
        </select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-green/20 border-t-green rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red/20 bg-red/5 p-4 mb-4">
          <p className="font-body text-sm text-red">{error}</p>
          <button
            onClick={fetchLogs}
            className="mt-2 rounded-md border border-red/30 bg-red/10 px-3 py-1 font-mono text-[11px] text-red hover:bg-red/20 transition-colors"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <div className="rounded-xl border border-border bg-navy-2 p-8 text-center">
          <p className="font-body text-sm text-white-dim">
            {categoryFilter
              ? `Нет действий в категории "${CATEGORY_CONFIG[categoryFilter]?.label ?? categoryFilter}"`
              : 'Нет записей аудита для этого пользователя'}
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && logs.length > 0 && (
        <div className="relative">
          {/* Vertical connecting line */}
          <div
            className="absolute left-[15px] top-[15px] bottom-[15px] w-px"
            style={{ backgroundColor: 'rgba(240,244,255,0.1)' }}
          />

          {logs.map((log, index) => (
            <TimelineEntry key={log.id} log={log} index={index} />
          ))}

          {/* Footer */}
          <div className="text-center pt-2">
            <p className="font-mono text-[10px] text-white-dim/30">
              Показано {logs.length} записей • Все временные метки в UTC
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
