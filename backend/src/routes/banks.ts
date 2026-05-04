import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess } from '@utils/response'
import { NotFoundError, InternalError } from '@utils/errors'
import { BankService } from '@services/BankService'
import { kaspiPayService } from '@services/KaspiPayService'
import { halykPayService } from '@services/HalykPayService'
import { asyncHandler } from '@utils/asyncHandler'
import type { BankProvider } from '@prisma/client'

export const banksRouter = Router()

banksRouter.use(requireAuth)

// ── Schema ─────────────────────────────────────────────────────────────────────
const StatementRowSchema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1).max(500),
  amount:      z.number(),  // positive = income, negative = expense
})

const ImportStatementSchema = z.object({
  provider: z.enum(['KASPI', 'HALYK', 'OTHER']),
  rows:     z.array(StatementRowSchema).min(1).max(2000),
})

const ConnectMerchantSchema = z.object({
  merchantId:   z.string().min(1).max(200).trim(),
  clientSecret: z.string().min(1).max(500).trim(),
})

// ── POST /api/banks/statement ─────────────────────────────────────────────────
banksRouter.post(
  '/statement',
  validate(ImportStatementSchema),
  asyncHandler(async (req, res) => {
    const { provider, rows } = req.body as z.infer<typeof ImportStatementSchema>
    const result = await BankService.importStatement(
      req.user!.sub,
      provider as BankProvider,
      rows,
    )
    sendSuccess(res, result)
  }),
)

// ── POST /api/banks/connect/kaspi-pay ─────────────────────────────────────────
// Save Kaspi Pay merchant credentials + verify by doing initial auth + sync.
banksRouter.post(
  '/connect/kaspi-pay',
  validate(ConnectMerchantSchema),
  asyncHandler(async (req, res) => {
    const { merchantId, clientSecret } = req.body as z.infer<typeof ConnectMerchantSchema>
    const userId = req.user!.sub

    // Verify credentials by authenticating
    const { token, expiresAt } = await kaspiPayService.getAccessToken(merchantId, clientSecret)

    await BankService.saveApiCredentials(userId, 'KASPI', merchantId, clientSecret, token, expiresAt)

    // Do initial sync for last 90 days in background (don't await — fast response)
    BankService.syncApiConnection(userId, 'KASPI').catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      // Logged inside syncApiConnection; non-fatal for the connect response
      void msg
    })

    sendSuccess(res, { connected: true, merchantId })
  }),
)

// ── POST /api/banks/connect/halyk-pay ─────────────────────────────────────────
banksRouter.post(
  '/connect/halyk-pay',
  validate(ConnectMerchantSchema),
  asyncHandler(async (req, res) => {
    const { merchantId, clientSecret } = req.body as z.infer<typeof ConnectMerchantSchema>
    const userId = req.user!.sub

    const { token, expiresAt } = await halykPayService.getAccessToken(merchantId, clientSecret)

    await BankService.saveApiCredentials(userId, 'HALYK', merchantId, clientSecret, token, expiresAt)

    BankService.syncApiConnection(userId, 'HALYK').catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      void msg
    })

    sendSuccess(res, { connected: true, merchantId })
  }),
)

// ── GET /api/banks/connections ────────────────────────────────────────────────
banksRouter.get(
  '/connections',
  asyncHandler(async (req, res) => {
    const connections = await BankService.getConnections(req.user!.sub)
    sendSuccess(res, { connections })
  }),
)

// ── DELETE /api/banks/connections/:provider ───────────────────────────────────
banksRouter.delete(
  '/connections/:provider',
  asyncHandler(async (req, res) => {
    const provider = req.params.provider?.toUpperCase() as BankProvider
    if (!['KASPI', 'HALYK', 'OTHER'].includes(provider)) {
      throw new NotFoundError('Unknown bank provider')
    }
    await BankService.disconnect(req.user!.sub, provider)
    sendSuccess(res, { ok: true })
  }),
)

// ── POST /api/banks/sync/:provider ────────────────────────────────────────────
// For API-connected banks (KASPI / HALYK): triggers a real sync using stored credentials.
// For PDF-imported banks: returns info message.
banksRouter.post(
  '/sync/:provider',
  asyncHandler(async (req, res) => {
    const provider = req.params.provider?.toUpperCase() as BankProvider
    if (!['KASPI', 'HALYK', 'OTHER'].includes(provider)) {
      throw new NotFoundError('Unknown bank provider')
    }

    const userId = req.user!.sub
    const connections = await BankService.getConnections(userId)
    const conn = connections.find((c) => c.provider === provider)

    if (!conn) {
      throw new NotFoundError('Bank not connected.')
    }

    // Check if this is an API connection (has merchantId stored in accountMask)
    // We detect API connections by checking BankConnection.refreshToken existence
    if (provider === 'KASPI' || provider === 'HALYK') {
      try {
        const result = await BankService.syncApiConnection(userId, provider)
        sendSuccess(res, { synced: result.imported, skipped: result.skipped })
        return
      } catch (err) {
        if (err instanceof InternalError) throw err
        // Fallback message if no API credentials (PDF-only connection)
        sendSuccess(res, {
          synced: 0,
          message: 'Подключите банк через API мерчанта для автоматической синхронизации.',
        })
        return
      }
    }

    sendSuccess(res, {
      synced: 0,
      message: 'Автоматическая синхронизация недоступна. Используйте загрузку выписки.',
    })
  }),
)
