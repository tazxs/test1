import { api } from './axios'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string
  email: string
  fullName: string
  iin: string | null // masked by default
  plan: string
  role: string
  businessType: string
  taxRegime: string
  createdAt: string
  updatedAt: string
  declarationCount: number
  transactionCount: number
}

export interface AdminUserDetail extends AdminUser {
  declarations: Array<{
    id: string
    period: string
    periodType: string
    formType: string
    status: string
    createdAt: string
    submittedAt: string | null
  }>
  transactions: Array<{
    id: string
    amount: number
    type: string
    category: string
    description: string
    date: string
  }>
  bankConnections: Array<{
    id: string
    provider: string
    status: string
    lastSyncAt: string | null
    syncStatus: string
  }>
}

export interface AdminStats {
  totalUsers: number
  proUsers: number
  proAiUsers: number
  freeUsers: number
  mrr: number
  form910Count: number
  newUsersThisMonth: number
}

export interface AuditLogEntry {
  id: string
  actorId: string
  targetId: string | null
  action: string
  details: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  actionCategory: string
  createdAt: string
  actor: {
    id: string
    email: string
    fullName: string
  }
}

// ── API Calls ─────────────────────────────────────────────────────────────────
export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<{ data: AdminStats }>('/admin/stats')
  return data.data
}

export async function getAdminUsers(params: {
  page?: number
  limit?: number
  search?: string
  plan?: string
}): Promise<{ items: AdminUser[]; meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }> {
  const { data } = await api.get<{ data: AdminUser[]; meta?: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }>('/admin/users', { params })
  const fallbackMeta = { page: 1, limit: 25, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }
  return { items: Array.isArray(data.data) ? data.data : [], meta: data.meta ?? fallbackMeta }
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data } = await api.get<{ data: AdminUserDetail }>(`/admin/users/${userId}`)
  return data.data
}

export async function overrideSubscription(userId: string, plan: string): Promise<{ id: string; email: string; plan: string }> {
  const { data } = await api.patch<{ data: { id: string; email: string; plan: string } }>(`/admin/users/${userId}/subscription`, { plan })
  return data.data
}

export async function unmaskIIN(userId: string): Promise<{ iin: string | null }> {
  const { data } = await api.post<{ data: { iin: string | null } }>(`/admin/users/${userId}/unmask-iin`)
  return data.data
}

export async function getUserLogs(userId: string, limit?: number, actionCategory?: string): Promise<AuditLogEntry[]> {
  const { data } = await api.get<{ data: AuditLogEntry[] }>(`/admin/logs/${userId}`, {
    params: { limit, ...(actionCategory ? { actionCategory } : {}) },
  })
  return data.data
}

export interface UserFinances {
  transactions: Array<{
    id: string
    amount: number
    type: string
    category: string
    description: string
    date: string
    source: string
  }>
  summary: {
    totalIncome: number
    totalExpense: number
    netIncome: number
  }
  form910Progress: {
    threshold: number
    currentIncome: number
    remaining: number
    percent: number
    exceedsThreshold: boolean
  }
  taxObligations: {
    ipn: number
    socialTax: number
    pensionContribution: number
    medicalInsurance: number
    totalTaxBurden: number
  }
}

export async function getUserFinances(userId: string): Promise<UserFinances> {
  const { data } = await api.get<{ data: UserFinances }>(`/admin/users/${userId}/finances`)
  return data.data
}
