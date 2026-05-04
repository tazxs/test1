import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type { TaxCalculationResult } from 'nalogai-shared/types/declaration.types'
import { MRP } from 'nalogai-shared/constants/taxRates'
import type { SupportedLanguage } from '@utils/language'
import {
  buildForm910ExportData,
  type Form910ExportData,
  type Form910RowKey,
} from '@services/Form910ExportData'

type Form910PdfData = {
  declarationId: string
  iin: string
  fullName: string
  period: string
  calculation: TaxCalculationResult
  language: SupportedLanguage
  employeeCount?: number
  incomeCode?: string
  activityCodes?: string[]
  generatedAt?: Date
}

type TextStyle = {
  font?: 'regular' | 'bold'
  size?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}

const PAGE = { width: 595.28, height: 841.89 }
const FONT_REGULAR = 'NotoSans'
const FONT_BOLD = 'NotoSans-Bold'

const LABELS: Record<SupportedLanguage, {
  title: string
  subtitle: string
  page: string
  appendix: string
  general: string
  taxPeriod: string
  halfYear: string
  year: string
  declarationType: string
  initial: string
  additional: string
  notification: string
  liquidation: string
  iin: string
  name: string
  category: string
  resident: string
  currency: string
  currencyKzt: string
  incomeSection: string
  taxesSection: string
  socialSection: string
  responsibility: string
  code: string
  indicator: string
  value: string
  signature: string
  date: string
  kgdCode: string
  generated: string
  mrp: string
}> = {
  kk: {
    title: 'ОҢАЙЛАТЫЛҒАН ДЕКЛАРАЦИЯ',
    subtitle: 'ШАҒЫН БИЗНЕС СУБЪЕКТІЛЕРІ ҮШІН',
    page: '910.00-нысан, бет',
    appendix: 'Қазақстан Республикасы Қаржы министрлігінің нысаны',
    general: 'Бөлім. Салық төлеуші туралы жалпы ақпарат',
    taxPeriod: 'Салық есептілігі ұсынылатын салық кезеңі',
    halfYear: 'жартыжылдық',
    year: 'жыл',
    declarationType: 'Декларация түрі',
    initial: 'бастапқы',
    additional: 'қосымша',
    notification: 'хабарлама бойынша қосымша',
    liquidation: 'тарату',
    iin: 'ЖСН (БСН)',
    name: 'Салық төлеушінің аты-жөні немесе атауы',
    category: 'Салық төлеушінің санаты',
    resident: 'Резиденттік белгісі',
    currency: 'Валюта коды',
    currencyKzt: 'KZT - теңге',
    incomeSection: 'Бөлім. Кіріс',
    taxesSection: 'Бөлім. Салықтарды есептеу',
    socialSection: 'Бөлім. Әлеуметтік төлемдер және міндетті жарналар',
    responsibility: 'Бөлім. Салық төлеушінің жауапкершілігі',
    code: 'Жол коды',
    indicator: 'Көрсеткіш атауы',
    value: 'Сома, теңге',
    signature: 'Қолы',
    date: 'Күні',
    kgdCode: 'Мемлекеттік кірістер органының коды',
    generated: 'NalogAI қалыптастырды',
    mrp: 'АЕК',
  },
  ru: {
    title: 'УПРОЩЕННАЯ ДЕКЛАРАЦИЯ',
    subtitle: 'ДЛЯ СУБЪЕКТОВ МАЛОГО БИЗНЕСА',
    page: 'Форма 910.00, стр.',
    appendix: 'Форма Министерства финансов Республики Казахстан',
    general: 'Раздел. Общая информация о налогоплательщике',
    taxPeriod: 'Налоговый период, за который представляется налоговая отчетность',
    halfYear: 'полугодие',
    year: 'год',
    declarationType: 'Вид декларации',
    initial: 'первоначальная',
    additional: 'дополнительная',
    notification: 'дополнительная по уведомлению',
    liquidation: 'ликвидационная',
    iin: 'ИИН (БИН)',
    name: 'Ф.И.О. или наименование налогоплательщика',
    category: 'Категория налогоплательщика',
    resident: 'Признак резидентства',
    currency: 'Код валюты',
    currencyKzt: 'KZT - тенге',
    incomeSection: 'Раздел. Доход',
    taxesSection: 'Раздел. Исчисление налогов',
    socialSection: 'Раздел. Социальные платежи и обязательные взносы',
    responsibility: 'Раздел. Ответственность налогоплательщика',
    code: 'Код строки',
    indicator: 'Наименование показателя',
    value: 'Сумма, тенге',
    signature: 'Подпись',
    date: 'Дата',
    kgdCode: 'Код органа государственных доходов',
    generated: 'Сформировано NalogAI',
    mrp: 'МРП',
  },
  en: {
    title: 'SIMPLIFIED DECLARATION',
    subtitle: 'FOR SMALL BUSINESS ENTITIES',
    page: 'Form 910.00, page',
    appendix: 'Ministry of Finance of the Republic of Kazakhstan form',
    general: 'Section. General taxpayer information',
    taxPeriod: 'Tax period for which tax reporting is submitted',
    halfYear: 'half-year',
    year: 'year',
    declarationType: 'Declaration type',
    initial: 'initial',
    additional: 'additional',
    notification: 'additional by notice',
    liquidation: 'liquidation',
    iin: 'IIN (BIN)',
    name: 'Taxpayer full name or legal name',
    category: 'Taxpayer category',
    resident: 'Residency attribute',
    currency: 'Currency code',
    currencyKzt: 'KZT - tenge',
    incomeSection: 'Section. Income',
    taxesSection: 'Section. Tax calculation',
    socialSection: 'Section. Social payments and mandatory contributions',
    responsibility: 'Section. Taxpayer responsibility',
    code: 'Line code',
    indicator: 'Indicator name',
    value: 'Amount, KZT',
    signature: 'Signature',
    date: 'Date',
    kgdCode: 'State revenue authority code',
    generated: 'Generated by NalogAI',
    mrp: 'MRP',
  },
}

const ROWS: Array<{ code: string; labelKey: keyof ReturnType<typeof rowLabels>; rowKey: Form910RowKey }> = [
  { code: '910.00.001', labelKey: 'totalIncome', rowKey: 'row1' },
  { code: '910.00.002', labelKey: 'transferPricingIncome', rowKey: 'row2' },
  { code: '910.00.003', labelKey: 'employeeCount', rowKey: 'row3' },
  { code: '910.00.004', labelKey: 'avgMonthlySalary', rowKey: 'row4' },
  { code: '910.00.005', labelKey: 'calculatedTax', rowKey: 'row5' },
  { code: '910.00.006', labelKey: 'taxAdjustment', rowKey: 'row6' },
  { code: '910.00.007', labelKey: 'taxAfterAdjustment', rowKey: 'row7' },
  { code: '910.00.008', labelKey: 'individualIncomeTax', rowKey: 'row8' },
  { code: '910.00.009', labelKey: 'socialTax', rowKey: 'row9' },
  { code: '910.00.010', labelKey: 'socialContributionIncome', rowKey: 'row10' },
  { code: '910.00.011', labelKey: 'socialContributions', rowKey: 'row11' },
  { code: '910.00.012', labelKey: 'pensionIncome', rowKey: 'row12' },
  { code: '910.00.013', labelKey: 'pension', rowKey: 'row13' },
  { code: '910.00.014', labelKey: 'medicalIncome', rowKey: 'row14' },
  { code: '910.00.015', labelKey: 'medical', rowKey: 'row15' },
]

function rowLabels(language: SupportedLanguage) {
  if (language === 'kk') {
    return {
      totalIncome: 'Кірістер жиыны',
      transferPricingIncome: 'Трансферттік баға белгілеу бойынша түзету',
      calculatedTax: 'Есептелген салық сомасы (910.00.001 x 3%)',
      employeeCount: 'Қызметкерлердің орташа тізімдік саны',
      avgMonthlySalary: 'Бір қызметкерге шаққандағы орташа айлық жалақы',
      taxAdjustment: 'Салық сомасын түзету',
      taxAfterAdjustment: 'Түзетуден кейінгі салық сомасы',
      pension: 'Міндетті зейнетақы жарналарының сомасы',
      socialTax: 'Бюджетке төленуге жататын әлеуметтік салық сомасы',
      individualIncomeTax: 'Жеке табыс салығы',
      socialContributionIncome: 'Әлеуметтік аударымдарды есептеуге арналған кіріс',
      socialContributions: 'Төленуге жататын әлеуметтік аударымдар',
      pensionIncome: 'Зейнетақы жарналарын есептеуге арналған кіріс',
      medicalIncome: 'МӘМС жарналарын есептеуге арналған кіріс',
      medical: 'Міндетті әлеуметтік медициналық сақтандыру жарналары',
    }
  }
  if (language === 'en') {
    return {
      totalIncome: 'Total income',
      transferPricingIncome: 'Transfer-pricing income adjustment',
      calculatedTax: 'Calculated tax amount (910.00.001 x 3%)',
      employeeCount: 'Average number of employees',
      avgMonthlySalary: 'Average monthly salary per employee',
      taxAdjustment: 'Tax amount adjustment',
      taxAfterAdjustment: 'Tax after adjustment',
      pension: 'Mandatory pension contributions payable',
      socialTax: 'Social tax payable to the budget',
      individualIncomeTax: 'Individual income tax',
      socialContributionIncome: 'Income for social contributions calculation',
      socialContributions: 'Social contributions payable',
      pensionIncome: 'Income for mandatory pension contributions calculation',
      medicalIncome: 'Income for mandatory health insurance calculation',
      medical: 'Mandatory social health insurance contributions',
    }
  }
  return {
    totalIncome: 'Доход',
    transferPricingIncome: 'Корректировка дохода по трансфертному ценообразованию',
    calculatedTax: 'Сумма исчисленных налогов (910.00.001 x 3%)',
    employeeCount: 'Среднесписочная численность работников',
    avgMonthlySalary: 'Среднемесячная заработная плата на одного работника',
    taxAdjustment: 'Корректировка суммы налога',
    taxAfterAdjustment: 'Сумма налога после корректировки',
    pension: 'Сумма обязательных пенсионных взносов к уплате',
    socialTax: 'Сумма социального налога, подлежащего уплате в бюджет',
    individualIncomeTax: 'Индивидуальный подоходный налог',
    socialContributionIncome: 'Доход для исчисления социальных отчислений',
    socialContributions: 'Сумма социальных отчислений к уплате',
    pensionIncome: 'Доход для исчисления обязательных пенсионных взносов',
    medicalIncome: 'Доход для исчисления взносов ОСМС',
    medical: 'Сумма взносов на обязательное социальное медицинское страхование',
  }
}

function buildPdfExportData(data: Form910PdfData): Form910ExportData {
  return buildForm910ExportData({
    iin: data.iin,
    fullName: data.fullName,
    period: data.period,
    grossIncome: data.calculation.grossIncome,
    simplifiedTax: data.calculation.incomeTax + data.calculation.socialTax,
    incomeTax: data.calculation.incomeTax,
    socialTax: data.calculation.socialTax,
    pensionContrib: data.calculation.pensionContribution,
    medicalInsurance: data.calculation.medicalInsurance,
    employeeCount: data.employeeCount ?? 0,
    totalObligations: data.calculation.totalTaxBurden,
    incomeCode: data.incomeCode,
    activityCodes: data.activityCodes,
  })
}

// Cache resolved font paths at module level to avoid fs.existsSync on every PDF
const fontPathCache = new Map<string, string>()

function resolveFont(name: string): string {
  const cached = fontPathCache.get(name)
  if (cached) return cached

  const candidates = [
    path.resolve(process.cwd(), 'src/assets/fonts', name),
    path.resolve(process.cwd(), 'backend/src/assets/fonts', name),
    path.resolve(__dirname, '../assets/fonts', name),
    path.resolve(__dirname, '../../src/assets/fonts', name),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error(`PDF font asset not found: ${name}`)
  fontPathCache.set(name, found)
  return found
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('ru-KZ')
}

function write(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, style: TextStyle = {}) {
  doc
    .font(style.font === 'bold' ? FONT_BOLD : FONT_REGULAR)
    .fontSize(style.size ?? 8)
    .fillColor(style.color ?? '#111111')
    .text(text, x, y, { width, align: style.align ?? 'left', lineGap: 0.5 })
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, text = '', style: TextStyle = {}) {
  doc.save().lineWidth(0.6).strokeColor('#222222').rect(x, y, width, height).stroke().restore()
  if (text) write(doc, text, x + 3, y + 3, width - 6, { ...style, size: style.size ?? 8 })
}

function checkBox(doc: PDFKit.PDFDocument, x: number, y: number, label: string, checked = false) {
  doc.save().lineWidth(0.6).strokeColor('#222222').rect(x, y, 9, 9).stroke().restore()
  if (checked) write(doc, 'X', x + 1.8, y - 0.8, 9, { font: 'bold', size: 8 })
  write(doc, label, x + 13, y - 1, 120, { size: 7 })
}

function header(doc: PDFKit.PDFDocument, labels: (typeof LABELS)[SupportedLanguage], page: number) {
  write(doc, labels.appendix, 330, 26, 190, { size: 6.6, align: 'right' })
  write(doc, labels.title, 70, 48, 455, { font: 'bold', size: 13, align: 'center' })
  write(doc, labels.subtitle, 70, 64, 455, { font: 'bold', size: 10, align: 'center' })
  write(doc, `${labels.page} ${String(page).padStart(2, '0')}`, 420, 82, 105, { font: 'bold', size: 7, align: 'right' })
  doc.save().lineWidth(1).moveTo(42, 96).lineTo(553, 96).strokeColor('#111111').stroke().restore()
}

function drawPageOne(doc: PDFKit.PDFDocument, data: Form910PdfData) {
  const labels = LABELS[data.language]
  const rows = rowLabels(data.language)
  const exportData = buildPdfExportData(data)

  header(doc, labels, 1)
  write(doc, labels.general, 42, 108, 511, { font: 'bold', size: 9 })

  write(doc, `1. ${labels.taxPeriod}:`, 48, 128, 245, { size: 7.5 })
  box(doc, 294, 124, 28, 15, String(exportData.period), { font: 'bold', align: 'center' })
  write(doc, labels.halfYear, 326, 128, 72, { size: 7 })
  box(doc, 397, 124, 50, 15, String(exportData.year), { font: 'bold', align: 'center' })
  write(doc, labels.year, 451, 128, 45, { size: 7 })

  write(doc, `2. ${labels.declarationType}:`, 48, 154, 120, { size: 7.5 })
  checkBox(doc, 171, 153, labels.initial, true)
  checkBox(doc, 280, 153, labels.additional)
  checkBox(doc, 390, 153, labels.notification)
  checkBox(doc, 171, 170, labels.liquidation)

  write(doc, `3. ${labels.iin}`, 48, 199, 100, { size: 7.5 })
  box(doc, 150, 194, 140, 16, data.iin, { font: 'bold', size: 8.5, align: 'center' })
  write(doc, `4. ${labels.name}`, 48, 222, 180, { size: 7.5 })
  box(doc, 230, 216, 285, 20, data.fullName, { font: 'bold', size: 8 })

  write(doc, `5. ${labels.category}`, 48, 252, 120, { size: 7.5 })
  checkBox(doc, 171, 251, labels.category, true)
  write(doc, `6. ${labels.resident}`, 48, 274, 120, { size: 7.5 })
  checkBox(doc, 171, 273, '1', true)
  write(doc, `7. ${labels.currency}`, 330, 274, 90, { size: 7.5 })
  box(doc, 423, 268, 92, 17, labels.currencyKzt, { size: 7, align: 'center' })

  write(doc, labels.incomeSection, 42, 306, 511, { font: 'bold', size: 9 })
  doc.save().lineWidth(0.8).rect(42, 324, 511, 24).stroke().restore()
  write(doc, labels.code, 48, 331, 75, { font: 'bold', size: 7 })
  write(doc, labels.indicator, 130, 331, 300, { font: 'bold', size: 7 })
  write(doc, labels.value, 452, 331, 88, { font: 'bold', size: 7, align: 'right' })

  let y = 348
  for (const row of ROWS.slice(0, 3)) {
    const amount = formatAmount(exportData.rows[row.rowKey])
    doc.save().lineWidth(0.5).rect(42, y, 511, 22).stroke().restore()
    write(doc, row.code, 48, y + 6, 76, { size: 7 })
    write(doc, rows[row.labelKey], 130, y + 5, 285, { size: 7 })
    write(doc, amount, 425, y + 5, 115, { font: 'bold', size: 8, align: 'right' })
    y += 22
  }

  y += 16
  write(doc, labels.taxesSection, 42, y, 511, { font: 'bold', size: 9 })
  y += 18
  for (const row of ROWS.slice(3, 9)) {
    const amount = formatAmount(exportData.rows[row.rowKey])
    doc.save().lineWidth(0.5).rect(42, y, 511, 24).stroke().restore()
    write(doc, row.code, 48, y + 6, 76, { size: 7 })
    write(doc, rows[row.labelKey], 130, y + 5, 285, { size: 7 })
    write(doc, amount, 425, y + 5, 115, { font: 'bold', size: 8, align: 'right' })
    y += 24
  }

  write(doc, `${labels.generated}: ${data.declarationId}`, 42, 784, 250, { size: 6, color: '#555555' })
  write(doc, `${labels.mrp}: ${formatAmount(MRP)} KZT`, 315, 784, 238, { size: 6, color: '#555555', align: 'right' })
}

function drawPageTwo(doc: PDFKit.PDFDocument, data: Form910PdfData) {
  const labels = LABELS[data.language]
  const rows = rowLabels(data.language)
  const exportData = buildPdfExportData(data)

  header(doc, labels, 2)
  write(doc, `${labels.iin}: ${data.iin}`, 42, 112, 180, { font: 'bold', size: 8 })
  write(doc, `${labels.taxPeriod}: ${exportData.period} ${labels.halfYear}, ${exportData.year}`, 310, 112, 210, { size: 8, align: 'right' })

  write(doc, labels.socialSection, 42, 146, 511, { font: 'bold', size: 9 })
  const socialRows = ROWS.slice(9).map((row) => ({ ...row, label: rows[row.labelKey], amount: formatAmount(exportData.rows[row.rowKey]) }))
  let y = 166
  for (const row of socialRows) {
    doc.save().lineWidth(0.5).rect(42, y, 511, 28).stroke().restore()
    write(doc, row.code, 48, y + 8, 76, { size: 7 })
    write(doc, row.label, 130, y + 6, 285, { size: 7 })
    write(doc, row.amount, 425, y + 7, 115, { font: 'bold', size: 8, align: 'right' })
    y += 28
  }

  y += 34
  write(doc, labels.responsibility, 42, y, 511, { font: 'bold', size: 9 })
  y += 28
  box(doc, 42, y, 250, 32, data.fullName, { size: 8 })
  write(doc, labels.name, 42, y + 36, 250, { size: 6.5, align: 'center' })
  box(doc, 316, y, 100, 32)
  write(doc, labels.signature, 316, y + 36, 100, { size: 6.5, align: 'center' })
  box(doc, 438, y, 76, 32, (data.generatedAt ?? new Date()).toLocaleDateString('ru-KZ'), { size: 8, align: 'center' })
  write(doc, labels.date, 438, y + 36, 76, { size: 6.5, align: 'center' })

  y += 96
  write(doc, labels.kgdCode, 42, y, 180, { size: 7 })
  box(doc, 220, y - 5, 90, 18)
  write(doc, labels.date, 350, y, 60, { size: 7 })
  box(doc, 410, y - 5, 90, 18)

  write(doc, `${labels.generated}: ${new Date().toISOString()}`, 42, 784, 250, { size: 6, color: '#555555' })
  write(doc, 'NalogAI / KGD Form 910.00 visual export', 315, 784, 238, { size: 6, color: '#555555', align: 'right' })
}

export async function generateDeclarationPdf(data: Form910PdfData): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: {
      Title: 'Form 910.00',
      Subject: 'Simplified declaration for small business entities',
      Creator: 'NalogAI',
      Producer: 'NalogAI PDF Engine',
    } })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont(FONT_REGULAR, resolveFont('NotoSans-Regular.ttf'))
    doc.registerFont(FONT_BOLD, resolveFont('NotoSans-Bold.ttf'))

    drawPageOne(doc, data)
    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 })
    drawPageTwo(doc, data)
    doc.end()
  })
}
