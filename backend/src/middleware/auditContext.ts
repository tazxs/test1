/**
 * AuditContextMiddleware — extracts network identity markers from every HTTP request.
 *
 * Captures the true client IP (respecting X-Forwarded-For behind reverse proxies)
 * and the User-Agent string, attaching them to the Express Request object for
 * downstream service-layer audit logging.
 *
 * SECURITY: When `trust proxy` is enabled, Express parses X-Forwarded-For automatically.
 * We take the FIRST entry (leftmost = original client) to prevent spoofing via
 * header injection after the load balancer. If no forwarded header exists, we
 * fall back to req.socket.remoteAddress.
 *
 * IP SPOOFING PREVENTION:
 * - Behind a trusted proxy (Nginx/Cloudflare), Express's `trust proxy` setting
 *   ensures only the proxy's IP is trusted for X-Forwarded-For parsing.
 * - Direct connections (bypassing the load balancer) will use socket.remoteAddress,
 *   which cannot be spoofed by the client.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express'

/** Network identity markers extracted from the HTTP request. */
export interface AuditMetadata {
  ipAddress: string
  userAgent: string
}

// Augment Express Request so downstream handlers have req.auditMeta
declare global {
  namespace Express {
    interface Request {
      auditMeta?: AuditMetadata
    }
  }
}

/**
 * Extract the true client IP from the request.
 *
 * When Express `trust proxy` is enabled, req.ip already contains the
 * leftmost (original client) IP from X-Forwarded-For. We use req.ip
 * as the primary source, falling back to socket.remoteAddress.
 *
 * @returns Sanitized IP address string (IPv4 or IPv6)
 */
function extractClientIp(req: Request): string {
  // With trust proxy enabled, req.ip is the parsed leftmost X-Forwarded-For entry
  // Without trust proxy, req.ip === req.socket.remoteAddress
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'

  // Normalize IPv6 loopback to IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1'

  // Strip IPv6 prefix if present (::ffff:192.168.1.1 → 192.168.1.1)
  if (ip.startsWith('::ffff:')) return ip.slice(7)

  return ip
}

/**
 * Extract User-Agent string, truncated to 500 chars to prevent abuse.
 */
function extractUserAgent(req: Request): string {
  const ua = req.headers['user-agent'] || 'unknown'
  return ua.length > 500 ? ua.slice(0, 500) : ua
}

/**
 * Express middleware that attaches audit metadata to every request.
 * Place this AFTER `trust proxy` and `express.json()` but BEFORE route handlers.
 */
export const auditContextMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  req.auditMeta = {
    ipAddress: extractClientIp(req),
    userAgent: extractUserAgent(req),
  }
  next()
}
