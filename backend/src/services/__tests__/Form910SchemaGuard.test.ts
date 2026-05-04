import { describe, expect, it } from 'vitest'
import { generateForm910XML } from '../EGovService'
import { validateAgainstMockForm910Xsd } from './fixtures/form910V27R133XsdMock'

describe('Form 910.00 XML schema guard — KGD form_910_00_v27_r133 mock', () => {
  const validForm910Input = {
    iin: '123456789012',
    fullName: 'ТОО Schema Guard',
    period: '2026-Q1',
    incomeCode: '1',
    activityCode: '62011',
    secondaryActivityCode: '62012',
    grossIncome: 1_500_000,
    incomeTax: 45_000,
    pensionContrib: 150_000,
    medicalInsurance: 25_500,
    employeeCount: 2,
  }

  it('matches the mandatory structure mocked from KGD form_910_00_v27_r133', () => {
    const xml = generateForm910XML(validForm910Input)

    expect(validateAgainstMockForm910Xsd(xml)).toEqual([])
  })

  it('fails schema validation when a mandatory general field is missing', () => {
    const xml = generateForm910XML(validForm910Input)
      .replace(/\s*<!-- periodType[\s\S]*?-->\s*<periodType>H<\/periodType>/, '')

    expect(validateAgainstMockForm910Xsd(xml)).toContain(
      'Missing mandatory field F910.general.periodType',
    )
  })
})
