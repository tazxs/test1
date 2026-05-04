import type { Request, Response, NextFunction } from 'express'
import type { ApiError, ApiErrorDetail } from 'nalogai-shared/types/api.types'
import { AppError } from '@utils/errors'
import { logger } from '@utils/logger'
import { captureException } from '@utils/sentry'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const userId = req.user?.sub
  const requestMeta = {
    method: req.method,
    path: req.path,
    userId,
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      captureException(err, {
        tags: { handled: 'true', statusCode: String(err.statusCode), code: err.code },
        user: userId ? { id: userId } : undefined,
        extra: requestMeta,
      })
      logger.error('Handled application error', { err, ...requestMeta, code: err.code })
    } else {
      logger.warn('Handled client error', { ...requestMeta, code: err.code, statusCode: err.statusCode })
    }
    const body: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details as ApiErrorDetail[] | undefined,
      },
    }
    res.status(err.statusCode).json(body)
    return
  }

  const safeErr = err instanceof Error
    ? { message: err.message, name: err.name, stack: err.stack }
    : { message: String(err) }
  captureException(err, {
    tags: { handled: 'false', statusCode: '500' },
    user: userId ? { id: userId } : undefined,
    extra: requestMeta,
  })
  logger.error('Unhandled error', { ...safeErr, ...requestMeta })

  const body: ApiError = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  }
  res.status(500).json(body)
}
