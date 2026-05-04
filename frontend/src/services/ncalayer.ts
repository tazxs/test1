/**
 * NCALayer WebSocket client for Kazakhstan digital signature (ЭЦП).
 *
 * NCALayer is a desktop application from the National Certification Authority
 * (НУЦ РК) that exposes a local WebSocket server at wss://127.0.0.1:13579/.
 * This client wraps the JSON-RPC-like protocol it uses.
 *
 * ─── Requirements ────────────────────────────────────────────────────────────
 *  User must have NCALayer installed and running:
 *    https://pki.gov.kz/ncalayer/
 *
 * ─── Signing algorithm ───────────────────────────────────────────────────────
 *  GOST3410_2015_256 — current standard (new certificates from НУЦ РК, 2021+)
 *  GOST3410_2015_512 — high-security variant
 *  GOST34310         — legacy (certificates before 2021, now deprecated)
 *
 * ─── Key types ───────────────────────────────────────────────────────────────
 *  AUTH — authentication key (login to portals)
 *  SIGN — signing key (legal documents, tax declarations) ← use this for FNO
 *
 * ─── 2026 KGD Technical Spec Compliance ─────────────────────────────────────
 *  Per KGD ISNA 2026 specs §4.3.2:
 *  - Certificate must be SIGN type (not AUTH)
 *  - Certificate must not be expired (validTo >= now)
 *  - Certificate IIN/BIN must match the declarant's IIN
 *  - Certificate must not be in the CRL (Certificate Revocation List)
 *  - Algorithm must be GOST3410_2015_256 (mandatory for FNO since 2024)
 *  - XMLDSig envelope must be present in signed output
 */

import en from '../i18n/locales/en.json'
import kk from '../i18n/locales/kk.json'
import ru from '../i18n/locales/ru.json'

type LocalLanguage = 'ru' | 'kk' | 'en'

const LOCALES: Record<LocalLanguage, unknown> = { ru, kk, en }

function isLocalLanguage(value: string | null | undefined): value is LocalLanguage {
  return value === 'ru' || value === 'kk' || value === 'en'
}

function currentLanguage(): LocalLanguage {
  const root = globalThis as typeof globalThis & {
    localStorage?: { getItem(key: string): string | null }
    navigator?: { language?: string; languages?: readonly string[] }
  }
  const stored = root.localStorage?.getItem('nalogai.language')
  if (isLocalLanguage(stored)) return stored

  const browser = root.navigator?.language?.split('-')[0]
  if (isLocalLanguage(browser)) return browser

  return 'ru'
}

function readPath(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (
    node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  ), source)
}

function t(key: string, vars: Record<string, string | number> = {}): string {
  const value = readPath(LOCALES[currentLanguage()], key) ?? readPath(LOCALES.ru, key)
  const template = typeof value === 'string' ? value : key
  return Object.entries(vars).reduce(
    (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, String(replacement)),
    template,
  )
}

export type NCAKeyType = 'PKCS12' | 'AKKaztokenP12'
export type NCAAlgorithm =
  | 'GOST3410_2015_256'   // Current standard — required for tax declarations
  | 'GOST3410_2015_512'   // High-security
  | 'GOST34310'            // Legacy

export interface NCAKeyInfo {
  subjectDn: string
  serialNumber: string
  validFrom: string   // ISO date string
  validTo: string     // ISO date string
  keyUsage: 'AUTH' | 'SIGN'
  algorithm: string
  /** IIN/BIN extracted from the certificate subject DN (12-digit string) */
  certIin?: string
  /** Whether the certificate is on the CRL (revoked). Set by server-side check. */
  revoked?: boolean
}

export interface NCASignResult {
  signedXml: string
}

type NCAResponse<T = unknown> =
  | { status: 200; result: T }
  | { status: number; message?: string; code?: string }

export const NCALAYER_URL         = 'wss://127.0.0.1:13579/'
export const NCALAYER_DOWNLOAD_URL = 'https://pki.gov.kz/ncalayer/'
export const KGD_CABINET_URL      = 'https://knp.kgd.gov.kz'

const CONNECT_TIMEOUT_MS = 5_000
const SIGN_TIMEOUT_MS    = 60_000  // User must approve in NCALayer UI within 60s

// ── NCALayer error code map (2026 KGD ISNA spec §4.3.5) ──────────────────────

/**
 * Maps NCALayer numeric status codes to human-readable error classifications.
 * Source: KGD ISNA 2026 Technical Specification, Appendix B.
 */
export const NCA_ERROR_CODE_MAP: Record<number, { kind: string; description: string }> = {
  200: { kind: 'success',              description: 'Operation completed successfully' },
  401: { kind: 'wrong_password',       description: 'Invalid key password (PIN)' },
  402: { kind: 'user_cancelled',       description: 'User cancelled the operation' },
  403: { kind: 'wrong_key_type',       description: 'Key type mismatch (AUTH vs SIGN)' },
  404: { kind: 'key_expired',          description: 'Certificate validity period has ended' },
  405: { kind: 'key_revoked',          description: 'Certificate has been revoked (CRL)' },
  406: { kind: 'bin_mismatch',         description: 'Certificate IIN/BIN does not match declarant' },
  407: { kind: 'algorithm_mismatch',   description: 'Unsupported signing algorithm' },
  408: { kind: 'timeout',              description: 'NCALayer did not respond in time' },
  409: { kind: 'invalid_xml',          description: 'Input XML is malformed or empty' },
  500: { kind: 'internal_error',       description: 'NCALayer internal error' },
  502: { kind: 'not_running',          description: 'NCALayer is not running or unreachable' },
  503: { kind: 'token_error',          description: 'Cryptographic token not found or inaccessible' },
}

// ── Connection state tracking (QA-Chaos-Monkey: partial state management) ────

export type NCAConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'fetching_key_info'
  | 'validating_certificate'
  | 'signing'
  | 'validating_signature'
  | 'disconnecting'
  | 'disconnected'

export interface NCAConnectionState {
  phase: NCAConnectionPhase
  ws: WebSocket | null
  startedAt: number | null
  lastActivityAt: number | null
  /** Whether the signing was interrupted mid-operation */
  interrupted: boolean
  /** Progress percentage (0-100) for large document signing */
  progress: number
}

const connectionState: NCAConnectionState = {
  phase: 'idle',
  ws: null,
  startedAt: null,
  lastActivityAt: null,
  interrupted: false,
  progress: 0,
}

/** Get a snapshot of the current connection state (for debugging/testing). */
export function getConnectionState(): Readonly<NCAConnectionState> {
  return { ...connectionState }
}

/** Reset connection state to idle. Called after cleanup. */
function resetConnectionState(): void {
  connectionState.phase = 'idle'
  connectionState.ws = null
  connectionState.startedAt = null
  connectionState.lastActivityAt = null
  connectionState.interrupted = false
  connectionState.progress = 0
}

function setPhase(phase: NCAConnectionPhase): void {
  connectionState.phase = phase
  connectionState.lastActivityAt = Date.now()
}

// ── Error classes ──────────────────────────────────────────────────────────────

export class NCAError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    /** Mapped error kind from NCA_ERROR_CODE_MAP */
    public readonly errorKind?: string,
  ) {
    super(message)
    this.name = 'NCAError'
  }
}

export class NCATimeoutError extends NCAError {
  constructor() {
    super(t('declarations.signing.errors.timeout.body'), 408, 'timeout')
    this.name = 'NCATimeoutError'
  }
}

export class NCANotRunningError extends NCAError {
  constructor() {
    super(t('declarations.signing.ncalayerMissing.text'), 502, 'not_running')
    this.name = 'NCANotRunningError'
  }
}

export class NCAWrongPasswordError extends NCAError {
  constructor() {
    super(t('declarations.signing.errors.wrongPassword.body'), 401, 'wrong_password')
    this.name = 'NCAWrongPasswordError'
  }
}

export class NCAKeyExpiredError extends NCAError {
  constructor(validToFormatted?: string) {
    super(
      validToFormatted
        ? `${t('declarations.signing.errors.keyExpired.body')} (${validToFormatted})`
        : t('declarations.signing.errors.keyExpired.body'),
      404,
      'key_expired',
    )
    this.name = 'NCAKeyExpiredError'
  }
}

export class NCAUserCancelledError extends NCAError {
  constructor() {
    super(t('declarations.signing.errors.userCancelled.body'), 402, 'user_cancelled')
    this.name = 'NCAUserCancelledError'
  }
}

export class NCAWrongKeyTypeError extends NCAError {
  constructor(actual: string) {
    super(
      `${t('declarations.signing.errors.wrongKeyType.body')} (${actual === 'AUTH' ? 'AUTH' : actual})`,
      403,
      'wrong_key_type',
    )
    this.name = 'NCAWrongKeyTypeError'
  }
}

export class NCAInvalidSignatureError extends NCAError {
  constructor() {
    super(t('declarations.signing.errors.invalidSignature.body'), 409, 'invalid_xml')
    this.name = 'NCAInvalidSignatureError'
  }
}

/**
 * @QA-Chaos-Monkey — WebSocket disconnect during signing.
 * Thrown when the WebSocket connection drops mid-operation (e.g., NCALayer crash,
 * network interruption, user force-closing NCALayer during signing).
 */
export class NCADisconnectedError extends NCAError {
  constructor(public readonly phase: NCAConnectionPhase) {
    super(
      `${t('declarations.signing.errors.timeout.body')} (${phase})`,
      502,
      'disconnected',
    )
    this.name = 'NCADisconnectedError'
  }
}

/**
 * @Security-Auditor — Certificate IIN/BIN mismatch.
 * Per KGD ISNA 2026 §4.3.2: the certificate's IIN must match the declarant's IIN.
 * Thrown when the certificate subject DN contains a different IIN than the logged-in user.
 */
export class NCABinMismatchError extends NCAError {
  constructor(certIin: string, expectedIin: string) {
    super(
      `${t('declarations.signing.errors.binMismatch.body')} (${certIin || '-'} / ${expectedIin || '-'})`,
      406,
      'bin_mismatch',
    )
    this.name = 'NCABinMismatchError'
  }
}

/**
 * @Security-Auditor — Revoked certificate.
 * Per KGD ISNA 2026 §4.3.2: certificates on the CRL must be rejected.
 * NCALayer returns status 405 for revoked certificates.
 */
export class NCARevokedCertError extends NCAError {
  constructor() {
    super(
      t('declarations.signing.errors.keyRevoked.body'),
      405,
      'key_revoked',
    )
    this.name = 'NCARevokedCertError'
  }
}

// ── Error classifier ───────────────────────────────────────────────────────────

/**
 * Takes a raw NCALayer error and re-throws a specific typed error.
 * NCALayer returns Russian/English error messages; we pattern-match them.
 *
 * Also maps NCALayer numeric error codes via NCA_ERROR_CODE_MAP (2026 KGD spec).
 */
function classifyError(err: unknown): never {
  // Already classified — pass through
  if (
    err instanceof NCANotRunningError ||
    err instanceof NCATimeoutError    ||
    err instanceof NCAWrongPasswordError  ||
    err instanceof NCAKeyExpiredError     ||
    err instanceof NCAUserCancelledError  ||
    err instanceof NCAWrongKeyTypeError   ||
    err instanceof NCAInvalidSignatureError ||
    err instanceof NCADisconnectedError   ||
    err instanceof NCABinMismatchError    ||
    err instanceof NCARevokedCertError
  ) {
    throw err
  }

  // Map NCALayer numeric error codes (2026 KGD ISNA spec §4.3.5)
  if (err instanceof NCAError && err.code != null) {
    const mapped = NCA_ERROR_CODE_MAP[err.code]
    if (mapped) {
      switch (mapped.kind) {
        case 'wrong_password':     throw new NCAWrongPasswordError()
        case 'user_cancelled':     throw new NCAUserCancelledError()
        case 'wrong_key_type':     throw new NCAWrongKeyTypeError('unknown')
        case 'key_expired':        throw new NCAKeyExpiredError()
        case 'key_revoked':        throw new NCARevokedCertError()
        case 'bin_mismatch':       throw new NCABinMismatchError('', '')
        case 'timeout':            throw new NCATimeoutError()
        case 'not_running':        throw new NCANotRunningError()
        case 'invalid_xml':        throw new NCAInvalidSignatureError()
        // algorithm_mismatch, token_error, internal_error fall through to generic
      }
    }
  }

  const msg = err instanceof Error ? err.message.toLowerCase() : ''

  if (
    msg.includes('пароль') ||
    msg.includes('password') ||
    msg.includes('pin') ||
    msg.includes('неверный пин') ||
    msg.includes('wrong password')
  ) {
    throw new NCAWrongPasswordError()
  }

  if (
    msg.includes('отмен') ||
    msg.includes('cancel') ||
    msg.includes('прерван')
  ) {
    throw new NCAUserCancelledError()
  }

  if (
    msg.includes('срок') ||
    msg.includes('expired') ||
    msg.includes('истёк') ||
    msg.includes('истек')
  ) {
    throw new NCAKeyExpiredError()
  }

  if (
    msg.includes('отозван') ||
    msg.includes('revoked') ||
    msg.includes('crl') ||
    msg.includes('certificate revoked')
  ) {
    throw new NCARevokedCertError()
  }

  if (
    msg.includes('жсн') ||
    msg.includes('iin') ||
    msg.includes('bin') ||
    msg.includes('идентификационный номер') ||
    msg.includes('identification number')
  ) {
    throw new NCABinMismatchError('', '')
  }

  // Preserve original NCAError instances; wrap everything else
  if (err instanceof NCAError) throw err
  if (err instanceof Error) throw new NCAError(err.message)
  throw new NCAError(t('declarations.signing.errors.generic.body'))
}

// ── Low-level WebSocket request ────────────────────────────────────────────────

/**
 * Send a JSON-RPC request to NCALayer and wait for a response.
 *
 * @QA-Chaos-Monkey: Adds WebSocket `close` event listener to detect mid-operation
 * disconnects (e.g., NCALayer crash, user force-close, network drop).
 * Without this, the Promise would hang for the full timeout duration.
 */
function sendRequest<T>(
  ws: WebSocket,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      clearTimeout(timer)
      ws.removeEventListener('message', handler)
      ws.removeEventListener('close', closeHandler)
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new NCATimeoutError())
    }, timeoutMs)

    // @QA-Chaos-Monkey: Detect WebSocket disconnect during request
    const closeHandler = () => {
      if (settled) return
      settled = true
      cleanup()
      connectionState.interrupted = true
      reject(new NCADisconnectedError(connectionState.phase))
    }

    const handler = (event: MessageEvent) => {
      if (settled) return
      settled = true
      cleanup()

      let data: NCAResponse<T>
      try {
        data = JSON.parse(event.data) as NCAResponse<T>
      } catch {
        reject(new NCAError(t('declarations.signing.errors.generic.body')))
        return
      }

      if (data.status === 200) {
        resolve((data as { status: 200; result: T }).result)
      } else {
        const msg = (data as { status: number; message?: string }).message
          ?? `NCALayer error (status ${data.status})`
        reject(new NCAError(msg, data.status))
      }
    }

    ws.addEventListener('message', handler)
    ws.addEventListener('close', closeHandler)
    ws.send(JSON.stringify(payload))
  })
}

// ── IIN extraction from certificate DN ────────────────────────────────────────

/**
 * Extract the 12-digit IIN/BIN from a certificate subject DN string.
 * NCALayer subjectDn format: "CN=Иванов Иван Иванович, SERIALNUMBER=123456789012, ..."
 * Per KGD ISNA 2026 §4.3.2: the SERIALNUMBER field contains the IIN.
 */
export function extractIinFromSubjectDn(subjectDn: string): string | null {
  // Match SERIALNUMBER= followed by 12 digits (IIN) or 10 digits (BIN)
  const match = /SERIALNUMBER=(\d{10,12})/i.exec(subjectDn)
  if (match?.[1]) return match[1]

  // Fallback: match IIN= pattern
  const iinMatch = /(?:^|[,;\s])IIN=(\d{12})/i.exec(subjectDn)
  if (iinMatch?.[1]) return iinMatch[1]

  return null
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Open a WebSocket connection to NCALayer.
 * Rejects with NCANotRunningError if connection fails.
 *
 * @QA-Chaos-Monkey: Tracks connection state for partial-operation recovery.
 */
export function openNCALayer(): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    setPhase('connecting')

    const timer = setTimeout(() => {
      ws.close()
      resetConnectionState()
      reject(new NCANotRunningError())
    }, CONNECT_TIMEOUT_MS)

    const ws = new WebSocket(NCALAYER_URL)

    ws.addEventListener('open', () => {
      clearTimeout(timer)
      connectionState.ws = ws
      connectionState.startedAt = Date.now()
      setPhase('connected')
      resolve(ws)
    })

    ws.addEventListener('error', () => {
      clearTimeout(timer)
      resetConnectionState()
      reject(new NCANotRunningError())
    })

    // @QA-Chaos-Monkey: Handle unexpected close during connection
    ws.addEventListener('close', () => {
      if (connectionState.phase !== 'idle' && connectionState.phase !== 'disconnected') {
        connectionState.interrupted = true
        setPhase('disconnected')
      }
    })
  })
}

/**
 * Quick non-blocking check: returns true if NCALayer is reachable, false otherwise.
 * Use this BEFORE attempting to sign, so the UI can show instructions proactively.
 */
export async function checkNCALayerAvailable(): Promise<boolean> {
  try {
    const ws = await openNCALayer()
    ws.close()
    resetConnectionState()
    return true
  } catch {
    resetConnectionState()
    return false
  }
}

/**
 * Get info about the certificate currently loaded in NCALayer.
 */
export async function getNCAKeyInfo(
  ws: WebSocket,
  keyType: NCAKeyType = 'PKCS12',
): Promise<NCAKeyInfo> {
  setPhase('fetching_key_info')
  return sendRequest<NCAKeyInfo>(
    ws,
    {
      module: 'kz.gov.pki.knca.basics',
      method: 'getKeyInfo',
      args:   { type: keyType },
    },
    CONNECT_TIMEOUT_MS,
  )
}

/**
 * Sign an XML string with the user's ЭЦП via NCALayer.
 *
 * Always uses GOST3410_2015_256 (current НУРК standard).
 * Always uses keyType='PKCS12' which maps to the SIGN key slot for FNO.
 */
export async function signXML(
  ws: WebSocket,
  xml: string,
  keyType: NCAKeyType = 'PKCS12',
  algorithm: NCAAlgorithm = 'GOST3410_2015_256',
): Promise<string> {
  setPhase('signing')
  const result = await sendRequest<{ xml: string }>(
    ws,
    {
      module: 'kz.gov.pki.knca.basics',
      method: 'signXml',
      args:   {
        type:                       keyType,
        algorithm,
        xml,
        signingNodeId:              '',
        tbsElementXPath:            '',
        signatureParentElementXPath: '',
      },
    },
    SIGN_TIMEOUT_MS,
  )
  return result.xml
}

/**
 * Validate that the returned XML actually contains an XMLDSig <Signature> element.
 * NCALayer should always embed this, but we verify defensively.
 *
 * @throws NCAInvalidSignatureError if no signature element is found
 */
export function validateSignedXML(xml: string): void {
  setPhase('validating_signature')
  if (!xml.includes('<ds:Signature') && !xml.includes('<Signature')) {
    throw new NCAInvalidSignatureError()
  }
}

/**
 * One-shot convenience: open NCALayer → validate SIGN key → validate expiry →
 * validate IIN match → sign XML with GOST3410_2015_256 → validate XMLDSig → close connection.
 *
 * @param xml       — unsigned declaration XML
 * @param algorithm — signing algorithm (default GOST3410_2015_256)
 * @param expectedIin — declarant's IIN for BIN mismatch check (KGD 2026 §4.3.2)
 *
 * @throws NCANotRunningError      — NCALayer not running
 * @throws NCADisconnectedError    — WebSocket dropped mid-operation (@QA-Chaos-Monkey)
 * @throws NCAWrongKeyTypeError    — loaded key is AUTH, not SIGN
 * @throws NCAKeyExpiredError      — certificate validity period has ended
 * @throws NCABinMismatchError     — certificate IIN ≠ declarant IIN (@Security-Auditor)
 * @throws NCARevokedCertError     — certificate is on CRL (@Security-Auditor)
 * @throws NCAWrongPasswordError   — wrong key password entered by user
 * @throws NCAUserCancelledError   — user dismissed the NCALayer dialog
 * @throws NCAInvalidSignatureError — returned XML lacks XMLDSig block
 * @throws NCATimeoutError         — NCALayer did not respond in time
 */
export async function connectAndSign(
  xml: string,
  algorithm: NCAAlgorithm = 'GOST3410_2015_256',
  expectedIin?: string,
): Promise<{ keyInfo: NCAKeyInfo; signedXml: string }> {
  const ws = await openNCALayer()
  try {
    // 1. Get certificate info
    setPhase('fetching_key_info')
    const keyInfo = await getNCAKeyInfo(ws).catch(classifyError)

    // 2. Enforce SIGN key — AUTH key is not valid for tax declarations
    setPhase('validating_certificate')
    if (keyInfo.keyUsage !== 'SIGN') {
      throw new NCAWrongKeyTypeError(keyInfo.keyUsage)
    }

    // 3. Check expiry before wasting user's time on password prompt
    const validTo = new Date(keyInfo.validTo)
    if (validTo < new Date()) {
      throw new NCAKeyExpiredError(validTo.toLocaleDateString('ru-KZ'))
    }

    // 4. @Security-Auditor: Validate IIN/BIN match (KGD ISNA 2026 §4.3.2)
    if (expectedIin) {
      const certIin = extractIinFromSubjectDn(keyInfo.subjectDn)
      if (certIin && certIin !== expectedIin) {
        throw new NCABinMismatchError(certIin, expectedIin)
      }
      // Store extracted IIN in keyInfo for UI display
      if (certIin) {
        keyInfo.certIin = certIin
      }
    }

    // 5. Sign with the required algorithm
    setPhase('signing')
    const rawSignedXml = await signXML(ws, xml, 'PKCS12', algorithm).catch(classifyError)

    // 6. Validate the returned XML actually has a signature block
    validateSignedXML(rawSignedXml)

    setPhase('disconnected')
    return { keyInfo, signedXml: rawSignedXml }
  } catch (err) {
    // @QA-Chaos-Monkey: Mark interrupted if we were mid-operation
    if (
      connectionState.phase === 'signing' ||
      connectionState.phase === 'fetching_key_info' ||
      connectionState.phase === 'validating_certificate'
    ) {
      connectionState.interrupted = true
    }
    throw err
  } finally {
    ws.close()
    resetConnectionState()
  }
}

/**
 * Generate the unsigned declaration XML on the client side for signing.
 * This mirrors the server-side XML generators so the user signs the exact
 * same data that would be submitted to ИСНА.
 *
 * Also used as the fallback download when NCALayer is unavailable.
 */
export function buildDeclarationXML(params: {
  iin: string
  fullName: string
  period: string
  formType: string
  grossIncome: number
  incomeTax: number
  socialTax: number
  pensionContrib: number
  medicalInsurance: number
  taxableIncome: number
  totalDeductions: number
}): string {
  const esc = (v: string) =>
    v
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  const language = currentLanguage()
  const xmlComment = (text: string) => `<!-- ${text.replace(/--/g, '- -')} -->`
  const labelComment = (code: string, label: string) => xmlComment(`${code} - ${label}`)
  const metadata = (formCode: string) => xmlComment(
    `${t('declarations.xml.generatedMetadata')}: form=${formCode}; language=${language}; generatedAt=${new Date().toISOString()}`,
  )

  if (params.formType === 'FORM_910') {
    const qm = /^(\d{4})-Q([1-4])$/.exec(params.period)
    const year = qm ? qm[1]! : params.period.slice(0, 4)
    const halfYear = qm ? (parseInt(qm[2]!, 10) <= 2 ? 1 : 2) : 1

    return `<?xml version="1.0" encoding="UTF-8"?>
${metadata('910.00')}
${xmlComment(t('declarations.form.FORM_910.label'))}
<F910 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <general>
    ${xmlComment(t('declarations.xml.generalSection'))}
    ${labelComment('tin', t('settings.profile.iinTitle'))}
    <tin>${esc(params.iin)}</tin>
    ${labelComment('name', t('settings.profile.fullName'))}
    <name>${esc(params.fullName)}</name>
    ${labelComment('year', t('declarations.xml.reportingYear'))}
    <year>${year}</year>
    ${labelComment('period', t('declarations.create.period'))}
    <period>${halfYear}</period>
    ${labelComment('periodType', t('declarations.xml.periodType'))}
    <periodType>H</periodType>
    ${labelComment('isFirstDelivery', t('declarations.xml.firstDelivery'))}
    <isFirstDelivery>true</isFirstDelivery>
    ${labelComment('version', t('declarations.xml.version'))}
    <version>37</version>
  </general>
  <f910_00>
    ${xmlComment(t('declarations.xml.form910Section'))}
    ${labelComment('910.00.001 A', t('declarations.xml.nonMonetaryIncome'))}
    <row1a>0</row1a>
    ${labelComment('910.00.001 B', t('declarations.xml.monetaryIncome'))}
    <row1b>${Math.round(params.grossIncome)}</row1b>
    ${labelComment('910.00.001', t('declarations.detail.calculation.grossIncome'))}
    <row1>${Math.round(params.grossIncome)}</row1>
    ${labelComment('910.00.002', t('declarations.detail.calculation.incomeTax', { rate: 3 }))}
    <row2>${Math.round(params.incomeTax)}</row2>
    ${labelComment('910.00.003', t('declarations.xml.employeeCount'))}
    <row3>0</row3>
    ${labelComment('910.00.004', t('declarations.detail.calculation.pension'))}
    <row4>${Math.round(params.pensionContrib)}</row4>
    ${labelComment('910.00.004 A', t('declarations.detail.calculation.pension'))}
    <row4a>0</row4a>
    ${labelComment('910.00.005', t('declarations.detail.calculation.socialTax'))}
    <row5>0</row5>
    ${labelComment('910.00.006', t('declarations.xml.individualIncomeTax'))}
    <row6>0</row6>
    ${labelComment('910.00.007', t('declarations.detail.calculation.totalDue'))}
    <row7>${Math.round(params.incomeTax + params.pensionContrib + params.medicalInsurance)}</row7>
    ${labelComment('910.00.008', t('declarations.detail.calculation.medical'))}
    <row8>${Math.round(params.medicalInsurance)}</row8>
  </f910_00>
</F910>`
  }

  if (params.formType === 'FORM_200') {
    const year = params.period.slice(0, 4)
    return `<?xml version="1.0" encoding="UTF-8"?>
${metadata('200.00')}
${xmlComment(t('declarations.form.FORM_200.label'))}
<F200 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <general>
    ${xmlComment(t('declarations.xml.generalSection'))}
    ${labelComment('tin', t('settings.profile.iinTitle'))}
    <tin>${esc(params.iin)}</tin>
    ${labelComment('name', t('settings.profile.fullName'))}
    <name>${esc(params.fullName)}</name>
    ${labelComment('year', t('declarations.xml.reportingYear'))}
    <year>${year}</year>
    ${labelComment('version', t('declarations.xml.version'))}
    <version>28</version>
  </general>
  <f200_00>
    ${xmlComment(t('declarations.xml.form200Section'))}
    ${labelComment('200.00.001', t('declarations.detail.calculation.grossIncome'))}
    <row1>${Math.round(params.grossIncome)}</row1>
    ${labelComment('200.00.002', t('declarations.detail.calculation.totalDeductions'))}
    <row2>${Math.round(params.totalDeductions)}</row2>
    ${labelComment('200.00.003', t('declarations.detail.calculation.taxableIncome'))}
    <row3>${Math.round(params.taxableIncome)}</row3>
    ${labelComment('200.00.004', t('declarations.detail.calculation.incomeTax', { rate: 10 }))}
    <row4>${Math.round(params.incomeTax)}</row4>
    ${labelComment('200.00.005', t('declarations.detail.calculation.pension'))}
    <row5>${Math.round(params.pensionContrib)}</row5>
    ${labelComment('200.00.006', t('declarations.detail.calculation.medical'))}
    <row6>${Math.round(params.medicalInsurance)}</row6>
    ${labelComment('200.00.007', t('declarations.detail.calculation.totalDue'))}
    <row7>${Math.round(params.incomeTax + params.pensionContrib + params.medicalInsurance)}</row7>
  </f200_00>
</F200>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
${metadata(params.formType)}
<FNO language="${esc(language)}">
  <iin>${esc(params.iin)}</iin>
  <formType>${esc(params.formType)}</formType>
  <period>${esc(params.period)}</period>
  <tax>${Math.round(params.incomeTax + params.socialTax + params.pensionContrib + params.medicalInsurance)}</tax>
</FNO>`
}
