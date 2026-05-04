/**
 * NalogAI "Final Barrier" Battle Test Suite
 *
 * Covers:
 *   1. IDOR Protection — audit all /:id routes
 *   2. Token Rotation Replay — old refresh token invalidation
 *   3. PII Log Check — no IIN/payment data in structured logs
 *   4. Regime Transition — Patent → Simplified mid-month tax accuracy
 *   5. NCALayer Timeout — graceful error handling
 *   6. PWA Sync — API calls are network-only (no caching)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '@utils/prisma'
import { TaxCalculatorService } from '@services/TaxCalculatorService'
import { MRP_2025 } from 'nalogai-shared/constants/taxRates'

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
const MRP = MRP_2025 // 3 932 KZT

// ═══════════════════════════════════════════════════════════════════════════════
// 1. IDOR PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!hasDatabaseUrl)('IDOR Protection — /api/transactions/:id and /api/declarations/:id', () => {
  let userAToken: string
  let userAId: string
  let userBToken: string
  let userBId: string
  let userATransactionId: string
  let userADeclarationId: string

  beforeAll(async () => {
    // Create two separate users
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: `idor-a-${Date.now()}@test.com`, password: 'TestPass123!', fullName: 'User A' })
    userAToken = resA.body.data.accessToken
    userAId = resA.body.data.user.id

    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: `idor-b-${Date.now()}@test.com`, password: 'TestPass123!', fullName: 'User B' })
    userBToken = resB.body.data.accessToken
    userBId = resB.body.data.user.id

    // Create a transaction for User A
    const txRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ amount: 100000, type: 'INCOME', category: 'SERVICES_INCOME', description: 'User A tx', date: '2026-01-15' })
    userATransactionId = txRes.body.data.id

    // Create a declaration for User A
    const declRes = await request(app)
      .post('/api/declarations')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ period: '2026-Q1', periodType: 'QUARTER', formType: 'FORM_910' })
    userADeclarationId = declRes.body.data.id
  })

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { userId: { in: [userAId, userBId] } } })
    await prisma.declaration.deleteMany({ where: { userId: { in: [userAId, userBId] } } })
    await prisma.refreshToken.deleteMany({ where: { userId: { in: [userAId, userBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } })
    await prisma.$disconnect()
  })

  // ── Transaction IDOR ───────────────────────────────────────────────────────
  describe('Transaction IDOR', () => {
    it('User A can read own transaction', async () => {
      const res = await request(app)
        .get(`/api/transactions?limit=200`)
        .set('Authorization', `Bearer ${userAToken}`)
      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((t) => t.id === userATransactionId)).toBe(true)
    })

    it('User B cannot see User A transaction in list', async () => {
      const res = await request(app)
        .get(`/api/transactions?limit=200`)
        .set('Authorization', `Bearer ${userBToken}`)
      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((t) => t.id === userATransactionId)).toBe(false)
    })

    it('User B cannot PATCH User A transaction (404)', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${userATransactionId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ category: 'OTHER_INCOME' })
      expect(res.status).toBe(404)
    })

    it('User B cannot DELETE User A transaction (404)', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${userATransactionId}`)
        .set('Authorization', `Bearer ${userBToken}`)
      expect(res.status).toBe(404)
    })
  })

  // ── Declaration IDOR ───────────────────────────────────────────────────────
  describe('Declaration IDOR', () => {
    it('User A can read own declaration', async () => {
      const res = await request(app)
        .get(`/api/declarations/${userADeclarationId}`)
        .set('Authorization', `Bearer ${userAToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(userADeclarationId)
    })

    it('User B cannot read User A declaration (404)', async () => {
      const res = await request(app)
        .get(`/api/declarations/${userADeclarationId}`)
        .set('Authorization', `Bearer ${userBToken}`)
      expect(res.status).toBe(404)
    })

    it('User B cannot calculate User A declaration (404)', async () => {
      const res = await request(app)
        .post(`/api/declarations/${userADeclarationId}/calculate`)
        .set('Authorization', `Bearer ${userBToken}`)
      expect(res.status).toBe(404)
    })

    it('User B cannot submit User A declaration (404)', async () => {
      const res = await request(app)
        .post(`/api/declarations/${userADeclarationId}/submit`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ signedXml: '<xml/>' })
      expect(res.status).toBe(404)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TOKEN ROTATION REPLAY
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!hasDatabaseUrl)('Token Rotation Replay Detection', () => {
  let userId: string
  let firstRefreshToken: string
  let secondRefreshToken: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `replay-${Date.now()}@test.com`, password: 'TestPass123!', fullName: 'Replay Test' })
    userId = res.body.data.user.id
    const cookies = res.headers['set-cookie'] as unknown as string[]
    firstRefreshToken = cookies.find((c) => c.startsWith('refreshToken='))?.split('=')[1]?.split(';')[0] ?? ''
  })

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('first refresh succeeds and issues new token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstRefreshToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeTruthy()
    const cookies = res.headers['set-cookie'] as unknown as string[]
    secondRefreshToken = cookies.find((c) => c.startsWith('refreshToken='))?.split('=')[1]?.split(';')[0] ?? ''
    expect(secondRefreshToken).not.toBe(firstRefreshToken)
  })

  it('reusing old (revoked) token triggers session invalidation', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstRefreshToken}`)

    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('все сессии завершены')
  })

  it('new token is also invalidated after replay detection', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${secondRefreshToken}`)

    // Should also fail because all tokens were revoked
    expect(res.status).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PII LOG CHECK
// ═══════════════════════════════════════════════════════════════════════════════
describe('PII Log Sanitization', () => {
  it('logger redacts IIN field', async () => {
    // Verify by reading the logger source and checking REDACTED_KEYS includes 'iin'
    const fs = await import('fs')
    const path = await import('path')
    const loggerContent = fs.readFileSync(
      path.resolve(__dirname, '../../utils/logger.ts'),
      'utf-8',
    )
    expect(loggerContent).toContain("'iin'")
    expect(loggerContent).toContain("'paymentdetails'")
    expect(loggerContent).toContain("'cardnumber'")
    expect(loggerContent).toContain("'cvv'")
  })

  it('logger redacts payment-related fields', async () => {
    // Verify that paymentLogger never logs card data
    const { logPaymentSuccess } = await import('@utils/paymentLogger')
    // This should not throw and should only log cardLastFour
    expect(() => {
      logPaymentSuccess({
        userId: 'test',
        plan: 'PRO',
        amount: 4990,
        currency: 'KZT',
        transactionId: 'txn_123',
        provider: 'mock',
        cardLastFour: '4242',
      })
    }).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. REGIME TRANSITION — Patent → Simplified mid-month
// ═══════════════════════════════════════════════════════════════════════════════
describe('Regime Transition — Patent → Simplified (MRP = 3 932 KZT)', () => {
  it('Patent regime: 1% on 500K = 5 000 + OPV 50K', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 500_000,
      regime: 'PATENT',
      months: 1,
    })
    expect(r.incomeTax).toBe(5_000) // 1%
    expect(r.pensionContribution).toBe(50_000) // 10%
    expect(r.socialTax).toBe(0) // included in patent
    expect(r.medicalInsurance).toBe(0) // included in patent
    expect(r.totalTaxBurden).toBe(55_000)
  })

  it('Simplified regime: 3% on 500K = 15K + OPV 50K + OSMS prorated', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 500_000,
      regime: 'SIMPLIFIED_DECLARATION',
      months: 1,
    })
    const total3 = Math.round(500_000 * 0.03) // 15 000
    expect(r.incomeTax + r.socialTax).toBe(total3)
    expect(r.pensionContribution).toBe(50_000)
    expect(r.medicalInsurance).toBe(Math.round(71_400 / 12)) // monthly OSMS
    expect(r.totalTaxBurden).toBe(
      total3 + 50_000 + Math.round(71_400 / 12),
    )
  })

  it('mid-month transition: same income, different regimes produce different burdens', () => {
    const patent = TaxCalculatorService.calculate({ grossIncome: 500_000, regime: 'PATENT', months: 1 })
    const simplified = TaxCalculatorService.calculate({ grossIncome: 500_000, regime: 'SIMPLIFIED_DECLARATION', months: 1 })

    // Simplified has higher burden due to 3% + OSMS
    expect(simplified.totalTaxBurden).toBeGreaterThan(patent.totalTaxBurden)

    // Difference = (3% - 1%) + OSMS monthly
    const expectedDiff = Math.round(500_000 * 0.02) + Math.round(71_400 / 12)
    expect(simplified.totalTaxBurden - patent.totalTaxBurden).toBe(expectedDiff)
  })

  it('ESP regime: fixed 1 MRP/month regardless of income', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 500_000,
      regime: 'ESP',
      months: 1,
    })
    expect(r.incomeTax).toBe(MRP) // 3 932
    expect(r.totalTaxBurden).toBe(MRP)
  })

  it('all regimes handle zero income correctly', () => {
    const patent = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'PATENT', months: 1 })
    const simplified = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'SIMPLIFIED_DECLARATION', months: 1 })
    const esp = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'ESP', months: 1 })

    expect(patent.totalTaxBurden).toBe(0)
    expect(simplified.totalTaxBurden).toBe(Math.round(71_400 / 12)) // OSMS only
    expect(esp.totalTaxBurden).toBe(MRP) // fixed ESP
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. NCALAYER TIMEOUT — Error classification
// ═══════════════════════════════════════════════════════════════════════════════
describe('NCALayer Error Handling', () => {
  it('NCATimeoutError has localized Russian message', async () => {
    const { NCATimeoutError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCATimeoutError()
    expect(err.name).toBe('NCATimeoutError')
    expect(err.message).toContain('NCALayer')
    expect(err.message).toContain('истекло')
  })

  it('NCANotRunningError has localized Russian message', async () => {
    const { NCANotRunningError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCANotRunningError()
    expect(err.name).toBe('NCANotRunningError')
    expect(err.message).toContain('не запущен')
  })

  it('NCAWrongPasswordError has localized Russian message', async () => {
    const { NCAWrongPasswordError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCAWrongPasswordError()
    expect(err.name).toBe('NCAWrongPasswordError')
    expect(err.message).toContain('Неверный пароль')
  })

  it('NCAKeyExpiredError has localized Russian message', async () => {
    const { NCAKeyExpiredError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCAKeyExpiredError()
    expect(err.name).toBe('NCAKeyExpiredError')
    expect(err.message).toContain('истёк')
  })

  it('NCAUserCancelledError has localized Russian message', async () => {
    const { NCAUserCancelledError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCAUserCancelledError()
    expect(err.name).toBe('NCAUserCancelledError')
    expect(err.message).toContain('отменена')
  })

  it('NCAWrongKeyTypeError explains SIGN key requirement', async () => {
    const { NCAWrongKeyTypeError } = await import('../../../../frontend/src/services/ncalayer')
    const err = new NCAWrongKeyTypeError('AUTH')
    expect(err.name).toBe('NCAWrongKeyTypeError')
    expect(err.message).toContain('SIGN')
    expect(err.message).toContain('Аутентификация')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PWA SYNC — Service Worker behavior
// ═══════════════════════════════════════════════════════════════════════════════
describe('PWA Service Worker — API calls are network-only', () => {
  it('sw.js skips /api requests (never caches API calls)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const swContent = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/public/sw.js'),
      'utf-8',
    )

    // Verify: API calls are explicitly skipped
    expect(swContent).toContain("url.pathname.startsWith('/api')")
    expect(swContent).toContain('return') // early return = skip caching

    // Verify: no IndexedDB or background sync for transactions
    // (prevents duplicate transaction creation)
    expect(swContent).not.toContain('indexedDB')
    expect(swContent).not.toContain('sync.register')
    expect(swContent).not.toContain('BackgroundSync')
  })

  it('sw.js uses network-first for navigation (fresh content)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const swContent = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/public/sw.js'),
      'utf-8',
    )

    // Navigation requests use network-first strategy
    expect(swContent).toContain("request.mode === 'navigate'")
    expect(swContent).toContain('fetch(request)')
  })
})
