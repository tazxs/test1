/**
 * Banking integration types.
 * Bank tokens are NEVER returned in API responses — only connection metadata.
 */

export type BankProvider = 'KASPI' | 'HALYK' | 'FORTE' | 'OTHER'

export type BankConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR'

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED'

export interface BankConnection {
  id: string
  userId: string
  provider: BankProvider
  accountMask: string | null  // e.g. "****1234"
  status: BankConnectionStatus
  lastSyncAt: string | null
  syncStatus: SyncStatus
  syncError: string | null
  createdAt: string
  updatedAt: string
}

export interface BankSyncResult {
  connectionId: string
  transactionsImported: number
  transactionsSkipped: number
  syncedAt: string
  errors: string[]
}

export interface ConnectBankPayload {
  provider: BankProvider
  authCode: string  // From OAuth redirect
}

export interface BankOAuthInitResponse {
  authUrl: string
  state: string
}

export interface BankProviderInfo {
  id: BankProvider
  name: string
  logoUrl: string
  available: boolean
}
