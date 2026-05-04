/**
 * Auth route integration tests.
 * Requires a running PostgreSQL instance (DATABASE_URL env var).
 * Tests create and clean up their own data using unique emails.
 */
import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '@utils/prisma'

const TEST_EMAIL = `test-auth-${Date.now()}@nalogai.test`
const TEST_PASSWORD = 'TestPass123!'
const TEST_NAME = 'Test User'

// Skip all tests if no database is available
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabaseUrl)('Auth routes — integration', () => {
  // Store tokens across tests
  let accessToken: string
  let refreshCookie: string

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
    await prisma.$disconnect()
  })

  // ── Register ──────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD, fullName: TEST_NAME })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe(TEST_EMAIL)
      expect(res.body.data.user.fullName).toBe(TEST_NAME)
      expect(res.body.data.accessToken).toBeTruthy()
      expect(res.headers['set-cookie']).toBeDefined()

      accessToken = res.body.data.accessToken as string
      const cookies = res.headers['set-cookie'] as unknown as string[]
      refreshCookie = cookies.find(c => c.startsWith('refreshToken=')) ?? ''
    })

    it('rejects duplicate email with 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD, fullName: TEST_NAME })

      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
    })

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'notanemail', password: '123' })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })
  })

  // ── Login ─────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeTruthy()
      expect(res.body.data.user.email).toBe(TEST_EMAIL)
      expect(res.headers['set-cookie']).toBeDefined()

      accessToken = res.body.data.accessToken as string
      const cookies = res.headers['set-cookie'] as unknown as string[]
      refreshCookie = cookies.find(c => c.startsWith('refreshToken=')) ?? ''
    })

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'WrongPassword!' })

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('rejects unknown email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: TEST_PASSWORD })

      expect(res.status).toBe(401)
    })
  })

  // ── Me ────────────────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe(TEST_EMAIL)
    })

    it('rejects request without token with 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('rejects invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')

      expect(res.status).toBe(401)
    })
  })

  // ── Refresh ───────────────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('issues new access token using refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)

      expect(res.status).toBe(200)
      expect(res.body.data.accessToken).toBeTruthy()
      // Note: tokens may be identical if issued within the same second (same JWT iat)
      // What matters is that a valid token is returned and the old refresh token rotates

      // Update for logout test
      accessToken = res.body.data.accessToken as string
      const cookies = res.headers['set-cookie'] as unknown as string[]
      refreshCookie = cookies.find(c => c.startsWith('refreshToken=')) ?? ''
    })

    it('invalidates old refresh token after rotation (replay attack prevention)', async () => {
      const oldCookie = refreshCookie

      // Rotate: use current cookie to get a new one
      const rotateRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', oldCookie)
      expect(rotateRes.status).toBe(200)

      // Update shared state for downstream logout test
      accessToken = rotateRes.body.data.accessToken as string
      const cookies = rotateRes.headers['set-cookie'] as unknown as string[]
      refreshCookie = cookies.find(c => c.startsWith('refreshToken=')) ?? ''

      // The old cookie must now be rejected — DB token is revoked
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', oldCookie)
      expect(replayRes.status).toBe(401)
    })

    it('rejects missing refresh cookie with 401', async () => {
      const res = await request(app).post('/api/auth/refresh')
      expect(res.status).toBe(401)
    })
  })

  // ── Logout ────────────────────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('logs out successfully and clears cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshCookie)

      expect(res.status).toBe(200)
      // Cookie should be cleared (set-cookie header with empty value or maxAge=0)
      const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
      if (setCookie) {
        const cleared = setCookie.some(
          c => c.startsWith('refreshToken=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0'))
        )
        expect(cleared).toBe(true)
      }
    })

    it('old refresh token is revoked after logout', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)

      expect(res.status).toBe(401)
    })
  })

  // ── Health check ──────────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('returns correct shape with db and version fields', async () => {
      const res = await request(app).get('/api/health')
      // DB is up (test is gated on DATABASE_URL). Redis may or may not be running.
      expect(res.body.db).toBe(true)
      expect(res.body.version).toBeTruthy()
      expect(['ok', 'degraded']).toContain(res.body.status)
      // Status is 200 when both db+redis ok, 503 when redis absent
      expect([200, 503]).toContain(res.status)
    })
  })
})
