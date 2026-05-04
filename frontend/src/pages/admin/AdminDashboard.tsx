import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getAdminStats, type AdminStats } from '@api/admin.api'
import { cn } from '@utils/cn'

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red/20 bg-red/5 p-6 text-red">
        Error loading stats: {error}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-white' },
    { label: 'PRO Users', value: stats.proUsers, color: 'text-green' },
    { label: 'PRO AI Users', value: stats.proAiUsers, color: 'text-blue-400' },
    { label: 'Free Users', value: stats.freeUsers, color: 'text-white-dim' },
    { label: 'MRR (₸)', value: stats.mrr, color: 'text-green', format: (n: number) => n.toLocaleString('ru-RU') + ' ₸' },
    { label: 'Form 910 Count', value: stats.form910Count, color: 'text-yellow-400' },
    { label: 'New Users (This Month)', value: stats.newUsersThisMonth, color: 'text-cyan-400' },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl text-white mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-navy-2 p-5"
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-white-dim/60 mb-2">
              {card.label}
            </p>
            <p className={cn('font-display text-3xl', card.color)}>
              {card.format ? card.format(card.value) : card.value.toLocaleString('ru-RU')}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
