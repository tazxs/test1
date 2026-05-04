import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '@utils/prisma'
import bcrypt from 'bcrypt'

describe('Admin RBAC & Endpoints', () => {
  let adminToken: string
  let userToken: string
  let adminUserId: string
  let regularUserId: string

  beforeAll(async () => {
    // Create admin user
    const adminPassword = await bcrypt.hash('AdminPass123!', 12)
    const admin = await prisma.user.create({
      data: {
        email: `admin-test-${Date.now()}@test.com`,
        password: adminPassword,
        fullName: 'Test Admin',
        role: 'ADMIN',
        iin: '123456789012',
      },
    })
    adminUserId = admin.id

    // Create regular user
    const userPassword = await bcrypt.hash('UserPass123!', 12)
    const user = await prisma.user.create({
      data: {
        email: `user-test-${Date.now()}@test.com`,
        password: userPassword,
        fullName: 'Test User',
        role: 'USER',
        iin: '987654321098',
      },
    })
    regularUserId = user.id

    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'AdminPass123!' })
    adminToken = adminLogin.body.data.accessToken

    // Login as regular user
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'UserPass123!' })
    userToken = userLogin.body.data.accessToken
  })

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { actorId: adminUserId } })
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, regularUserId] } },
    })
  })

  describe('Route Hardening', () => {
    it('should return 401 for unauthenticated admin requests', async () => {
      const res = await request(app).get('/api/admin/stats')
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('should return 403 for regular user accessing admin routes', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 for regular user accessing admin users list', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })

    it('should return 403 for regular user accessing admin logs', async () => {
      const res = await request(app)
        .get(`/api/admin/logs/${adminUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })

    it('should return 403 for regular user trying subscription override', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${regularUserId}/subscription`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ plan: 'PRO' })
      expect(res.status).toBe(403)
    })
  })

  describe('Admin Stats', () => {
    it('should return dashboard stats for admin', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('totalUsers')
      expect(res.body.data).toHaveProperty('mrr')
      expect(res.body.data).toHaveProperty('form910Count')
    })
  })

  describe('Admin User Management', () => {
    it('should list users with masked IINs for admin', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)

      // Verify IINs are masked
      const users = res.body.data as Array<{ iin: string | null }>
      for (const user of users) {
        if (user.iin) {
          expect(user.iin).toMatch(/^\d{3}\*\*\*\d{2}$/)
        }
      }
    })

    it('should get user detail with masked IIN', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.iin).toMatch(/^\d{3}\*\*\*\d{2}$/)
      expect(res.body.data).not.toHaveProperty('password')
    })

    it('should unmask IIN and create audit log', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${regularUserId}/unmask-iin`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.iin).toBe('987654321098')

      // Verify audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actorId: adminUserId,
          targetId: regularUserId,
          action: 'UNMASK_IIN',
        },
      })
      expect(auditLog).not.toBeNull()
    })

    it('should override subscription and create audit log', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${regularUserId}/subscription`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'PRO' })
      expect(res.status).toBe(200)
      expect(res.body.data.plan).toBe('PRO')

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actorId: adminUserId,
          targetId: regularUserId,
          action: 'SUBSCRIPTION_OVERRIDE',
        },
      })
      expect(auditLog).not.toBeNull()
      expect((auditLog!.details as Record<string, unknown>).newPlan).toBe('PRO')

      // Reset back to FREE
      await request(app)
        .patch(`/api/admin/users/${regularUserId}/subscription`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'FREE' })
    })

    it('should reject invalid plan values', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${regularUserId}/subscription`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'INVALID_PLAN' })
      expect(res.status).toBe(422)
    })
  })

  describe('Admin Logs', () => {
    it('should fetch user logs for admin', async () => {
      const res = await request(app)
        .get(`/api/admin/logs/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('JWT Role Claim', () => {
    it('should include role in JWT payload for admin', async () => {
      const payload = JSON.parse(atob(adminToken.split('.')[1]!))
      expect(payload.role).toBe('ADMIN')
    })

    it('should include role in JWT payload for regular user', async () => {
      const payload = JSON.parse(atob(userToken.split('.')[1]!))
      expect(payload.role).toBe('USER')
    })
  })
})
