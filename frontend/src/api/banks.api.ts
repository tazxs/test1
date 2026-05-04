import { api } from './axios'
import type { ApiSuccess } from 'nalogai-shared/types/api.types'
import type { BankProvider } from '@components/banks/BankConnectModal'

export interface ParsedStatementRow {
  date: string
  description: string
  amount: number
}

export interface BankConnectionInfo {
  id: string
  provider: BankProvider
  accountMask: string | null
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR'
  lastSyncAt: string | null
}

// ── Import statement rows (parsed client-side) ────────────────────────────────
export async function importStatementApi(
  provider: BankProvider,
  rows: ParsedStatementRow[],
): Promise<{ imported: number; skipped: number }> {
  const { data } = await api.post<ApiSuccess<{ imported: number; skipped: number }>>(
    '/banks/statement',
    { provider, rows },
  )
  return data.data
}

// ── List bank connections ─────────────────────────────────────────────────────
export async function getBankConnectionsApi(): Promise<BankConnectionInfo[]> {
  const { data } = await api.get<ApiSuccess<{ connections: BankConnectionInfo[] }>>(
    '/banks/connections',
  )
  return data.data.connections
}

// ── Disconnect a bank ─────────────────────────────────────────────────────────
export async function disconnectBankApi(provider: BankProvider): Promise<void> {
  await api.delete(`/banks/connections/${provider}`)
}

// ── Connect via merchant API (Kaspi Pay / Halyk ePay) ────────────────────────
export async function connectMerchantApi(
  provider: 'KASPI' | 'HALYK',
  merchantId: string,
  clientSecret: string,
): Promise<{ connected: boolean; merchantId: string }> {
  const endpoint = provider === 'KASPI' ? '/banks/connect/kaspi-pay' : '/banks/connect/halyk-pay'
  const { data } = await api.post<ApiSuccess<{ connected: boolean; merchantId: string }>>(
    endpoint,
    { merchantId, clientSecret },
  )
  return data.data
}

// ── Trigger manual sync ───────────────────────────────────────────────────────
export async function syncBankApi(provider: BankProvider): Promise<{ synced: number; message?: string }> {
  const { data } = await api.post<ApiSuccess<{ synced: number; message?: string }>>(
    `/banks/sync/${provider}`,
  )
  return data.data
}
