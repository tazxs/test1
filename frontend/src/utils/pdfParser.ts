/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface ParsedRow {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // positive = income, negative = expense
}

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_PDF_PAGES = 200

// ── Extract all text from a PDF as one string ─────────────────────────────────
// pdfjs returns text items in reading order for simple tables, so joining them
// with spaces gives us the linear row text we need.
async function extractText(file: File): Promise<string> {
  if (file.size > MAX_PDF_SIZE) {
    throw new Error(`PDF слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум: 10 МБ.`)
  }

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDF содержит ${pdf.numPages} страниц. Максимум: ${MAX_PDF_PAGES}.`)
  }

  const pages: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const text = content.items
      .filter((item): item is typeof item & { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ')
    pages.push(text)
  }

  // Join pages with a space so split-chunks work across page boundaries
  return pages.join(' ')
}

// ── Kaspi Gold / Kaspi Bank parser ────────────────────────────────────────────
//
// Actual column layout (from real statement):
//   Дата     Сумма             Операция   Детали
//   13.03.26 - 4 334,00 ₸     Перевод    Оплата Kaspi Кредита
//   10.03.26 + 40 000,00 ₸    Пополнение Рахымжан А.
//
// Key format details:
//   • Date uses TWO-digit year: DD.MM.YY  (13.03.26 = March 13 2026)
//   • Amount has an explicit +/- sign followed by a space
//   • Thousands separator = space (4 334,00)
//   • Decimal separator   = comma (4 334,00)
//   • ₸ symbol follows the amount (U+20B8 or rendered as T in some PDF encodings)
//   • Operation types: Перевод | Покупка | Пополнение | Снятие | Снятия | Разное
//
function parseKaspiGold(text: string): ParsedRow[] {
  const results: ParsedRow[] = []

  // Split the concatenated text at each transaction start.
  // A transaction starts with DD.MM.YY followed by a sign (+/-).
  const chunks = text.split(/(?=\d{2}\.\d{2}\.\d{2}\s+[+-])/)

  for (const chunk of chunks) {
    // Match: DD.MM.YY  [+-]  DIGITS,DD  [₸ or T or any non-letter]?  OPERATION  DETAILS
    //
    // [\d][\d ]* — digits with spaces (thousands separator), e.g. "4 334" or "40 000"
    // \S?        — optionally consume the ₸ / T symbol (any single non-whitespace)
    // (?:...)    — non-capturing group for the operation keyword
    const m = chunk.match(
      /^(\d{2})\.(\d{2})\.(\d{2})\s+([+-])\s*([\d][\d ]*,\d{2})\s*\S?\s*(Перевод|Покупка|Пополнение|Снятие|Снятия|Разное)\s+([\s\S]+)/,
    )
    if (!m) continue

    const [, dd, mm, yy, sign, amountRaw, opType, rawDetails] = m

    // Two-digit year → full year: "26" → 2026
    const year = 2000 + parseInt(yy!, 10)
    const date = `${year}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`

    // Parse amount: remove thousands spaces, replace comma decimal with dot
    const amount = parseFloat(amountRaw!.replace(/ /g, '').replace(',', '.'))
    if (isNaN(amount) || amount === 0) continue

    // Apply sign
    const finalAmount = sign === '+' ? amount : -amount

    // Details: strip any trailing content that starts with another date row
    const details = rawDetails!
      .replace(/\s*\d{2}\.\d{2}\.\d{2}\s+[+-][\s\S]*/, '')
      .trim()
      .slice(0, 150)

    results.push({
      date,
      description: `${opType}: ${details}`,
      amount: finalAmount,
    })
  }

  return results
}

// ── Halyk / HomeBank parser ───────────────────────────────────────────────────
//
// Actual column layout (from real Halyk statement):
//   Дата проведения | Дата обработки | Описание операции | Сумма операции |
//   Валюта операции | Приход в валюте счета | Расход в валюте счета | Комиссия | № карточки/счета
//
// Key format details:
//   • Two date columns, both DD.MM.YYYY (4-digit year)
//   • Thousands separator = space (50 000,00)
//   • Decimal separator   = comma (4 500,00)
//   • Currency (KZT/USD/EUR) is present when Сумма ≠ 0, absent for fee-only rows
//   • Use Приход (>0) for income, Расход (<0) for expenses, Комиссия (<0) for fee-only rows
//
function parseHalyk(text: string): ParsedRow[] {
  const results: ParsedRow[] = []

  function toNum(s: string): number {
    return parseFloat(s.replace(/ /g, '').replace(',', '.'))
  }

  // Split on pairs of consecutive DD.MM.YYYY dates (two date columns per row)
  const chunks = text.split(/(?=\d{2}\.\d{2}\.\d{4}\s+\d{2}\.\d{2}\.\d{4}\s)/)

  for (const chunk of chunks) {
    // Match:
    //   1-3: DD MM YYYY (first date — "дата проведения операции")
    //   4:   description
    //   5:   Сумма операции (may be negative; space-thousands, comma-decimal)
    //   6:   Приход в валюте счета
    //   7:   Расход в валюте счета
    //   8:   Комиссия
    //   Currency (KZT/USD/EUR) is optional — non-capturing group
    const m = chunk.match(
      /^(\d{2})\.(\d{2})\.(\d{4})\s+\d{2}\.\d{2}\.\d{4}\s+([\s\S]+?)\s+(-?[\d][\d ]*,\d{2})(?:\s+(?:KZT|USD|EUR))?\s+(-?[\d][\d ]*,\d{2})\s+(-?[\d][\d ]*,\d{2})\s+(-?[\d][\d ]*,\d{2})/,
    )
    if (!m) continue

    const [, dd, mm, yyyy, rawDesc, , incomeRaw, expenseRaw, feeRaw] = m
    const date = `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`

    const income  = toNum(incomeRaw!)
    const expense = toNum(expenseRaw!)
    const fee     = toNum(feeRaw!)

    // Determine net impact on the account balance
    let amount: number
    if (income !== 0)       amount = income    // positive — receipt
    else if (expense !== 0) amount = expense   // negative — debit
    else if (fee !== 0)     amount = fee       // negative — commission-only row
    else continue                              // all-zero row, skip

    const description = rawDesc!.trim().replace(/\s+/g, ' ').slice(0, 150)
    results.push({ date, description, amount })
  }

  return results
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function parseBankPdf(
  file: File,
  provider: 'KASPI' | 'HALYK',
): Promise<ParsedRow[]> {
  const text = await extractText(file)

  const parsed = provider === 'KASPI' ? parseKaspiGold(text) : parseHalyk(text)

  // Deduplicate (pdfjs can sometimes repeat items near page boundaries)
  const seen = new Set<string>()
  return parsed.filter((r) => {
    const key = `${r.date}|${r.amount}|${r.description.slice(0, 30)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
