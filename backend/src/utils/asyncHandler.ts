import type { Request, Response, NextFunction, RequestHandler } from 'express'

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>

/**
 * Wraps an async Express handler so thrown errors are forwarded to next(err)
 * rather than becoming unhandled promise rejections.
 * Required for Express 4, which does not auto-catch async handler errors.
 */
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
