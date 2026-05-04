import { prisma } from '@utils/prisma'
import type { BankProvider, TransactionSource, TransactionType, TransactionCategory } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { logger } from '@utils/logger'
import { encrypt, decrypt } from '@utils/crypto'
import { kaspiPayService } from './KaspiPayService'
import { halykPayService } from './HalykPayService'

export interface StatementRow {
  date: string         // YYYY-MM-DD
  description: string
  amount: number       // positive = income, negative = expense
}

export interface ImportResult {
  imported: number
  skipped: number
}

export const BankService = {
  /**
   * Import pre-parsed statement rows for a user.
   * Rows are deduped by (userId, source, externalId) where externalId = `${date}|${description}|${amount}`.
   */
  async importStatement(
    userId: string,
    provider: BankProvider,
    rows: StatementRow[],
  ): Promise<ImportResult> {
    const source = provider as unknown as TransactionSource
    let imported = 0
    let skipped  = 0

    for (const row of rows) {
      const type: TransactionType = row.amount >= 0 ? 'INCOME' : 'EXPENSE'
      const amount = Math.abs(row.amount)
      const externalId = `${row.date}|${row.description.slice(0, 60)}|${amount}`

      try {
        await prisma.transaction.upsert({
          where: { userId_externalId: { userId, externalId } },
          create: {
            userId,
            amount,
            type,
            category: 'UNCATEGORIZED' as TransactionCategory,
            description: row.description,
            source,
            externalId,
            date: new Date(row.date),
          },
          update: {}, // no-op on conflict — skip duplicates
        })
        imported++
      } catch (err) {
        // P2002 = unique constraint violation → duplicate row, skip silently
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          skipped++
          continue
        }
        // Any other error (DB unreachable, schema mismatch, etc.) — fail fast
        logger.error('BankService.importStatement: fatal row error', { externalId, err })
        throw err
      }
    }

    // Update or create BankConnection record
    await prisma.bankConnection.upsert({
      where:  { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        accountMask: `**** ${String(Math.floor(1000 + Math.random() * 9000))}`,
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        syncStatus: 'SUCCESS',
      },
      update: {
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        syncStatus: 'SUCCESS',
        syncError: null,
      },
    })

    logger.info('BankService.importStatement: done', { userId, provider, imported, skipped })
    return { imported, skipped }
  },

  /** List all active bank connections for a user. */
  async getConnections(userId: string) {
    return prisma.bankConnection.findMany({
      where:   { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        provider: true,
        accountMask: true,
        status: true,
        lastSyncAt: true,
        syncStatus: true,
      },
    })
  },

  /** Revoke a bank connection. */
  async disconnect(userId: string, provider: BankProvider) {
    await prisma.bankConnection.updateMany({
      where:  { userId, provider },
      data:   { status: 'REVOKED', updatedAt: new Date() },
    })
  },

  /**
   * Save or update merchant API credentials for a bank connection.
   * accessToken  = the OAuth bearer token (refreshed on sync)
   * refreshToken = the client secret (used to re-authenticate)
   * accountMask  = merchant ID (displayed in UI)
   */
  async saveApiCredentials(
    userId: string,
    provider: BankProvider,
    merchantId: string,
    clientSecret: string,
    bearerToken: string,
    tokenExpiresAt: Date,
  ): Promise<void> {
    const encryptedToken = encrypt(bearerToken)
    const encryptedSecret = encrypt(clientSecret)

    await prisma.bankConnection.upsert({
      where:  { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        accountMask:    merchantId,
        accessToken:    encryptedToken,
        refreshToken:   encryptedSecret,
        tokenExpiresAt,
        status:         'ACTIVE',
        syncStatus:     'SUCCESS',
        lastSyncAt:     new Date(),
      },
      update: {
        accountMask:    merchantId,
        accessToken:    encryptedToken,
        refreshToken:   encryptedSecret,
        tokenExpiresAt,
        status:         'ACTIVE',
        syncStatus:     'SUCCESS',
        lastSyncAt:     new Date(),
        syncError:      null,
      },
    })
  },

  /**
   * Sync transactions for an existing API-connected bank.
   * Uses stored credentials; re-authenticates if token expired.
   */
  async syncApiConnection(userId: string, provider: BankProvider): Promise<ImportResult> {
    const conn = await prisma.bankConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    })
    if (!conn || !conn.refreshToken || !conn.accountMask) {
      throw new Error('No API credentials stored for this provider. Connect via merchant API first.')
    }

    // Decrypt stored credentials
    const decryptedSecret = decrypt(conn.refreshToken)

    // Determine sync window: from last sync (or 90 days ago), to now
    const since = conn.lastSyncAt
      ? new Date(conn.lastSyncAt.getTime() - 24 * 60 * 60 * 1000) // 1-day overlap to catch near-boundary txs
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)           // default: 90 days

    await prisma.bankConnection.update({
      where: { userId_provider: { userId, provider } },
      data:  { syncStatus: 'SYNCING' },
    })

    try {
      let syncResult: { rows: Array<{ date: string; description: string; amount: number }>; token: string; expiresAt: Date }

      if (provider === 'KASPI') {
        syncResult = await kaspiPayService.syncTransactions(conn.accountMask, decryptedSecret, since)
      } else if (provider === 'HALYK') {
        syncResult = await halykPayService.syncTransactions(conn.accountMask, decryptedSecret, since)
      } else {
        throw new Error(`API sync not supported for provider: ${provider}`)
      }

      // Persist refreshed token (encrypted)
      await prisma.bankConnection.update({
        where: { userId_provider: { userId, provider } },
        data: {
          accessToken:    encrypt(syncResult.token),
          tokenExpiresAt: syncResult.expiresAt,
          syncStatus:     'SYNCING', // still syncing — importing now
        },
      })

      const result = await BankService.importStatement(userId, provider, syncResult.rows)

      await prisma.bankConnection.update({
        where: { userId_provider: { userId, provider } },
        data: { syncStatus: 'SUCCESS', lastSyncAt: new Date(), syncError: null },
      })

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      logger.error('BankService.syncApiConnection: failed', { userId, provider, err })
      await prisma.bankConnection.update({
        where: { userId_provider: { userId, provider } },
        data: { syncStatus: 'FAILED', status: 'ERROR', syncError: msg },
      }).catch(() => undefined)
      throw err
    }
  },
}
