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

export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearer(req)
  if (!token) throw new UnauthorizedError('Missing access token')

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not configured')

  try {
    const payload = jwt.verify(token, secret) as JwtPayload
    req.user = payload

    // Token version check: if the user's tokenVersion in DB is higher than
    // the JWT's, the token is stale (admin changed subscription, etc.)
    // Skip check for admin routes to avoid circular DB lookups on every admin request.
    if (!req.path.startsWith('/api/admin')) {
      try {
        const { prisma } = await import('@utils/prisma')
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { tokenVersion: true },
        })
        if (user && user.tokenVersion > (payload.tokenVersion ?? 0)) {
          throw new UnauthorizedError('Token expired — please refresh')
        }
      } catch (dbErr) {
        // If it's our own UnauthorizedError, re-throw
        if (dbErr instanceof UnauthorizedError) throw dbErr
        // DB errors should not block auth — let request through
      }
    }

    next()
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError('Invalid or expired access token')
  }
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
