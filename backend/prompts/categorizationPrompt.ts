/**
 * Prompt templates for transaction categorization.
 * Extracted from GeminiService / GroqService for single-source maintainability.
 */

import type { SupportedLanguage } from '../src/utils/language'

const INCOME_CATEGORIES = [
  'SERVICES_INCOME', 'GOODS_INCOME', 'RENT_INCOME', 'CONSULTING_INCOME',
  'FREELANCE_INCOME', 'DIVIDEND_INCOME', 'INTEREST_INCOME', 'ASSET_SALE_INCOME', 'OTHER_INCOME',
].join(', ')

const EXPENSE_CATEGORIES = [
  'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES', 'SALARY_EXPENSES',
  'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'INSURANCE_EXPENSES', 'TAX_EXPENSES',
  'BANK_EXPENSES', 'REPAIR_EXPENSES', 'SUBSCRIPTION_EXPENSES', 'OTHER_EXPENSES',
].join(', ')

export function buildCategorizationPrompt(
  description: string,
  amount: number,
  type: 'INCOME' | 'EXPENSE',
  language: SupportedLanguage = 'ru',
): string {
  return `Ты — финансовый классификатор транзакций для Казахстана.
Язык краткого reasoning: ${language}.

Транзакция:
- Описание: "${description}"
- Сумма: ${amount} ₸
- Тип: ${type === 'INCOME' ? 'ДОХОД' : 'РАСХОД'}

Доступные категории ДОХОДОВ: ${INCOME_CATEGORIES}
Доступные категории РАСХОДОВ: ${EXPENSE_CATEGORIES}
Если не уверен: UNCATEGORIZED

Ответь ТОЛЬКО валидным JSON без markdown:
{"category":"CATEGORY_NAME","confidence":0.95,"reasoning":"краткое обоснование"}`
}

export function buildBulkCategorizationPrompt(
  transactions: Array<{ id: string; description: string; amount: number; type: 'INCOME' | 'EXPENSE' }>,
  language: SupportedLanguage = 'ru',
): string {
  const lines = transactions
    .map((t, i) =>
      `${i + 1}. id="${t.id}" | "${t.description}" | ${t.amount}₸ | ${t.type === 'INCOME' ? 'ДОХОД' : 'РАСХОД'}`,
    )
    .join('\n')

  return `Ты — финансовый классификатор транзакций для Казахстана.
Язык reasoning, если он понадобится: ${language}.

Классифицируй каждую транзакцию:
${lines}

Категории ДОХОДОВ: ${INCOME_CATEGORIES}
Категории РАСХОДОВ: ${EXPENSE_CATEGORIES}
Если не уверен: UNCATEGORIZED

Ответь ТОЛЬКО валидным JSON массивом без markdown:
[{"transactionId":"id","category":"CATEGORY","confidence":0.95}]`
}
