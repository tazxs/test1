import type { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { UnauthorizedError, ForbiddenError } from '@utils/errors'

export interface JwtPayload {
  sub: string // userId
  email: string
  plan: string
  role: string // 'USER' | 'ADMIN'
  tokenVersion: number
  iat: number
  exp: number
}

// Augment Express Request so downstream handlers have req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

// ── BETA TEST MODE ──────────────────────────────────────────────────────────
// JWT verification is bypassed. A mock admin user is attached to every request.
// AuditLogService still records all actions under 'guest_beta' for non-repudiation.
// PII redaction remains active — all sensitive data is masked in Neon logs.
const BETA_MOCK_USER: JwtPayload = {
  sub: 'guest_beta',
  email: 'beta@nalogai.kz',
  plan: 'PRO_AI',
  role: 'ADMIN',
  tokenVersion: 0,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
}

export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // BETA: Skip JWT verification, attach mock user
  req.user = BETA_MOCK_USER
  next()
}

/** Same as requireAuth but allows unauthenticated requests through */
export const optionalAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractBearer(req)
  if (!token) return next()

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return next()

  try {
    req.user = jwt.verify(token, secret) as JwtPayload
  } catch {
    // silently ignore invalid token for optional routes
  }
  next()
}

export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>
): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not configured')
  return jwt.sign(
    { ...payload, tokenVersion: payload.tokenVersion ?? 0 },
    secret,
    { expiresIn: '15m' },
  )
}

/** Require authenticated user with ADMIN role */
export const requireAdmin: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) throw new UnauthorizedError('Missing access token')
  if (req.user.role !== 'ADMIN') throw new ForbiddenError('Admin access required')
  next()
}
