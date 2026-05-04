/**
 * Advice prompt template for GET /api/ai/advice.
 *
 * Design principles:
 * 1. RAG context slot — NK RK article text injected from pgvector search.
 * 2. Pre-computed savings slot — numbers from TaxCalculatorService, AI MUST use these.
 * 3. Article citation required — every tip must set articleRef to a real НК РК article.
 * 4. Top-3 format enforced — no more, no less.
 */

import type { SupportedLanguage } from '../src/utils/language'
import { terminologyPromptBlock } from '../src/utils/taxTerminology'

export interface RegimeSaving {
  regime: string
  label: string
  saving: number   // positive = cheaper than current regime
}

export interface AdvicePromptParams {
  businessType: string
  regimeLabel: string
  grossIncome: number
  totalExpenses: number
  netIncome: number
  /** Exact current tax burden from TaxCalculatorService */
  currentTaxBurden: number
  /** Pre-computed savings for alternative regimes (only positive, i.e. cheaper) */
  regimeSavings: RegimeSaving[]
  /** Top-k NK RK article chunks from pgvector RAG search */
  ragContext: string
  language: SupportedLanguage
}

export function buildAdvicePrompt(p: AdvicePromptParams): string {
  const savingsLines = p.regimeSavings.length > 0
    ? p.regimeSavings
        .map((r) => `  • Переход на ${r.label}: экономия ${r.saving.toLocaleString('ru')} ₸/год`)
        .join('\n')
    : '  • Альтернативные режимы недоступны или невыгодны при текущем доходе'

  const languageInstruction = p.language === 'kk'
    ? 'Жауапты қазақ тілінде бер. МРП терминінің орнына ресми "АЕК" терминін қолдан; 2026 жылға арналған АЕК = 4 325 ₸ (2026 жылғы бюджет туралы заң). Оңайлатылған декларацияны "оңайлатылған декларация негізіндегі арнаулы салық режимі" деп ата.'
    : p.language === 'en'
      ? 'Answer in English. Preserve Kazakhstan tax form names and article references.'
      : 'Ответь на русском языке.'

  return `ЯЗЫК ОТВЕТА: ${p.language}
${languageInstruction}

${terminologyPromptBlock(p.language)}

КОНТЕКСТ ИЗ НК РК (статьи, подобранные по релевантности):
${p.ragContext.trim() || '(база знаний пуста — используй встроенные знания, обязательно укажи статью НК РК)'}

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
  Тип деятельности: ${p.businessType}
  Налоговый режим: ${p.regimeLabel}
  Валовой доход: ${p.grossIncome.toLocaleString('ru')} ₸
  Расходы: ${p.totalExpenses.toLocaleString('ru')} ₸
  Чистый доход: ${p.netIncome.toLocaleString('ru')} ₸

РАСЧЁТНЫЕ ДАННЫЕ (точные, вычислены TaxCalculatorService — ТОЛЬКО эти цифры допустимы в поле "saving"):
  • Текущий налог (${p.regimeLabel}): ${p.currentTaxBurden.toLocaleString('ru')} ₸/год
${savingsLines}

ЗАДАЧА: Сформулируй РОВНО 3 КОНКРЕТНЫХ СОВЕТА по налоговой оптимизации.

ТРЕБОВАНИЯ К КАЖДОМУ СОВЕТУ:
1. Поле "articleRef" — ОБЯЗАТЕЛЬНО указать конкретную статью НК РК (напр. "ст. 686 НК РК")
2. Поле "saving" — ТОЛЬКО значение из раздела "РАСЧЁТНЫЕ ДАННЫЕ" выше. Для советов не связанных со сменой режима — ставь 0
3. Поля "title" и "description" — на языке ответа; объясни конкретное действие пользователя (description не более 400 символов)
4. Тип REGIME_OPTIMIZATION — только если есть реальная экономия в РАСЧЁТНЫХ ДАННЫХ

Ответь ТОЛЬКО валидным JSON массивом без markdown, без пояснений:
[{"title":"...","description":"...","saving":0,"type":"DEDUCTION_OPPORTUNITY","articleRef":"ст. 337 НК РК"}]

type: DEDUCTION_OPPORTUNITY | REGIME_OPTIMIZATION | EXPENSE_CATEGORIZATION | GENERAL_TIP`
}
