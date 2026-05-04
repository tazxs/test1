import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess } from '@utils/response'
import { ValidationError } from '@utils/errors'
import { prisma } from '@utils/prisma'
import { validateIIN } from 'nalogai-shared/utils/iinValidator'

export const usersRouter = Router()
usersRouter.use(requireAuth)

// ── Serialize user → API profile shape ────────────────────────────────────────
function serializeProfile(u: {
  id: string
  email: string
  fullName: string
  iin: string | null
  businessType: string
  taxRegime: string
  plan: string
  preferredLanguage: string
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    iin: u.iin,
    businessType: u.businessType,
    taxRegime: u.taxRegime,
    plan: u.plan,
    preferredLanguage: u.preferredLanguage,
  }
}

// ── GET /api/users/me ─────────────────────────────────────────────────────────
usersRouter.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.sub },
      select: { id: true, email: true, fullName: true, iin: true, businessType: true, taxRegime: true, plan: true, preferredLanguage: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } })
      return
    }
    sendSuccess(res, serializeProfile(user))
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/users/profile ──────────────────────────────────────────────────
const updateProfileSchema = z.object({
  fullName:     z.string().min(1, 'Имя обязательно').max(200).optional(),
  iin:          z.string().length(12, 'ИИН должен содержать 12 цифр').regex(/^\d{12}$/, 'ИИН должен содержать только цифры').optional(),
  businessType: z.enum(['SELF_EMPLOYED', 'SOLE_PROPRIETOR', 'LLC']).optional(),
  taxRegime:    z.enum(['SIMPLIFIED_DECLARATION', 'GENERAL_REGIME', 'PATENT', 'ESP']).optional(),
  preferredLanguage: z.enum(['ru', 'kk', 'en']).optional(),
})

usersRouter.patch(
  '/profile',
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateProfileSchema>

      // Validate IIN checksum if provided
      if (body.iin != null && !validateIIN(body.iin)) {
        throw new ValidationError(
          `ИИН ${body.iin} не прошёл проверку контрольной суммы. Проверьте правильность номера.`
        )
      }

      // Guard against IIN uniqueness conflict
      if (body.iin != null) {
        const conflict = await prisma.user.findFirst({
          where: { iin: body.iin, id: { not: req.user!.sub } },
          select: { id: true },
        })
        if (conflict != null) {
          throw new ValidationError('Этот ИИН уже используется другим аккаунтом')
        }
      }

      const updated = await prisma.user.update({
        where:  { id: req.user!.sub },
        data:   {
          ...(body.fullName     != null && { fullName: body.fullName }),
          ...(body.iin          != null && { iin: body.iin }),
          ...(body.businessType != null && { businessType: body.businessType as never }),
          ...(body.taxRegime    != null && { taxRegime: body.taxRegime as never }),
          ...(body.preferredLanguage != null && { preferredLanguage: body.preferredLanguage }),
        },
        select: { id: true, email: true, fullName: true, iin: true, businessType: true, taxRegime: true, plan: true, preferredLanguage: true },
      })

      sendSuccess(res, serializeProfile(updated))
    } catch (err) {
      next(err)
    }
  },
)
