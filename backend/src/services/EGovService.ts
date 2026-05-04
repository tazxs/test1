/**
 * EGovService — Kazakhstan eGov / КГД ИСНА integration.
 *
 * Responsibilities:
 *  1. Generate declaration XML in the КГД-required format (Form 910/912/200/ESP).
 *  2. Submit the NCALayer-signed XML to the КГД ИСНА API via Smart Bridge.
 *  3. Return the confirmation code (рег. номер) from КГД.
 *
 * ─── IMPORTANT: API credentials ──────────────────────────────────────────────
 *  Set these environment variables to enable real ИСНА submission:
 *    EGOV_ISNA_URL      – Smart Bridge endpoint, e.g. https://knp.kgd.gov.kz/api/fno
 *    EGOV_ISNA_TOKEN    – Developer Cabinet API token from portal.kgd.gov.kz
 *
 *  If these vars are absent, submitToISNA() throws EGovNotConfiguredError and
 *  the caller can store the signed XML for manual upload at knp.kgd.gov.kz.
 *
 * ─── Migration note ───────────────────────────────────────────────────────────
 *  СОНО (old system) is shut down on 01 May 2026. All new submissions MUST use
 *  the ИСНА system. See https://kgd.gov.kz/ru/content/api-integraciya-1
 *
 * ─── NCALayer note ────────────────────────────────────────────────────────────
 *  The signed XML comes from the frontend via NCALayer (user's local signing app).
 *  This service does NOT perform signing — it only submits an already-signed doc.
 */

import axios from 'axios'
import { logger } from '@utils/logger'
import { createExternalCircuit } from '@utils/circuitBreaker'
import {
  DeclarationLabelKey,
  TaxTermKey,
  declarationLabel,
  taxTerm,
  type TaxLanguage,
} from 'nalogai-shared/constants/taxTerminology'
import { buildForm910ExportData } from '@services/Form910ExportData'

// ── Custom errors ──────────────────────────────────────────────────────────────

export class EGovNotConfiguredError extends Error {
  constructor() {
    super(
      'ИСНА API не настроен. Установите EGOV_ISNA_URL и EGOV_ISNA_TOKEN в .env. ' +
      'Подпись сохранена — загрузите XML вручную на knp.kgd.gov.kz.'
    )
    this.name = 'EGovNotConfiguredError'
  }
}

export class EGovSubmissionError extends Error {
  constructor(
    message: string,
    public readonly kgdCode?: string,
  ) {
    super(message)
    this.name = 'EGovSubmissionError'
  }
}

// ── Period helpers ─────────────────────────────────────────────────────────────

interface PeriodMeta {
  year: number
  periodType: 'QUARTER' | 'HALF_YEAR' | 'YEAR' | 'MONTH'
  periodNum: number // 1–4 for quarters, 1–2 for half-years, 1–12 for months, 0 for year
}

function parsePeriod(period: string): PeriodMeta {
  const qm = /^(\d{4})-Q([1-4])$/.exec(period)
  if (qm) {
    return { year: parseInt(qm[1]!, 10), periodType: 'QUARTER', periodNum: parseInt(qm[2]!, 10) }
  }
  const mm = /^(\d{4})-(\d{2})$/.exec(period)
  if (mm) {
    return { year: parseInt(mm[1]!, 10), periodType: 'MONTH', periodNum: parseInt(mm[2]!, 10) }
  }
  const ym = /^(\d{4})$/.exec(period)
  if (ym) {
    return { year: parseInt(ym[1]!, 10), periodType: 'YEAR', periodNum: 0 }
  }
  throw new Error(`Unknown period format: ${period}`)
}

const DEFAULT_DECLARATION_LANGUAGE: TaxLanguage = 'ru'

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlComment(text: string): string {
  return `<!-- ${text.replace(/--/g, '- -')} -->`
}

function declarationMetadata(formCode: string, language: TaxLanguage): string {
  return xmlComment(
    `${declarationLabel(DeclarationLabelKey.GeneratedMetadata, language)}: form=${formCode}; language=${language}; generatedAt=${new Date().toISOString()}`,
  )
}

function labelComment(code: string, label: string): string {
  return xmlComment(`${code} — ${label}`)
}

// ── XML generators ─────────────────────────────────────────────────────────────

export interface Form910Data {
  iin: string
  fullName: string
  period: string
  incomeCode?: string       // Form 910.00 general classifier; defaults to business income
  activityCodes?: string[]
  activityCode?: string     // Main OKED/activity code when available
  secondaryActivityCode?: string
  grossIncome: number      // Total income for the period
  incomeTax: number        // IPN share for simplified regime, or total 3% if socialTax is absent
  socialTax?: number       // Social tax share for simplified regime
  transferPricingIncome?: number
  taxAdjustment?: number
  avgMonthlySalary?: number
  pensionContrib: number   // OPV
  medicalInsurance: number // ОСМС
  employeeCount: number    // 0 for sole proprietors without staff
  totalObligations?: number
  language?: TaxLanguage
}

/**
 * Generate Form 910.00 XML (Упрощённая декларация).
 *
 * XML form target: form_910_00_v27_r133.
 * Source: КГД МФ РК form structure; no XSD is bundled with this repository.
 *
 * ⚠️ Verify the exact XSD against current КГД documentation before production use:
 *    https://portal.kgd.gov.kz/ru/pages/api-services
 */
export function generateForm910XML(data: Form910Data): string {
  const language = data.language ?? DEFAULT_DECLARATION_LANGUAGE
  const form = buildForm910ExportData({
    iin: data.iin,
    fullName: data.fullName,
    period: data.period,
    grossIncome: data.grossIncome,
    simplifiedTax: data.incomeTax + (data.socialTax ?? 0),
    incomeTax: data.socialTax == null ? Math.round(data.incomeTax / 2) : data.incomeTax,
    socialTax: data.socialTax == null ? Math.round(data.incomeTax - Math.round(data.incomeTax / 2)) : data.socialTax,
    pensionContrib: data.pensionContrib,
    medicalInsurance: data.medicalInsurance,
    employeeCount: data.employeeCount,
    totalObligations: data.totalObligations,
    incomeCode: data.incomeCode,
    activityCodes: data.activityCodes ?? [data.activityCode, data.secondaryActivityCode].filter((code): code is string => Boolean(code)),
    transferPricingIncome: data.transferPricingIncome,
    taxAdjustment: data.taxAdjustment,
    avgMonthlySalary: data.avgMonthlySalary,
  })
  const rows = form.rows
  const activityCodesXml = form.activityCodes
    .map((code) => `      <activityCode>${escapeXml(code)}</activityCode>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
${declarationMetadata('910.00', language)}
${xmlComment(declarationLabel(DeclarationLabelKey.Form910Title, language))}
<F910 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <general>
    ${xmlComment(declarationLabel(DeclarationLabelKey.GeneralSection, language))}
    ${labelComment('tin', declarationLabel(DeclarationLabelKey.Tin, language))}
    <tin>${escapeXml(form.iin)}</tin>
    ${labelComment('name', declarationLabel(DeclarationLabelKey.TaxpayerName, language))}
    <name>${escapeXml(form.fullName)}</name>
    ${labelComment('year', declarationLabel(DeclarationLabelKey.ReportingYear, language))}
    <year>${form.year}</year>
    ${labelComment('period', declarationLabel(DeclarationLabelKey.ReportingPeriod, language))}
    <period>${form.period}</period>
    ${labelComment('periodType', declarationLabel(DeclarationLabelKey.PeriodType, language))}
    <periodType>${form.periodType}</periodType>
    ${labelComment('isFirstDelivery', declarationLabel(DeclarationLabelKey.FirstDelivery, language))}
    <isFirstDelivery>${form.isFirstDelivery}</isFirstDelivery>
    ${labelComment('incomeCode', 'Form 910.00 income type code')}
    <incomeCode>${escapeXml(form.incomeCode)}</incomeCode>
    ${labelComment('activityCodes', 'Activity codes (OKED)')}
    <activityCodes>
${activityCodesXml}
    </activityCodes>
    ${labelComment('version', declarationLabel(DeclarationLabelKey.Version, language))}
    <version>${form.version}</version>
    ${labelComment('revision', 'Schema revision')}
    <revision>${form.revision}</revision>
  </general>
  <f910_00>
    ${xmlComment(declarationLabel(DeclarationLabelKey.Form910Section, language))}
    ${labelComment('910.00.001', taxTerm(TaxTermKey.TotalIncome, language))}
    <row1>${rows.row1}</row1>
    ${labelComment('910.00.002', 'Income adjustment under transfer-pricing rules')}
    <row2>${rows.row2}</row2>
    ${labelComment('910.00.003', taxTerm(TaxTermKey.EmployeeCount, language))}
    <row3>${rows.row3}</row3>
    ${labelComment('910.00.004', 'Average monthly salary per employee')}
    <row4>${rows.row4}</row4>
    ${labelComment('910.00.005', `${taxTerm(TaxTermKey.CalculatedTax, language)} (910.00.001 x 3%)`)}
    <row5>${rows.row5}</row5>
    ${labelComment('910.00.006', 'Tax adjustment under the Tax Code')}
    <row6>${rows.row6}</row6>
    ${labelComment('910.00.007', 'Tax after adjustment (910.00.005 - 910.00.006)')}
    <row7>${rows.row7}</row7>
    ${labelComment('910.00.008', taxTerm(TaxTermKey.IndividualIncomeTax, language))}
    <row8>${rows.row8}</row8>
    ${labelComment('910.00.009', taxTerm(TaxTermKey.SocialTax, language))}
    <row9>${rows.row9}</row9>
    ${labelComment('910.00.010', 'Income for social contributions calculation')}
    <row10>${rows.row10}</row10>
    ${labelComment('910.00.011', 'Social contributions payable')}
    <row11>${rows.row11}</row11>
    ${labelComment('910.00.012', 'Income for mandatory pension contributions calculation')}
    <row12>${rows.row12}</row12>
    ${labelComment('910.00.013', taxTerm(TaxTermKey.MandatoryPensionContributions, language))}
    <row13>${rows.row13}</row13>
    ${labelComment('910.00.014', 'Income for mandatory social health insurance calculation')}
    <row14>${rows.row14}</row14>
    ${labelComment('910.00.015', taxTerm(TaxTermKey.MandatorySocialHealthInsurance, language))}
    <row15>${rows.row15}</row15>
    ${labelComment('910.00.total', taxTerm(TaxTermKey.TotalObligations, language))}
    <totalObligations>${form.totalObligations}</totalObligations>
  </f910_00>
</F910>`
}

/**
 * Generate Form 200.00 XML (Общий режим ИПН — Individual Income Tax).
 * Annual form. Filed by March 31 of the following year.
 *
 * ⚠️ This is a simplified template. Full Form 200 has many appendices.
 *    Verify against current КГД XSD for production use.
 */
export function generateForm200XML(data: {
  iin: string
  fullName: string
  period: string
  grossIncome: number
  taxableIncome: number
  incomeTax: number        // 10% of taxableIncome
  pensionContrib: number
  medicalInsurance: number
  deductions: number
  language?: TaxLanguage
}): string {
  const p = parsePeriod(data.period)
  const language = data.language ?? DEFAULT_DECLARATION_LANGUAGE

  return `<?xml version="1.0" encoding="UTF-8"?>
${declarationMetadata('200.00', language)}
${xmlComment(declarationLabel(DeclarationLabelKey.Form200Title, language))}
<F200 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <general>
    ${xmlComment(declarationLabel(DeclarationLabelKey.GeneralSection, language))}
    ${labelComment('tin', declarationLabel(DeclarationLabelKey.Tin, language))}
    <tin>${escapeXml(data.iin)}</tin>
    ${labelComment('name', declarationLabel(DeclarationLabelKey.TaxpayerName, language))}
    <name>${escapeXml(data.fullName)}</name>
    ${labelComment('year', declarationLabel(DeclarationLabelKey.ReportingYear, language))}
    <year>${p.year}</year>
    ${labelComment('version', declarationLabel(DeclarationLabelKey.Version, language))}
    <version>28</version>
  </general>
  <f200_00>
    ${xmlComment(declarationLabel(DeclarationLabelKey.Form200Section, language))}
    ${labelComment('200.00.001', taxTerm(TaxTermKey.GrossIncome, language))}
    <row1>${Math.round(data.grossIncome)}</row1>
    ${labelComment('200.00.002', declarationLabel(DeclarationLabelKey.TotalDeductions, language))}
    <row2>${Math.round(data.deductions)}</row2>
    ${labelComment('200.00.003', taxTerm(TaxTermKey.TaxableIncome, language))}
    <row3>${Math.round(data.taxableIncome)}</row3>
    ${labelComment('200.00.004', `${taxTerm(TaxTermKey.IndividualIncomeTax, language)} (10%)`)}
    <row4>${Math.round(data.incomeTax)}</row4>
    ${labelComment('200.00.005', taxTerm(TaxTermKey.MandatoryPensionContributions, language))}
    <row5>${Math.round(data.pensionContrib)}</row5>
    ${labelComment('200.00.006', taxTerm(TaxTermKey.MandatorySocialHealthInsurance, language))}
    <row6>${Math.round(data.medicalInsurance)}</row6>
    ${labelComment('200.00.007', taxTerm(TaxTermKey.TotalObligations, language))}
    <row7>${Math.round(data.incomeTax + data.pensionContrib + data.medicalInsurance)}</row7>
  </f200_00>
</F200>`
}

// ── ИСНА submission ────────────────────────────────────────────────────────────

export interface ISNASubmitResult {
  confirmationCode: string  // КГД reg number (рег. номер)
  status: string            // e.g. "ACCEPTED", "PROCESSING"
  timestamp: string         // ISO timestamp from КГД
}

type ISNASubmitResponse = {
  success: boolean
  regNumber?: string
  status?: string
  timestamp?: string
  errorCode?: string
  errorMessage?: string
}

type ISNAStatusResponse = {
  status: 'PROCESSING' | 'ACCEPTED' | 'REJECTED'
  message?: string
}

const submitToISNACircuit = createExternalCircuit(
  'egov.isna.submit',
  async (
    baseUrl: string,
    token: string,
    payload: { iin: string; formType: string; signedXml: string },
  ): Promise<ISNASubmitResponse> => {
    const response = await axios.post<ISNASubmitResponse>(
      `${baseUrl}/submit`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Service-Key': 'FNO_INTEGRATION',
        },
        timeout: 30_000,
      },
    )
    return response.data
  },
  {
    timeoutMs: Number(process.env.EGOV_BREAKER_SUBMIT_TIMEOUT_MS ?? 35_000),
    resetTimeoutMs: Number(process.env.EGOV_BREAKER_RESET_MS ?? 30_000),
    errorThresholdPercentage: Number(process.env.EGOV_BREAKER_ERROR_THRESHOLD ?? 50),
    volumeThreshold: Number(process.env.EGOV_BREAKER_VOLUME_THRESHOLD ?? 3),
  },
)

const queryISNAStatusCircuit = createExternalCircuit(
  'egov.isna.status',
  async (baseUrl: string, token: string, confirmationCode: string): Promise<ISNAStatusResponse> => {
    const response = await axios.get<ISNAStatusResponse>(
      `${baseUrl}/status/${confirmationCode}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Service-Key': 'FNO_INTEGRATION_STATUS',
        },
        timeout: 15_000,
      },
    )
    return response.data
  },
  {
    timeoutMs: Number(process.env.EGOV_BREAKER_STATUS_TIMEOUT_MS ?? 20_000),
    resetTimeoutMs: Number(process.env.EGOV_BREAKER_RESET_MS ?? 30_000),
    errorThresholdPercentage: Number(process.env.EGOV_BREAKER_ERROR_THRESHOLD ?? 50),
    volumeThreshold: Number(process.env.EGOV_BREAKER_VOLUME_THRESHOLD ?? 3),
  },
)

/**
 * Submit a NCALayer-signed XML declaration to the КГД ИСНА system.
 *
 * The `signedXml` must be an XML document with an embedded XMLDSig signature,
 * as produced by NCALayer's `signXml` method (GOST3410-2015 algorithm).
 *
 * Smart Bridge service keys:
 *   FNO_INTEGRATION        — submit declaration
 *   FNO_INTEGRATION_STATUS — query submission status
 *
 * Requires env vars: EGOV_ISNA_URL, EGOV_ISNA_TOKEN
 */
export async function submitToISNA(
  signedXml: string,
  iin: string,
  formType: string,
): Promise<ISNASubmitResult> {
  const baseUrl = process.env.EGOV_ISNA_URL
  const token   = process.env.EGOV_ISNA_TOKEN

  if (!baseUrl || !token) {
    throw new EGovNotConfiguredError()
  }

  try {
    const data = await submitToISNACircuit(baseUrl, token, {
      iin,
      formType,
      signedXml,   // Base64-encoded or raw signed XML — verify with КГД docs
    })

    if (!data.success || !data.regNumber) {
      throw new EGovSubmissionError(
        data.errorMessage ?? 'ИСНА вернул ошибку без описания',
        data.errorCode,
      )
    }

    return {
      confirmationCode: data.regNumber,
      status:    data.status    ?? 'ACCEPTED',
      timestamp: data.timestamp ?? new Date().toISOString(),
    }
  } catch (err) {
    if (err instanceof EGovSubmissionError || err instanceof EGovNotConfiguredError) {
      throw err
    }
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as { errorMessage?: string })?.errorMessage
        ?? err.message
      logger.error(`ИСНА API request failed: ${err.message}`, { err })
      throw new EGovSubmissionError(`Ошибка связи с ИСНА: ${msg}`)
    }
    throw err
  }
}

/**
 * Poll ИСНА for the current status of a submitted declaration.
 * Call this after submitToISNA() to check if the declaration was accepted.
 */
export async function queryISNAStatus(confirmationCode: string): Promise<{
  status: 'PROCESSING' | 'ACCEPTED' | 'REJECTED'
  message?: string
}> {
  const baseUrl = process.env.EGOV_ISNA_URL
  const token   = process.env.EGOV_ISNA_TOKEN

  if (!baseUrl || !token) {
    throw new EGovNotConfiguredError()
  }

  return queryISNAStatusCircuit(baseUrl, token, confirmationCode)
}
