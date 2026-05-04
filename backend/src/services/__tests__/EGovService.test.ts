import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import {
  generateForm910XML,
  generateForm200XML,
  submitToISNA,
  queryISNAStatus,
  EGovNotConfiguredError,
  EGovSubmissionError,
} from '../EGovService'

vi.mock('axios')

describe('EGovService — generateForm910XML', () => {
  it('generates valid XML for quarterly period (Q1 → halfYear=1)', () => {
    const xml = generateForm910XML({
      iin: '123456789012', fullName: 'Иванов Иван',
      period: '2025-Q1', grossIncome: 1_000_000,
      incomeTax: 30_000, pensionContrib: 100_000,
      medicalInsurance: 17_850, employeeCount: 0,
    })
    expect(xml).toContain('<period>1</period>')
    expect(xml).toContain('<periodType>H</periodType>')
    expect(xml).toContain('<row1>1000000</row1>')
    expect(xml).toContain('<row5>30000</row5>')
    expect(xml).toContain('<row13>100000</row13>')
    expect(xml).toContain('<row15>17850</row15>')
  })

  it('maps Q3/Q4 to halfYear=2', () => {
    const xml = generateForm910XML({
      iin: '000000000000', fullName: 'Test', period: '2025-Q3',
      grossIncome: 0, incomeTax: 0, pensionContrib: 0,
      medicalInsurance: 0, employeeCount: 0,
    })
    expect(xml).toContain('<period>2</period>')
  })

  it('escapes XML special characters in name', () => {
    const xml = generateForm910XML({
      iin: '000000000000', fullName: 'Test & <Corp>',
      period: '2025-Q1', grossIncome: 0, incomeTax: 0,
      pensionContrib: 0, medicalInsurance: 0, employeeCount: 0,
    })
    expect(xml).toContain('Test &amp; &lt;Corp&gt;')
    expect(xml).not.toContain('Test & <Corp>')
  })

  it('rounds fractional monetary values', () => {
    const xml = generateForm910XML({
      iin: '000000000000', fullName: 'Test', period: '2025-Q1',
      grossIncome: 1_234_567.89, incomeTax: 37_037.04,
      pensionContrib: 123_456.78, medicalInsurance: 17_849.99,
      employeeCount: 0,
    })
    expect(xml).toContain('<row1>1234568</row1>')
    expect(xml).toContain('<row5>37037</row5>')
  })

  it('includes year in general block', () => {
    const xml = generateForm910XML({
      iin: '000000000000', fullName: 'Test', period: '2025-Q2',
      grossIncome: 5_000_000, incomeTax: 150_000,
      pensionContrib: 500_000, medicalInsurance: 71_400, employeeCount: 0,
    })
    expect(xml).toContain('<year>2025</year>')
  })

  it('localizes Form 910 metadata and labels in Kazakh', () => {
    const xml = generateForm910XML({
      iin: '000000000000', fullName: 'Test', period: '2025-Q2',
      grossIncome: 5_000_000, incomeTax: 150_000,
      pensionContrib: 500_000, medicalInsurance: 71_400, employeeCount: 0,
      language: 'kk',
    })
    expect(xml).toContain('910.00 нысаны')
    expect(xml).toContain('Жеке табыс салығы')
    expect(xml).toContain('language=kk')
  })

  it('throws on unrecognized period format', () => {
    expect(() =>
      generateForm910XML({
        iin: '000000000000', fullName: 'Test', period: 'bad-period',
        grossIncome: 0, incomeTax: 0, pensionContrib: 0,
        medicalInsurance: 0, employeeCount: 0,
      })
    ).toThrow('Unknown period format: bad-period')
  })
})

describe('EGovService — generateForm200XML', () => {
  it('generates annual Form 200 with correct field values', () => {
    const xml = generateForm200XML({
      iin: '123456789012', fullName: 'Петров Пётр', period: '2025',
      grossIncome: 10_000_000, taxableIncome: 9_944_952,
      incomeTax: 994_495, pensionContrib: 1_000_000,
      medicalInsurance: 71_400, deductions: 55_048,
    })
    expect(xml).toContain('<row1>10000000</row1>')
    expect(xml).toContain('<row2>55048</row2>')
    expect(xml).toContain('<row3>9944952</row3>')
    expect(xml).toContain('<row4>994495</row4>')
    expect(xml).toContain('<row5>1000000</row5>')
    expect(xml).toContain('<row6>71400</row6>')
  })

  it('escapes special characters in fullName', () => {
    const xml = generateForm200XML({
      iin: '000000000000', fullName: 'ТОО "Рога & Копыта"', period: '2025',
      grossIncome: 0, taxableIncome: 0, incomeTax: 0,
      pensionContrib: 0, medicalInsurance: 0, deductions: 0,
    })
    expect(xml).toContain('ТОО &quot;Рога &amp; Копыта&quot;')
    expect(xml).not.toContain('"Рога & Копыта"')
  })

  it('localizes Form 200 metadata and labels in Kazakh', () => {
    const xml = generateForm200XML({
      iin: '000000000000', fullName: 'Test', period: '2025',
      grossIncome: 0, taxableIncome: 0, incomeTax: 0,
      pensionContrib: 0, medicalInsurance: 0, deductions: 0,
      language: 'kk',
    })
    expect(xml).toContain('200.00 нысаны')
    expect(xml).toContain('Жеке табыс салығы')
    expect(xml).toContain('language=kk')
  })
})

describe('EGovService — submitToISNA', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
    vi.resetAllMocks()
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('throws EGovNotConfiguredError when both env vars are absent', async () => {
    delete process.env['EGOV_ISNA_URL']
    delete process.env['EGOV_ISNA_TOKEN']
    await expect(submitToISNA('<xml/>', '123456789012', 'FORM_910'))
      .rejects.toBeInstanceOf(EGovNotConfiguredError)
  })

  it('throws EGovNotConfiguredError when only URL is set', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    delete process.env['EGOV_ISNA_TOKEN']
    await expect(submitToISNA('<xml/>', '123456789012', 'FORM_910'))
      .rejects.toBeInstanceOf(EGovNotConfiguredError)
  })

  it('returns confirmation code and status on success', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        regNumber: 'REG-2025-001',
        status: 'ACCEPTED',
        timestamp: '2025-04-29T10:00:00Z',
      },
    })
    const result = await submitToISNA('<xml/>', '123456789012', 'FORM_910')
    expect(result.confirmationCode).toBe('REG-2025-001')
    expect(result.status).toBe('ACCEPTED')
    expect(result.timestamp).toBe('2025-04-29T10:00:00Z')
  })

  it('throws EGovSubmissionError when КГД returns success=false', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        success: false,
        errorCode: 'INVALID_IIN',
        errorMessage: 'ИИН не найден в базе КГД',
      },
    })
    await expect(submitToISNA('<xml/>', '000000000000', 'FORM_910'))
      .rejects.toBeInstanceOf(EGovSubmissionError)
  })

  it('throws EGovSubmissionError when success=true but regNumber is absent', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { success: true }, // regNumber missing
    })
    await expect(submitToISNA('<xml/>', '123456789012', 'FORM_910'))
      .rejects.toBeInstanceOf(EGovSubmissionError)
  })

  it('wraps Axios network errors in EGovSubmissionError', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    const axiosError = Object.assign(new Error('Network Error'), { isAxiosError: true })
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
    vi.spyOn(axios, 'post').mockRejectedValueOnce(axiosError)
    await expect(submitToISNA('<xml/>', '123456789012', 'FORM_910'))
      .rejects.toBeInstanceOf(EGovSubmissionError)
  })
})

describe('EGovService — queryISNAStatus', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
    vi.resetAllMocks()
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('throws EGovNotConfiguredError when not configured', async () => {
    delete process.env['EGOV_ISNA_URL']
    delete process.env['EGOV_ISNA_TOKEN']
    await expect(queryISNAStatus('REG-2025-001'))
      .rejects.toBeInstanceOf(EGovNotConfiguredError)
  })

  it('returns ACCEPTED status from КГД', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { status: 'ACCEPTED', message: 'Декларация принята' },
    })
    const result = await queryISNAStatus('REG-2025-001')
    expect(result.status).toBe('ACCEPTED')
    expect(result.message).toBe('Декларация принята')
  })

  it('returns PROCESSING status while КГД is reviewing', async () => {
    process.env['EGOV_ISNA_URL'] = 'https://knp.kgd.gov.kz/api/fno'
    process.env['EGOV_ISNA_TOKEN'] = 'test-token'
    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { status: 'PROCESSING' },
    })
    const result = await queryISNAStatus('REG-2025-001')
    expect(result.status).toBe('PROCESSING')
  })
})
