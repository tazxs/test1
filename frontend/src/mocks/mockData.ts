import type { Transaction } from 'nalogai-shared/types/transaction.types'
import type { Declaration } from 'nalogai-shared/types/declaration.types'

// ── Mock Transactions (50 items) ───────────────────────────────────────────────
export const mockTransactions: Transaction[] = [
  { id: 't1',  userId: 'u1', amount: 250000, type: 'INCOME',  category: 'SERVICES_INCOME',   description: 'Разработка сайта — ТОО «Алма»',      source: 'KASPI',  externalId: 'k001', aiConfidence: 0.97, date: '2025-04-18', deletedAt: null, createdAt: '2025-04-18T10:00:00Z', updatedAt: '2025-04-18T10:00:00Z' },
  { id: 't2',  userId: 'u1', amount: 180000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Консультация по маркетингу',           source: 'KASPI',  externalId: 'k002', aiConfidence: 0.95, date: '2025-04-15', deletedAt: null, createdAt: '2025-04-15T09:00:00Z', updatedAt: '2025-04-15T09:00:00Z' },
  { id: 't3',  userId: 'u1', amount: 45000,  type: 'EXPENSE', category: 'EQUIPMENT_EXPENSES', description: 'Внешний жёсткий диск WD 2TB',          source: 'MANUAL', externalId: null,   aiConfidence: 0.91, date: '2025-04-14', deletedAt: null, createdAt: '2025-04-14T15:00:00Z', updatedAt: '2025-04-14T15:00:00Z' },
  { id: 't4',  userId: 'u1', amount: 320000, type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Дизайн приложения — Стартап XYZ',     source: 'HALYK',  externalId: 'h001', aiConfidence: 0.93, date: '2025-04-12', deletedAt: null, createdAt: '2025-04-12T11:00:00Z', updatedAt: '2025-04-12T11:00:00Z' },
  { id: 't5',  userId: 'u1', amount: 18500,  type: 'EXPENSE', category: 'MARKETING_EXPENSES', description: 'Реклама в Instagram',                  source: 'MANUAL', externalId: null,   aiConfidence: 0.88, date: '2025-04-10', deletedAt: null, createdAt: '2025-04-10T14:00:00Z', updatedAt: '2025-04-10T14:00:00Z' },
  { id: 't6',  userId: 'u1', amount: 150000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'SEO-оптимизация сайта',                source: 'KASPI',  externalId: 'k003', aiConfidence: 0.96, date: '2025-04-08', deletedAt: null, createdAt: '2025-04-08T10:00:00Z', updatedAt: '2025-04-08T10:00:00Z' },
  { id: 't7',  userId: 'u1', amount: 12000,  type: 'EXPENSE', category: 'UTILITIES_EXPENSES', description: 'Интернет (Казахтелеком)',               source: 'KASPI',  externalId: 'k004', aiConfidence: 0.99, date: '2025-04-05', deletedAt: null, createdAt: '2025-04-05T09:00:00Z', updatedAt: '2025-04-05T09:00:00Z' },
  { id: 't8',  userId: 'u1', amount: 95000,  type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Аудит бизнес-процессов',               source: 'HALYK',  externalId: 'h002', aiConfidence: 0.92, date: '2025-04-03', deletedAt: null, createdAt: '2025-04-03T16:00:00Z', updatedAt: '2025-04-03T16:00:00Z' },
  { id: 't9',  userId: 'u1', amount: 8900,   type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Канцтовары и расходники',              source: 'MANUAL', externalId: null,   aiConfidence: 0.85, date: '2025-04-02', deletedAt: null, createdAt: '2025-04-02T12:00:00Z', updatedAt: '2025-04-02T12:00:00Z' },
  { id: 't10', userId: 'u1', amount: 210000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Разработка Telegram-бота',             source: 'KASPI',  externalId: 'k005', aiConfidence: 0.94, date: '2025-03-30', deletedAt: null, createdAt: '2025-03-30T10:00:00Z', updatedAt: '2025-03-30T10:00:00Z' },
  { id: 't11', userId: 'u1', amount: 175000, type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Контент для YouTube-канала',           source: 'KASPI',  externalId: 'k006', aiConfidence: 0.91, date: '2025-03-28', deletedAt: null, createdAt: '2025-03-28T11:00:00Z', updatedAt: '2025-03-28T11:00:00Z' },
  { id: 't12', userId: 'u1', amount: 35000,  type: 'EXPENSE', category: 'TRANSPORT_EXPENSES', description: 'Такси на встречи с клиентами',         source: 'KASPI',  externalId: 'k007', aiConfidence: 0.78, date: '2025-03-27', deletedAt: null, createdAt: '2025-03-27T18:00:00Z', updatedAt: '2025-03-27T18:00:00Z' },
  { id: 't13', userId: 'u1', amount: 300000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Стратегический консалтинг — 3 месяца', source: 'HALYK',  externalId: 'h003', aiConfidence: 0.97, date: '2025-03-25', deletedAt: null, createdAt: '2025-03-25T09:00:00Z', updatedAt: '2025-03-25T09:00:00Z' },
  { id: 't14', userId: 'u1', amount: 24000,  type: 'EXPENSE', category: 'MARKETING_EXPENSES', description: 'Дизайн визиток и брошюр',              source: 'MANUAL', externalId: null,   aiConfidence: 0.82, date: '2025-03-22', deletedAt: null, createdAt: '2025-03-22T14:00:00Z', updatedAt: '2025-03-22T14:00:00Z' },
  { id: 't15', userId: 'u1', amount: 130000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Настройка CRM-системы',               source: 'KASPI',  externalId: 'k008', aiConfidence: 0.95, date: '2025-03-20', deletedAt: null, createdAt: '2025-03-20T10:00:00Z', updatedAt: '2025-03-20T10:00:00Z' },
  { id: 't16', userId: 'u1', amount: 12000,  type: 'EXPENSE', category: 'UTILITIES_EXPENSES', description: 'Интернет (Казахтелеком)',               source: 'KASPI',  externalId: 'k009', aiConfidence: 0.99, date: '2025-03-05', deletedAt: null, createdAt: '2025-03-05T09:00:00Z', updatedAt: '2025-03-05T09:00:00Z' },
  { id: 't17', userId: 'u1', amount: 85000,  type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Перевод технической документации',     source: 'MANUAL', externalId: null,   aiConfidence: 0.89, date: '2025-03-18', deletedAt: null, createdAt: '2025-03-18T15:00:00Z', updatedAt: '2025-03-18T15:00:00Z' },
  { id: 't18', userId: 'u1', amount: 190000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Поддержка сайта — 3 месяца',          source: 'KASPI',  externalId: 'k010', aiConfidence: 0.93, date: '2025-03-15', deletedAt: null, createdAt: '2025-03-15T10:00:00Z', updatedAt: '2025-03-15T10:00:00Z' },
  { id: 't19', userId: 'u1', amount: 55000,  type: 'EXPENSE', category: 'EQUIPMENT_EXPENSES', description: 'Наушники Sony WH-1000XM4',             source: 'MANUAL', externalId: null,   aiConfidence: 0.87, date: '2025-03-12', deletedAt: null, createdAt: '2025-03-12T13:00:00Z', updatedAt: '2025-03-12T13:00:00Z' },
  { id: 't20', userId: 'u1', amount: 160000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Оптимизация бизнес-процессов',         source: 'HALYK',  externalId: 'h004', aiConfidence: 0.91, date: '2025-03-10', deletedAt: null, createdAt: '2025-03-10T11:00:00Z', updatedAt: '2025-03-10T11:00:00Z' },
  // Feb
  { id: 't21', userId: 'u1', amount: 220000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Интеграция платёжной системы',        source: 'KASPI',  externalId: 'k011', aiConfidence: 0.96, date: '2025-02-28', deletedAt: null, createdAt: '2025-02-28T10:00:00Z', updatedAt: '2025-02-28T10:00:00Z' },
  { id: 't22', userId: 'u1', amount: 45000,  type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Аренда коворкинга — февраль',         source: 'MANUAL', externalId: null,   aiConfidence: 0.98, date: '2025-02-25', deletedAt: null, createdAt: '2025-02-25T09:00:00Z', updatedAt: '2025-02-25T09:00:00Z' },
  { id: 't23', userId: 'u1', amount: 140000, type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Анимация для рекламного ролика',      source: 'HALYK',  externalId: 'h005', aiConfidence: 0.90, date: '2025-02-20', deletedAt: null, createdAt: '2025-02-20T14:00:00Z', updatedAt: '2025-02-20T14:00:00Z' },
  { id: 't24', userId: 'u1', amount: 12000,  type: 'EXPENSE', category: 'UTILITIES_EXPENSES', description: 'Интернет (Казахтелеком)',               source: 'KASPI',  externalId: 'k012', aiConfidence: 0.99, date: '2025-02-05', deletedAt: null, createdAt: '2025-02-05T09:00:00Z', updatedAt: '2025-02-05T09:00:00Z' },
  { id: 't25', userId: 'u1', amount: 280000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Финансовый аудит компании',            source: 'KASPI',  externalId: 'k013', aiConfidence: 0.94, date: '2025-02-15', deletedAt: null, createdAt: '2025-02-15T11:00:00Z', updatedAt: '2025-02-15T11:00:00Z' },
  // Jan
  { id: 't26', userId: 'u1', amount: 200000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Разработка мобильного приложения',    source: 'KASPI',  externalId: 'k014', aiConfidence: 0.95, date: '2025-01-30', deletedAt: null, createdAt: '2025-01-30T10:00:00Z', updatedAt: '2025-01-30T10:00:00Z' },
  { id: 't27', userId: 'u1', amount: 45000,  type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Аренда коворкинга — январь',          source: 'MANUAL', externalId: null,   aiConfidence: 0.98, date: '2025-01-25', deletedAt: null, createdAt: '2025-01-25T09:00:00Z', updatedAt: '2025-01-25T09:00:00Z' },
  { id: 't28', userId: 'u1', amount: 110000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Консультация по налогам',              source: 'HALYK',  externalId: 'h006', aiConfidence: 0.93, date: '2025-01-20', deletedAt: null, createdAt: '2025-01-20T15:00:00Z', updatedAt: '2025-01-20T15:00:00Z' },
  { id: 't29', userId: 'u1', amount: 75000,  type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Копирайтинг для стартапа',             source: 'MANUAL', externalId: null,   aiConfidence: 0.88, date: '2025-01-18', deletedAt: null, createdAt: '2025-01-18T12:00:00Z', updatedAt: '2025-01-18T12:00:00Z' },
  { id: 't30', userId: 'u1', amount: 12000,  type: 'EXPENSE', category: 'UTILITIES_EXPENSES', description: 'Интернет (Казахтелеком)',               source: 'KASPI',  externalId: 'k015', aiConfidence: 0.99, date: '2025-01-05', deletedAt: null, createdAt: '2025-01-05T09:00:00Z', updatedAt: '2025-01-05T09:00:00Z' },
  // Uncategorized
  { id: 't31', userId: 'u1', amount: 55000,  type: 'INCOME',  category: 'UNCATEGORIZED',      description: 'Перевод от Ерлан А.',                  source: 'KASPI',  externalId: 'k016', aiConfidence: null, date: '2025-04-17', deletedAt: null, createdAt: '2025-04-17T10:00:00Z', updatedAt: '2025-04-17T10:00:00Z' },
  { id: 't32', userId: 'u1', amount: 30000,  type: 'INCOME',  category: 'UNCATEGORIZED',      description: 'Оплата по счёту #2205',                source: 'HALYK',  externalId: 'h007', aiConfidence: null, date: '2025-04-11', deletedAt: null, createdAt: '2025-04-11T14:00:00Z', updatedAt: '2025-04-11T14:00:00Z' },
  { id: 't33', userId: 'u1', amount: 22000,  type: 'EXPENSE', category: 'UNCATEGORIZED',      description: 'Карточный платёж #8847',               source: 'KASPI',  externalId: 'k017', aiConfidence: null, date: '2025-04-09', deletedAt: null, createdAt: '2025-04-09T17:00:00Z', updatedAt: '2025-04-09T17:00:00Z' },
  // More regular months
  { id: 't34', userId: 'u1', amount: 195000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Разработка лендинга для кофейни',      source: 'KASPI',  externalId: 'k018', aiConfidence: 0.94, date: '2025-04-06', deletedAt: null, createdAt: '2025-04-06T10:00:00Z', updatedAt: '2025-04-06T10:00:00Z' },
  { id: 't35', userId: 'u1', amount: 28000,  type: 'EXPENSE', category: 'MARKETING_EXPENSES', description: 'Продвижение в Kaspi Объявления',        source: 'KASPI',  externalId: 'k019', aiConfidence: 0.86, date: '2025-04-04', deletedAt: null, createdAt: '2025-04-04T11:00:00Z', updatedAt: '2025-04-04T11:00:00Z' },
  { id: 't36', userId: 'u1', amount: 240000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Бизнес-план для инвестора',             source: 'HALYK',  externalId: 'h008', aiConfidence: 0.97, date: '2025-03-08', deletedAt: null, createdAt: '2025-03-08T10:00:00Z', updatedAt: '2025-03-08T10:00:00Z' },
  { id: 't37', userId: 'u1', amount: 16000,  type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Принтер HP LaserJet',                  source: 'MANUAL', externalId: null,   aiConfidence: 0.90, date: '2025-03-06', deletedAt: null, createdAt: '2025-03-06T12:00:00Z', updatedAt: '2025-03-06T12:00:00Z' },
  { id: 't38', userId: 'u1', amount: 120000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Ежемесячная поддержка 2 сайтов',       source: 'KASPI',  externalId: 'k020', aiConfidence: 0.96, date: '2025-02-10', deletedAt: null, createdAt: '2025-02-10T10:00:00Z', updatedAt: '2025-02-10T10:00:00Z' },
  { id: 't39', userId: 'u1', amount: 65000,  type: 'EXPENSE', category: 'EQUIPMENT_EXPENSES', description: 'Мышь и клавиатура Logitech',            source: 'MANUAL', externalId: null,   aiConfidence: 0.88, date: '2025-02-08', deletedAt: null, createdAt: '2025-02-08T14:00:00Z', updatedAt: '2025-02-08T14:00:00Z' },
  { id: 't40', userId: 'u1', amount: 185000, type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Разработка чат-бота для ресторана',    source: 'KASPI',  externalId: 'k021', aiConfidence: 0.93, date: '2025-02-05', deletedAt: null, createdAt: '2025-02-05T11:00:00Z', updatedAt: '2025-02-05T11:00:00Z' },
  { id: 't41', userId: 'u1', amount: 45000,  type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Аренда коворкинга — март',             source: 'MANUAL', externalId: null,   aiConfidence: 0.98, date: '2025-03-01', deletedAt: null, createdAt: '2025-03-01T09:00:00Z', updatedAt: '2025-03-01T09:00:00Z' },
  { id: 't42', userId: 'u1', amount: 97000,  type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'Маркетинговый анализ рынка',            source: 'HALYK',  externalId: 'h009', aiConfidence: 0.91, date: '2025-01-15', deletedAt: null, createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z' },
  { id: 't43', userId: 'u1', amount: 32000,  type: 'EXPENSE', category: 'TRANSPORT_EXPENSES', description: 'Командировка в Алматы',                source: 'KASPI',  externalId: 'k022', aiConfidence: 0.84, date: '2025-01-12', deletedAt: null, createdAt: '2025-01-12T09:00:00Z', updatedAt: '2025-01-12T09:00:00Z' },
  { id: 't44', userId: 'u1', amount: 155000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Настройка и запуск email-рассылки',    source: 'KASPI',  externalId: 'k023', aiConfidence: 0.95, date: '2025-01-10', deletedAt: null, createdAt: '2025-01-10T11:00:00Z', updatedAt: '2025-01-10T11:00:00Z' },
  { id: 't45', userId: 'u1', amount: 18000,  type: 'EXPENSE', category: 'MARKETING_EXPENSES', description: '2GIS реклама — январь',                source: 'MANUAL', externalId: null,   aiConfidence: 0.87, date: '2025-01-08', deletedAt: null, createdAt: '2025-01-08T10:00:00Z', updatedAt: '2025-01-08T10:00:00Z' },
  { id: 't46', userId: 'u1', amount: 260000, type: 'INCOME',  category: 'SERVICES_INCOME',    description: 'Редизайн корпоративного сайта',        source: 'KASPI',  externalId: 'k024', aiConfidence: 0.96, date: '2025-02-22', deletedAt: null, createdAt: '2025-02-22T10:00:00Z', updatedAt: '2025-02-22T10:00:00Z' },
  { id: 't47', userId: 'u1', amount: 14000,  type: 'EXPENSE', category: 'UTILITIES_EXPENSES', description: 'Сотовая связь (Beeline корп)',           source: 'KASPI',  externalId: 'k025', aiConfidence: 0.97, date: '2025-02-03', deletedAt: null, createdAt: '2025-02-03T09:00:00Z', updatedAt: '2025-02-03T09:00:00Z' },
  { id: 't48', userId: 'u1', amount: 120000, type: 'INCOME',  category: 'FREELANCE_INCOME',   description: 'Видео-монтаж корпоративного фильма',   source: 'HALYK',  externalId: 'h010', aiConfidence: 0.90, date: '2025-01-25', deletedAt: null, createdAt: '2025-01-25T14:00:00Z', updatedAt: '2025-01-25T14:00:00Z' },
  { id: 't49', userId: 'u1', amount: 9500,   type: 'EXPENSE', category: 'OFFICE_EXPENSES',    description: 'Блокноты и ручки для офиса',           source: 'MANUAL', externalId: null,   aiConfidence: 0.83, date: '2025-01-22', deletedAt: null, createdAt: '2025-01-22T11:00:00Z', updatedAt: '2025-01-22T11:00:00Z' },
  { id: 't50', userId: 'u1', amount: 170000, type: 'INCOME',  category: 'CONSULTING_INCOME',  description: 'HR-консалтинг для ТОО «Ком»',          source: 'KASPI',  externalId: 'k026', aiConfidence: 0.92, date: '2025-03-03', deletedAt: null, createdAt: '2025-03-03T10:00:00Z', updatedAt: '2025-03-03T10:00:00Z' },
]

// ── Mock Declarations ──────────────────────────────────────────────────────────
export const mockDeclarations: Declaration[] = [
  {
    id: 'd1', userId: 'u1', period: '2025-Q1', periodType: 'QUARTER', formType: 'FORM_910',
    status: 'READY', calculation: {
      grossIncome: 1057000, totalDeductions: 124400, taxableIncome: 932600,
      taxRate: 0.03, incomeTax: 15856, socialTax: 15999, pensionContribution: 29820, medicalInsurance: 7488,
      totalTaxBurden: 65286, effectiveRate: 0.06, aiOptimizedSavings: 34200,
      deductions: [
        { id: 'ded1', name: 'Производственное оборудование', amount: 55000, description: 'Ноутбук + наушники' },
        { id: 'ded2', name: 'Офисные расходы',               amount: 45000, description: 'Аренда коворкинга' },
        { id: 'ded3', name: 'Маркетинг',                     amount: 24400, description: 'Реклама и продвижение' },
      ],
      regime: 'SIMPLIFIED_DECLARATION',
    },
    pdfUrl: null, eGovConfirmationCode: null, submittedAt: null, deletedAt: null,
    createdAt: '2025-04-01T09:00:00Z', updatedAt: '2025-04-15T10:00:00Z',
  },
  {
    id: 'd2', userId: 'u1', period: '2024-Q4', periodType: 'QUARTER', formType: 'FORM_910',
    status: 'ACCEPTED', calculation: {
      grossIncome: 987000, totalDeductions: 98000, taxableIncome: 889000,
      taxRate: 0.03, incomeTax: 14805, socialTax: 14805, pensionContribution: 27720, medicalInsurance: 7116,
      totalTaxBurden: 61506, effectiveRate: 0.062, aiOptimizedSavings: 28500,
      deductions: [
        { id: 'ded4', name: 'Транспорт',    amount: 35000, description: 'Деловые поездки' },
        { id: 'ded5', name: 'Маркетинг',    amount: 42000, description: 'Реклама' },
        { id: 'ded6', name: 'Офис',         amount: 21000, description: 'Расходы на офис' },
      ],
      regime: 'SIMPLIFIED_DECLARATION',
    },
    pdfUrl: '/pdfs/910-2024-Q4.pdf', eGovConfirmationCode: 'EG-2024-Q4-7823',
    submittedAt: '2025-02-14T12:00:00Z', deletedAt: null,
    createdAt: '2025-01-15T09:00:00Z', updatedAt: '2025-02-14T12:00:00Z',
  },
  {
    id: 'd3', userId: 'u1', period: '2024-Q3', periodType: 'QUARTER', formType: 'FORM_910',
    status: 'ACCEPTED', calculation: {
      grossIncome: 876000, totalDeductions: 87000, taxableIncome: 789000,
      taxRate: 0.03, incomeTax: 13140, socialTax: 13140, pensionContribution: 24570, medicalInsurance: 6312,
      totalTaxBurden: 54552, effectiveRate: 0.062, aiOptimizedSavings: 21000,
      deductions: [], regime: 'SIMPLIFIED_DECLARATION',
    },
    pdfUrl: '/pdfs/910-2024-Q3.pdf', eGovConfirmationCode: 'EG-2024-Q3-5612',
    submittedAt: '2024-11-12T10:00:00Z', deletedAt: null,
    createdAt: '2024-10-01T09:00:00Z', updatedAt: '2024-11-12T10:00:00Z',
  },
]

// ── Mock Deadlines ─────────────────────────────────────────────────────────────
export interface MockDeadline {
  id: string
  day: number
  month: string
  name: string
  sub: string
  daysUntil: number
}

function computeDaysUntil(year: number, month: number, day: number): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(year, month - 1, day)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export const mockDeadlines: MockDeadline[] = [
  { id: 'dl1', day: 25, month: 'МАР', name: 'ЕСП за февраль 2026',    sub: 'Самозанятые, ежемесячно',   daysUntil: computeDaysUntil(2026, 3, 25) },
  { id: 'dl2', day: 15, month: 'АПР', name: '910.00 за Q4 2025',       sub: 'Упрощённая декларация',     daysUntil: computeDaysUntil(2026, 4, 15) },
  { id: 'dl3', day: 25, month: 'АПР', name: 'ОПВ и ОСМС за Q1 2026',  sub: 'ИП, упрощённая декларация', daysUntil: computeDaysUntil(2026, 4, 25) },
]

// ── Mock AI tips ───────────────────────────────────────────────────────────────
export interface MockAITip {
  id: string
  title: string
  description: string
  saving: number
}

export const mockAITips: MockAITip[] = [
  { id: 'ai1', title: 'Вычет за оборудование',  description: 'Вы можете списать покупку ноутбука как производственные расходы',           saving: 12400 },
  { id: 'ai2', title: 'Офисная аренда',          description: 'Расходы на коворкинг полностью вычитаются из налогооблагаемой базы',        saving: 13500 },
  { id: 'ai3', title: 'Маркетинговые расходы',   description: 'Затраты на рекламу и продвижение снижают налоговую базу на 100%',          saving: 8300  },
]

// ── Chart data (monthly income + tax for H1 2025) ─────────────────────────────
export interface ChartMonth {
  month: string
  income: number
  tax: number
  isCurrent: boolean
}

export const mockChartData: ChartMonth[] = [
  { month: 'Янв', income: 542000,  tax: 32520,  isCurrent: false },
  { month: 'Фев', income: 670000,  tax: 40200,  isCurrent: false },
  { month: 'Мар', income: 1057000, tax: 63420,  isCurrent: false },
  { month: 'Апр', income: 1248500, tax: 74910,  isCurrent: true  },
  { month: 'Май', income: 0,       tax: 0,      isCurrent: false },
  { month: 'Июн', income: 0,       tax: 0,      isCurrent: false },
]
