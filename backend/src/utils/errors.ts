import type { ApiErrorCode } from 'nalogai-shared/types/api.types'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message)
    this.name = 'ConflictError'
  }
}

export class UpgradeRequiredError extends AppError {
  constructor(message = 'This feature requires a higher subscription plan') {
    super(403, 'UPGRADE_REQUIRED', message)
    this.name = 'UpgradeRequiredError'
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(429, 'RATE_LIMIT', 'Too many requests, please try again later')
    this.name = 'RateLimitError'
  }
}

export class ServiceDegradedError extends AppError {
  constructor(serviceName: string) {
    super(503, 'AI_SERVICE_ERROR', `${serviceName} is temporarily degraded`)
    this.name = 'ServiceDegradedError'
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message)
    this.name = 'InternalError'
  }
}
