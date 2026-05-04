import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ZodSchema } from 'zod'
import { ValidationError } from '@utils/errors'

type Target = 'body' | 'query' | 'params'

/**
 * Factory that returns an Express middleware validating req[target]
 * against the provided Zod schema.
 * On failure throws ValidationError with field-level details.
 */
export function validate(schema: ZodSchema, target: Target = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      throw new ValidationError('Validation failed', details)
    }
    // Replace with coerced/default-filled data
    req[target] = result.data as typeof req[typeof target]
    next()
  }
}
