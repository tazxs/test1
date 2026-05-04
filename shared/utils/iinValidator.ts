/**
 * Kazakhstan IIN (ИИН) / BIN (БИН) validation.
 *
 * IIN structure (12 digits):
 *   Digits 1–6  : birth date YYMMDD
 *   Digit 7     : century + gender (1=1800sM, 2=1900sM, 3=2000sM, 4=1800sF, 5=1900sF, 6=2000sF)
 *   Digits 8–11 : sequential number
 *   Digit 12    : check digit (Luhn-like with two weight vectors)
 *
 * BIN has the same 12-digit format but digit 5 encodes entity type.
 * Both use the same checksum algorithm.
 *
 * Source: НК РК ст. 68, НУЦ РК checksum spec.
 */

const WEIGHTS_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const WEIGHTS_2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]

export function validateIIN(value: string): boolean {
  if (!/^\d{12}$/.test(value)) return false

  const d = value.split('').map(Number)

  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += d[i]! * WEIGHTS_1[i]!
  }
  let check = sum % 11

  if (check === 10) {
    sum = 0
    for (let i = 0; i < 11; i++) {
      sum += d[i]! * WEIGHTS_2[i]!
    }
    check = sum % 11
  }

  // If check is still 10 after both vectors → invalid (no valid check digit exists)
  if (check === 10) return false
  return check === d[11]
}

/** Returns the IIN/BIN formatted with a space after digit 6 for display. */
export function formatIIN(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 12)
  if (clean.length <= 6) return clean
  return `${clean.slice(0, 6)} ${clean.slice(6)}`
}
