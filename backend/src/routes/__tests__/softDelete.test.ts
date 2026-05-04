/**
 * Soft Delete & Data Integrity integration tests.
 * Requires a running PostgreSQL instance (DATABASE_URL env var).
 *
 * Verifies:
 * 1. Soft-deleted transactions are excluded from list queries
 * 2. Soft-deleted transactions remain in the database with deletedAt set
 * 3. DB-level CHECK constraint prevents negative transaction amounts
 * 4. Soft-deleted declarations are excluded from list queries
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '@utils/prisma'

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabaseUrl)('Soft Delete & Data Integrity — integration', () => {
  let accessToken: string
  let userId: string
  const TEST_EMAIL = `test-softdelete-${Date.now()}@nalogai.test`
  const TEST_PASSWORD = 'TestPass123!'

  beforeAll(async () => {
    // Register a test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, fullName: 'Soft Delete Tester' })

    expect(res.status).toBe(201)
    accessToken = res.body.data.accessToken as string
    userId = res.body.data.user.id as string
  })

  afterAll(async () => {
    // Clean up: hard-delete test data
    await prisma.transaction.deleteMany({ where: { userId } })
    await prisma.declaration.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  // ── Transaction Soft Delete ─────────────────────────────────────────────────
  describe('Transaction soft delete', () => {
    let transactionId: string

    it('creates a transaction', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 50000,
          type: 'INCOME',
          category: 'SERVICES_INCOME',
          description: 'Test payment',
          date: '2026-01-15',
          source: 'MANUAL',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.amount).toBe(50000)
      transactionId = res.body.data.id as string
    })

    it('transaction appears in list before deletion', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((t) => t.id === transactionId)).toBe(true)
    })

    it('soft-deletes the transaction (sets deletedAt)', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.ok).toBe(true)
    })

    it('transaction is excluded from list after soft delete', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((t) => t.id === transactionId)).toBe(false)
    })

    it('transaction still exists in database with deletedAt set', async () => {
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
      expect(tx).not.toBeNull()
      expect(tx!.deletedAt).not.toBeNull()
      expect(tx!.deletedAt).toBeInstanceOf(Date)
    })

    it('returns 404 when trying to delete already soft-deleted transaction', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(404)
    })
  })

  // ── Negative Amount CHECK Constraint ────────────────────────────────────────
  describe('DB-level CHECK constraint: non-negative amounts', () => {
    it('rejects negative transaction amounts at database level', async () => {
      // Direct Prisma call bypasses app-level validation to test DB constraint
      await expect(
        prisma.transaction.create({
          data: {
            userId,
            amount: -100,
            type: 'INCOME',
            category: 'SERVICES_INCOME',
            description: 'Negative test',
            source: 'MANUAL',
            date: new Date('2026-01-15'),
          },
        }),
      ).rejects.toThrow()
    })

    it('accepts zero amount', async () => {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          amount: 0,
          type: 'EXPENSE',
          category: 'OTHER_EXPENSES',
          description: 'Zero amount test',
          source: 'MANUAL',
          date: new Date('2026-01-15'),
        },
      })
      expect(Number(tx.amount)).toBe(0)

      // Clean up
      await prisma.transaction.delete({ where: { id: tx.id } })
    })
  })

  // ── Declaration Soft Delete ─────────────────────────────────────────────────
  describe('Declaration soft delete', () => {
    let declarationId: string

    it('creates a declaration', async () => {
      const res = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          period: '2026-Q1',
          periodType: 'QUARTER',
          formType: 'FORM_910',
        })

      expect(res.status).toBe(201)
      declarationId = res.body.data.id as string
    })

    it('declaration appears in list', async () => {
      const res = await request(app)
        .get('/api/declarations')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((d) => d.id === declarationId)).toBe(true)
    })

    it('soft-deletes the declaration via PATCH (set deletedAt)', async () => {
      // Declarations don't have a DELETE route, so we test via direct DB update
      const updated = await prisma.declaration.update({
        where: { id: declarationId },
        data: { deletedAt: new Date() },
      })
      expect(updated.deletedAt).not.toBeNull()
    })

    it('declaration is excluded from list after soft delete', async () => {
      const res = await request(app)
        .get('/api/declarations')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      const items = res.body.data.items as Array<{ id: string }>
      expect(items.some((d) => d.id === declarationId)).toBe(false)
    })

    it('declaration still exists in database with deletedAt set', async () => {
      const decl = await prisma.declaration.findUnique({ where: { id: declarationId } })
      expect(decl).not.toBeNull()
      expect(decl!.deletedAt).not.toBeNull()
      expect(decl!.deletedAt).toBeInstanceOf(Date)
    })
  })
})
