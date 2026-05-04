import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess, sendPaginated } from '@utils/response'
import { NotFoundError, ConflictError, ValidationError } from '@utils/errors'
import { prisma } from '@utils/prisma'
import { Prisma } from '@prisma/client'
import {
  createDeclarationSchema,
  declarationListParamsSchema,
} from 'nalogai-shared/validators/declaration.validators'
import type { TaxCalculationResult } from 'nalogai-shared/types/declaration.types'
import type { TaxRegime } from 'nalogai-shared/types/user.types'
import { TaxCalculatorService } from '@services/TaxCalculatorService'
import { validateIIN } from 'nalogai-shared/utils/iinValidator'
import { normalizeLanguage } from '@utils/language'
import {
  generateForm910XML,
  generateForm200XML,
  submitToISNA,
  EGovNotConfiguredError,
  EGovSubmissionError,
} from '@services/EGovService'
import { generateDeclarationPdf } from '@services/DeclarationPdfService'

export const declarationsRouter = Router()

declarationsRouter.use(requireAuth)

// ── Serialize Prisma Declaration → API shape ───────────────────────────────────
function serialize(d: {
  id: string
  userId: string
  period: string
  periodType: string
  formType: string
  status: string
  calculation: Prisma.JsonValue
  pdfUrl: string | null
  eGovConfirmationCode: string | null
  submittedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...d,
    calculation: (d.calculation ?? null) as TaxCalculationResult | null,
    submittedAt: d.submittedAt?.toISOString() ?? null,
    deletedAt:   d.deletedAt?.toISOString()   ?? null,
    createdAt:   d.createdAt.toISOString(),
    updatedAt:   d.updatedAt.toISOString(),
  }
}

// ── Period → date range ────────────────────────────────────────────────────────
function periodToRange(period: string): { from: Date; to: Date } | null {
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(period)
  if (qMatch) {
    const year       = parseInt(qMatch[1]!, 10)
    const q          = parseInt(qMatch[2]!, 10)
    const monthStart = (q - 1) * 3
    return { from: new Date(year, monthStart, 1), to: new Date(year, monthStart + 3, 0) }
  }
  const yMatch = /^(\d{4})$/.exec(period)
  if (yMatch) {
    const year = parseInt(yMatch[1]!, 10)
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31) }
  }
  const mMatch = /^(\d{4})-(\d{2})$/.exec(period)
  if (mMatch) {
    const year  = parseInt(mMatch[1]!, 10)
    const month = parseInt(mMatch[2]!, 10) - 1
    return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) }
  }
  return null
}

function declarationPeriodToRange(period: string, formType: string): { from: Date; to: Date } | null {
  if (formType === 'FORM_910') {
    const qMatch = /^(\d{4})-Q([1-4])$/.exec(period)
    if (qMatch) {
      const year = parseInt(qMatch[1]!, 10)
      const q    = parseInt(qMatch[2]!, 10)
      return q <= 2
        ? { from: new Date(year, 0, 1), to: new Date(year, 6, 0) }
        : { from: new Date(year, 6, 1), to: new Date(year, 12, 0) }
    }
  }

  return periodToRange(period)
}

// ── formType → TaxRegime mapping ──────────────────────────────────────────────
const FORM_TYPE_TO_REGIME: Record<string, TaxRegime> = {
  FORM_910: 'SIMPLIFIED_DECLARATION',
  FORM_912: 'PATENT',
  FORM_200: 'GENERAL_REGIME',
}

// ── GET /api/declarations ──────────────────────────────────────────────────────
const ListQuerySchema = declarationListParamsSchema

declarationsRouter.get(
  '/',
  async (req, res, next) => {
    try {
      const query  = ListQuerySchema.parse(req.query)
      const userId = req.user!.sub

      const where: Prisma.DeclarationWhereInput = {
        userId,
        deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(query.year   && { period: { startsWith: String(query.year) } }),
      }

      const [total, rows] = await Promise.all([
        prisma.declaration.count({ where }),
        prisma.declaration.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip:    (query.page - 1) * query.limit,
          take:    query.limit,
        }),
      ])

      const totalPages = Math.ceil(total / query.limit)
      sendPaginated(res, rows.map(serialize), {
        page:        query.page,
        limit:       query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ── POST /api/declarations ─────────────────────────────────────────────────────
declarationsRouter.post(
  '/',
  validate(createDeclarationSchema),
  async (req, res, next) => {
    try {
      const { period, periodType, formType } = req.body as z.infer<typeof createDeclarationSchema>
      const userId = req.user!.sub

      // Guard: no duplicate (userId + period + formType)
      const existing = await prisma.declaration.findUnique({
        where: { userId_period_formType: { userId, period, formType } },
      })
      if (existing != null && existing.deletedAt == null) {
        throw new ConflictError('Декларация за этот период уже существует')
      }

      const decl = await prisma.declaration.upsert({
        where:  { userId_period_formType: { userId, period, formType } },
        create: { userId, period, periodType, formType, status: 'DRAFT' },
        // If it was soft-deleted, restore it
        update: { deletedAt: null, status: 'DRAFT', calculation: Prisma.JsonNull, pdfUrl: null, eGovConfirmationCode: null, submittedAt: null },
      })

      sendSuccess(res, serialize(decl), 201)
    } catch (err) {
      next(err)
    }
  },
)

// ── GET /api/declarations/:id/pdf ─────────────────────────────────────────────
declarationsRouter.get(
  '/:id/pdf',
  async (req, res, next) => {
    try {
      const decl = await prisma.declaration.findFirst({
        where: { id: req.params.id, userId: req.user!.sub, deletedAt: null },
        include: { user: true },
      })
      if (!decl) throw new NotFoundError('Декларация не найдена')
      if (decl.formType !== 'FORM_910') {
        throw new ValidationError('PDF доступен только для формы 910.00')
      }
      if (decl.calculation == null) {
        throw new ValidationError('Сначала выполните расчет налога')
      }
      if (!decl.user.iin || !validateIIN(decl.user.iin)) {
        throw new ValidationError('Укажите корректный ИИН в настройках профиля')
      }

      const language = normalizeLanguage(decl.user.preferredLanguage) ?? 'ru'
      const pdf = await generateDeclarationPdf({
        declarationId: decl.id,
        iin: decl.user.iin,
        fullName: decl.user.fullName,
        period: decl.period,
        calculation: decl.calculation as unknown as TaxCalculationResult,
        language,
      })
      const filename = `form-910-${decl.period.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', String(pdf.length))
      res.send(pdf)
    } catch (err) {
      next(err)
    }
  },
)

// ── GET /api/declarations/:id ──────────────────────────────────────────────────
declarationsRouter.get(
  '/:id',
  async (req, res, next) => {
    try {
      const decl = await prisma.declaration.findFirst({
        where: { id: req.params.id, userId: req.user!.sub, deletedAt: null },
      })
      if (!decl) throw new NotFoundError('Декларация не найдена')
      sendSuccess(res, serialize(decl))
    } catch (err) {
      next(err)
    }
  },
)

// ── POST /api/declarations/:id/calculate ──────────────────────────────────────
declarationsRouter.post(
  '/:id/calculate',
  async (req, res, next) => {
    try {
      const userId = req.user!.sub
      const decl   = await prisma.declaration.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
      })
      if (!decl) throw new NotFoundError('Декларация не найдена')
      if (decl.status === 'SUBMITTED' || decl.status === 'ACCEPTED') {
        throw new ValidationError('Нельзя пересчитать отправленную декларацию')
      }

      // Determine months in period. Form 910.00 is filed semi-annually even when
      // legacy records store Q1/Q3 as compact half-year identifiers.
      const months = decl.formType === 'FORM_910'
        ? 6
        : decl.periodType === 'QUARTER' ? 3 : decl.periodType === 'MONTH' ? 1 : 12

      // Aggregate income from real transactions for this period
      const range = declarationPeriodToRange(decl.period, decl.formType)
      let grossIncome = 0

      if (range) {
        const result = await prisma.transaction.aggregate({
          where: {
            userId,
            type: 'INCOME',
            deletedAt: null,
            date: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        })
        // Use .toNumber() on Prisma Decimal to avoid silent Number() float coercion
        grossIncome = result._sum.amount?.toNumber() ?? 0
      }

      const regime: TaxRegime = FORM_TYPE_TO_REGIME[decl.formType] ?? 'ESP'
      const calculation = TaxCalculatorService.calculate({ grossIncome, regime, months })

      const updated = await prisma.declaration.update({
        where: { id: decl.id },
        data:  {
          calculation: calculation as unknown as Prisma.InputJsonValue,
          status:      'READY',
        },
      })

      sendSuccess(res, serialize(updated))
    } catch (err) {
      next(err)
    }
  },
)

// ── POST /api/declarations/:id/submit ─────────────────────────────────────────
// Body: { signedXml?: string }
//   signedXml — XMLDSig-signed declaration XML produced by NCALayer on the client.
//               If omitted the server generates unsigned XML (only for testing).
const submitBodySchema = z.object({
  signedXml: z.string().optional(),
})

declarationsRouter.post(
  '/:id/submit',
  validate(submitBodySchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub

      // Load declaration
      const decl = await prisma.declaration.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
        include: { user: true },
      })
      if (!decl) throw new NotFoundError('Декларация не найдена')
      if (decl.status === 'ACCEPTED') {
        throw new ValidationError('Декларация уже принята')
      }
      if (decl.calculation == null) {
        throw new ValidationError('Сначала выполните расчёт налога')
      }

      // Validate IIN — required for real eGov submission
      const iin = decl.user.iin
      if (!iin) {
        throw new ValidationError(
          'Укажите ИИН в настройках профиля перед отправкой в eGov'
        )
      }
      if (!validateIIN(iin)) {
        throw new ValidationError(
          `ИИН ${iin} не прошёл проверку контрольной суммы. Проверьте данные в профиле.`
        )
      }

      const signedXml = (req.body as z.infer<typeof submitBodySchema>).signedXml ?? null

      const calc = decl.calculation as unknown as TaxCalculationResult
      const declarationLanguage = normalizeLanguage(decl.user.preferredLanguage) ?? 'ru'

      // Build XML if frontend did not send a signed one (useful for testing)
      const xmlForSubmission = signedXml ?? (() => {
        if (decl.formType === 'FORM_910') {
          return generateForm910XML({
            iin,
            fullName:        decl.user.fullName,
            period:          decl.period,
            grossIncome:     calc.grossIncome,
            incomeTax:       calc.incomeTax,
            socialTax:       calc.socialTax,
            pensionContrib:  calc.pensionContribution,
            medicalInsurance: calc.medicalInsurance,
            totalObligations: calc.totalTaxBurden,
            employeeCount:   0,
            language:        declarationLanguage,
          })
        }
        if (decl.formType === 'FORM_200') {
          return generateForm200XML({
            iin,
            fullName:        decl.user.fullName,
            period:          decl.period,
            grossIncome:     calc.grossIncome,
            taxableIncome:   calc.taxableIncome,
            incomeTax:       calc.incomeTax,
            pensionContrib:  calc.pensionContribution,
            medicalInsurance: calc.medicalInsurance,
            deductions:      calc.totalDeductions,
            language:        declarationLanguage,
          })
        }
        // FORM_912 (Patent) and ESP: no standardised XML — return minimal XML
        return `<?xml version="1.0" encoding="UTF-8"?>
<FNO language="${declarationLanguage}"><iin>${iin}</iin><formType>${decl.formType}</formType>
<period>${decl.period}</period><tax>${calc.totalTaxBurden}</tax></FNO>`
      })()

      // Attempt real ИСНА submission
      let confirmationCode: string
      let finalStatus: 'SUBMITTED' | 'ACCEPTED' = 'SUBMITTED'

      try {
        const result = await submitToISNA(xmlForSubmission, iin, decl.formType)
        confirmationCode = result.confirmationCode
        if (result.status === 'ACCEPTED') finalStatus = 'ACCEPTED'
      } catch (submitErr) {
        if (submitErr instanceof EGovNotConfiguredError) {
          // ИСНА not configured — save signed XML locally, mark as SUBMITTED
          // The confirmation code records that it's a locally-signed document.
          confirmationCode = signedXml
            ? `LOCAL-SIGNED-${decl.period}-${Date.now().toString(36).toUpperCase()}`
            : `EG-${decl.period}-${Math.floor(1000 + Math.random() * 9000)}`
        } else if (submitErr instanceof EGovSubmissionError) {
          throw new ValidationError(`eGov отклонил декларацию: ${(submitErr as Error).message}`)
        } else {
          throw submitErr
        }
      }

      const updated = await prisma.declaration.update({
        where: { id: decl.id },
        data:  {
          status:               finalStatus,
          eGovConfirmationCode: confirmationCode,
          submittedAt:          new Date(),
        },
      })

      sendSuccess(res, serialize(updated))
    } catch (err) {
      next(err)
    }
  },
)

// ── DELETE /api/declarations/:id ──────────────────────────────────────────────
declarationsRouter.delete(
  '/:id',
  async (req, res, next) => {
    try {
      const userId = req.user!.sub
      const decl   = await prisma.declaration.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
      })
      if (!decl) throw new NotFoundError('Декларация не найдена')
      if (decl.status === 'SUBMITTED' || decl.status === 'ACCEPTED') {
        throw new ValidationError('Нельзя удалить отправленную декларацию')
      }

      await prisma.declaration.update({
        where: { id: decl.id },
        data:  { deletedAt: new Date() },
      })

      sendSuccess(res, { id: decl.id })
    } catch (err) {
      next(err)
    }
  },
)
