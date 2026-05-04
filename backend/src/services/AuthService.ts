import crypto from 'node:crypto'
const { randomUUID, randomBytes, createHash } = crypto
import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { prisma } from '@utils/prisma'
import { signAccessToken } from '@middleware/auth'
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@utils/errors'
import type { UserProfile } from 'nalogai-shared/types/user.types'

const BCRYPT_ROUNDS = 12
const REFRESH_TTL_DAYS = 30

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface AuthResult {
  user: UserProfile
  accessToken: string
  refreshToken: string
}

function toProfile(user: {
  id: string
  email: string
  fullName: string
  iin: string | null
  businessType: string
  taxRegime: string
  plan: string
  role: string
  preferredLanguage: string
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    iin: user.iin,
    businessType: user.businessType as UserProfile['businessType'],
    taxRegime: user.taxRegime as UserProfile['taxRegime'],
    plan: user.plan as UserProfile['plan'],
    role: user.role as UserProfile['role'],
    preferredLanguage: user.preferredLanguage as UserProfile['preferredLanguage'],
  }
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = randomUUID()
  const hashedToken = hashToken(token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)

  await prisma.refreshToken.create({
    data: { userId, token: hashedToken, expiresAt },
  })

  // Return raw token to client; only the hash is stored
  return token
}

export const AuthService = {
  async register(
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictError('Пользователь с таким email уже существует')

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = await prisma.user.create({
      data: { email, password: passwordHash, fullName },
    })

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      plan: user.plan,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })
    const refreshToken = await createRefreshToken(user.id)

    return { user: toProfile(user), accessToken, refreshToken }
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new UnauthorizedError('Неверный email или пароль')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedError('Неверный email или пароль')

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      plan: user.plan,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })
    const refreshToken = await createRefreshToken(user.id)

    return { user: toProfile(user), accessToken, refreshToken }
  },

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const hashedToken = hashToken(token)
    const record = await prisma.refreshToken.findUnique({ where: { token: hashedToken } })

    // ── Token replay detection ──────────────────────────────────────────────
    // If a revoked token is reused, it means someone is trying to replay an old token.
    // This is a security violation — revoke ALL tokens for this user to force re-login.
    if (record && record.revokedAt !== null) {
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedError('Подозрительная активность: все сессии завершены')
    }

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedError('Недействительный или истёкший токен обновления')
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    })

    const user = await prisma.user.findUnique({ where: { id: record.userId } })
    if (!user) throw new NotFoundError('User')

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      plan: user.plan,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })
    const newRefreshToken = await createRefreshToken(user.id)

    return { accessToken, refreshToken: newRefreshToken }
  },

  async logout(token: string): Promise<void> {
    const hashedToken = hashToken(token)
    await prisma.refreshToken.updateMany({
      where: { token: hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  },

  async getMe(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User')
    return toProfile(user)
  },

  async completeOnboarding(
    userId: string,
    data: { businessType: string; taxRegime: string; iin?: string },
  ): Promise<UserProfile> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          businessType: data.businessType as never,
          taxRegime: data.taxRegime as never,
          iin: data.iin ?? undefined,
          onboardingCompleted: true,
        },
      })
      return toProfile(user)
    } catch (err) {
      // P2002 = unique constraint violation — IIN already belongs to another user
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Этот ИИН уже зарегистрирован в системе')
      }
      throw err
    }
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } })
    // Always return success to prevent email enumeration
    if (!user) return

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    // Generate a secure 64-char hex token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    // Send the reset email
    const { MailService } = await import('./MailService')
    await MailService.sendPasswordResetEmail(user.email, token)
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedError('Недействительный или истёкший токен сброса пароля')
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    // Update password and increment tokenVersion to invalidate all sessions
    await prisma.user.update({
      where: { id: record.userId },
      data: {
        password: passwordHash,
        tokenVersion: { increment: 1 },
      },
    })

    // Delete the used token
    await prisma.passwordResetToken.delete({ where: { id: record.id } })

    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  },
}
