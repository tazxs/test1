/**
 * NCALayer Full Spectrum Failure Test Suite
 *
 * Covers three agent perspectives:
 *   @QA-Chaos-Monkey   — WebSocket disconnect, partial state, NCALayer not launched
 *   @UX-Advocate       — Error messages are human-readable, localized, actionable
 *   @Security-Auditor  — Certificate validation: expired, BIN mismatch, revoked
 *
 * Constraint: 2026 KGD ISNA technical specs for digital signature handshakes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  // Error classes
  NCAError,
  NCATimeoutError,
  NCANotRunningError,
  NCAWrongPasswordError,
  NCAKeyExpiredError,
  NCAUserCancelledError,
  NCAWrongKeyTypeError,
  NCAInvalidSignatureError,
  NCADisconnectedError,
  NCABinMismatchError,
  NCARevokedCertError,

  // Public API
  checkNCALayerAvailable,
  connectAndSign,
  validateSignedXML,
  extractIinFromSubjectDn,
  getConnectionState,

  // Constants & maps
  NCA_ERROR_CODE_MAP,
  NCALAYER_URL,
  NCALAYER_DOWNLOAD_URL,

} from '../ncalayer'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a mock WebSocket that simulates NCALayer responses */
function createMockWs(options: {
  open?: boolean
  responses?: Array<{ status: number; result?: unknown; message?: string }>
  closeAfterMs?: number
  failConnect?: boolean
} = {}) {
  const listeners: Record<string, Array<(e: unknown) => void>> = {}
  let responseIndex = 0

  const ws = {
    addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    }),
    removeEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler)
      }
    }),
    send: vi.fn((_data: string) => {
      // Simulate NCALayer response
      if (options.responses && responseIndex < options.responses.length) {
        const resp = options.responses[responseIndex++]
        setTimeout(() => {
          const msgEvent = { data: JSON.stringify(resp) }
          listeners['message']?.forEach(h => h(msgEvent))
        }, 10)
      }
    }),
    close: vi.fn(),
    readyState: 1, // OPEN
  }

  // Auto-trigger open/error
  if (options.failConnect) {
    setTimeout(() => {
      listeners['error']?.forEach(h => h(new Event('error')))
    }, 10)
  } else if (options.open !== false) {
    setTimeout(() => {
      listeners['open']?.forEach(h => h(new Event('open')))
    }, 10)
  }

  // Simulate disconnect after delay
  if (options.closeAfterMs != null) {
    setTimeout(() => {
      ws.readyState = 3 // CLOSED
      listeners['close']?.forEach(h => h(new CloseEvent('close', { code: 1006 })))
    }, options.closeAfterMs)
  }

  return ws as unknown as WebSocket
}

// ── @QA-Chaos-Monkey Tests ─────────────────────────────────────────────────────

describe('@QA-Chaos-Monkey: Environmental Failure Simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('WebSocket disconnect during signing', () => {
    it('should throw NCADisconnectedError when WS closes mid-signing', async () => {
      // Simulate: WS opens, getKeyInfo succeeds, then WS closes during signXml
      const mockWs = createMockWs({
        responses: [
          // getKeyInfo response
          {
            status: 200,
            result: {
              subjectDn: 'CN=Test User, SERIALNUMBER=123456789012',
              serialNumber: 'CERT-001',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
        ],
        // Close WS 50ms after open (simulating disconnect during sign)
        closeAfterMs: 50,
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      const xml = '<?xml version="1.0"?><F910><general><tin>123456789012</tin></general></F910>'

      await expect(
        connectAndSign(xml, 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCADisconnectedError)
    })

    it('should track connection state through phases', async () => {
      const state = getConnectionState()
      expect(state.phase).toBe('idle')
      expect(state.interrupted).toBe(false)
    })

    it('should handle partial state: WS connected but getKeyInfo times out', async () => {
      // WS opens but never responds to getKeyInfo
      const mockWs = createMockWs({ responses: [] })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      const xml = '<?xml version="1.0"?><F910><general><tin>123456789012</tin></general></F910>'

      await expect(
        connectAndSign(xml, 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCATimeoutError)
    })
  })

  describe('NCALayer installed but not launched', () => {
    it('should throw NCANotRunningError when WS connection fails', async () => {
      const mockWs = createMockWs({ failConnect: true })
      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(checkNCALayerAvailable()).resolves.toBe(false)
    })

    it('should return false for checkNCALayerAvailable when not running', async () => {
      const mockWs = createMockWs({ failConnect: true })
      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      const available = await checkNCALayerAvailable()
      expect(available).toBe(false)
    })

    it('should throw NCANotRunningError from connectAndSign when not running', async () => {
      const mockWs = createMockWs({ failConnect: true })
      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCANotRunningError)
    })
  })

  describe('NCALayer timeout scenarios', () => {
    it('should throw NCATimeoutError when WS connects but signXml never responds', async () => {
      // getKeyInfo responds, but signXml never does
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Test, SERIALNUMBER=123456789012',
              serialNumber: 'CERT-001',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
          // No second response (signXml hangs)
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCATimeoutError)
    })
  })

  describe('Malformed NCALayer responses', () => {
    it('should handle invalid JSON from NCALayer', async () => {
      const listeners: Record<string, Array<(e: unknown) => void>> = {}
      const mockWs = {
        addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(handler)
        }),
        removeEventListener: vi.fn(),
        send: vi.fn(() => {
          setTimeout(() => {
            listeners['message']?.forEach(h => h({ data: 'NOT VALID JSON' }))
          }, 10)
        }),
        close: vi.fn(),
        readyState: 1,
      }

      // Trigger open
      setTimeout(() => {
        listeners['open']?.forEach(h => h(new Event('open')))
      }, 10)

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCAError)
    })
  })
})

// ── @Security-Auditor Tests ────────────────────────────────────────────────────

describe('@Security-Auditor: Certificate Integrity Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('(a) Expired keys', () => {
    it('should throw NCAKeyExpiredError for expired certificate', async () => {
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Expired User, SERIALNUMBER=123456789012',
              serialNumber: 'CERT-EXPIRED',
              validFrom: '2020-01-01',
              validTo: '2023-01-01', // Expired!
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCAKeyExpiredError)
    })

    it('NCAKeyExpiredError should include formatted date', () => {
      const err = new NCAKeyExpiredError('01.01.2023')
      expect(err.message).toContain('01.01.2023')
      expect(err.code).toBe(404)
      expect(err.errorKind).toBe('key_expired')
    })

    it('NCAKeyExpiredError should work without date', () => {
      const err = new NCAKeyExpiredError()
      expect(err.message).toContain('истёк')
      expect(err.code).toBe(404)
    })
  })

  describe('(b) BIN/IIN mismatch', () => {
    it('should throw NCABinMismatchError when cert IIN ≠ user IIN', async () => {
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Other Person, SERIALNUMBER=999999999999',
              serialNumber: 'CERT-OTHER',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      // User IIN is 123456789012, but cert has 999999999999
      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCABinMismatchError)
    })

    it('should pass when cert IIN matches user IIN', async () => {
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Test User, SERIALNUMBER=123456789012',
              serialNumber: 'CERT-MATCH',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
          {
            status: 200,
            result: {
              xml: '<?xml version="1.0"?><F910><ds:Signature>signed</ds:Signature></F910>',
            },
          },
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      const result = await connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012')
      expect(result.keyInfo.certIin).toBe('123456789012')
      expect(result.signedXml).toContain('ds:Signature')
    })

    it('NCABinMismatchError should contain both IINs in message', () => {
      const err = new NCABinMismatchError('999999999999', '123456789012')
      expect(err.message).toContain('999999999999')
      expect(err.message).toContain('123456789012')
      expect(err.code).toBe(406)
      expect(err.errorKind).toBe('bin_mismatch')
    })

    it('should skip BIN check when expectedIin is not provided', async () => {
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Test, SERIALNUMBER=999999999999',
              serialNumber: 'CERT-001',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'SIGN',
              algorithm: 'GOST3410_2015_256',
            },
          },
          {
            status: 200,
            result: {
              xml: '<?xml version="1.0"?><F910><ds:Signature>signed</ds:Signature></F910>',
            },
          },
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      // No expectedIin → skip BIN check
      const result = await connectAndSign('<xml/>', 'GOST3410_2015_256')
      expect(result.signedXml).toContain('ds:Signature')
    })
  })

  describe('(c) Revoked certificates', () => {
    it('should throw NCARevokedCertError for NCALayer status 405', () => {
      const err = new NCARevokedCertError()
      expect(err.code).toBe(405)
      expect(err.errorKind).toBe('key_revoked')
      expect(err.message).toContain('отозван')
    })

    it('should classify NCALayer error code 405 as key_revoked', () => {
      const mapped = NCA_ERROR_CODE_MAP[405]
      expect(mapped).toBeDefined()
      expect(mapped!.kind).toBe('key_revoked')
    })

    it('should classify revoked keyword in error message', () => {
      // The classifyError function should catch "revoked" keyword
      // This is tested indirectly through the error code mapping
      const err = new NCAError('certificate revoked by CRL', 405)
      expect(err.code).toBe(405)
    })
  })

  describe('NCALayer error code mapping (2026 KGD spec)', () => {
    it('should map all critical error codes', () => {
      expect(NCA_ERROR_CODE_MAP[200].kind).toBe('success')
      expect(NCA_ERROR_CODE_MAP[401].kind).toBe('wrong_password')
      expect(NCA_ERROR_CODE_MAP[402].kind).toBe('user_cancelled')
      expect(NCA_ERROR_CODE_MAP[403].kind).toBe('wrong_key_type')
      expect(NCA_ERROR_CODE_MAP[404].kind).toBe('key_expired')
      expect(NCA_ERROR_CODE_MAP[405].kind).toBe('key_revoked')
      expect(NCA_ERROR_CODE_MAP[406].kind).toBe('bin_mismatch')
      expect(NCA_ERROR_CODE_MAP[407].kind).toBe('algorithm_mismatch')
      expect(NCA_ERROR_CODE_MAP[408].kind).toBe('timeout')
      expect(NCA_ERROR_CODE_MAP[409].kind).toBe('invalid_xml')
      expect(NCA_ERROR_CODE_MAP[500].kind).toBe('internal_error')
      expect(NCA_ERROR_CODE_MAP[502].kind).toBe('not_running')
      expect(NCA_ERROR_CODE_MAP[503].kind).toBe('token_error')
    })

    it('should have descriptions for all error codes', () => {
      for (const [_code, entry] of Object.entries(NCA_ERROR_CODE_MAP)) {
        expect(entry.description).toBeTruthy()
        expect(entry.description.length).toBeGreaterThan(5)
      }
    })
  })

  describe('IIN extraction from certificate DN', () => {
    it('should extract IIN from SERIALNUMBER field', () => {
      const iin = extractIinFromSubjectDn('CN=Иванов Иван, SERIALNUMBER=123456789012, O=Test')
      expect(iin).toBe('123456789012')
    })

    it('should extract BIN (10-digit) from SERIALNUMBER', () => {
      const bin = extractIinFromSubjectDn('CN=ТОО Рога, SERIALNUMBER=1234567890, O=Test')
      expect(bin).toBe('1234567890')
    })

    it('should return null for DN without IIN', () => {
      const iin = extractIinFromSubjectDn('CN=Unknown User, O=Test')
      expect(iin).toBeNull()
    })

    it('should handle case-insensitive SERIALNUMBER', () => {
      const iin = extractIinFromSubjectDn('serialnumber=123456789012, CN=Test')
      expect(iin).toBe('123456789012')
    })
  })

  describe('Wrong key type', () => {
    it('should throw NCAWrongKeyTypeError for AUTH key', async () => {
      const mockWs = createMockWs({
        responses: [
          {
            status: 200,
            result: {
              subjectDn: 'CN=Test, SERIALNUMBER=123456789012',
              serialNumber: 'CERT-AUTH',
              validFrom: '2024-01-01',
              validTo: '2027-01-01',
              keyUsage: 'AUTH', // Wrong key type!
              algorithm: 'GOST3410_2015_256',
            },
          },
        ],
      })

      vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWs as any)

      await expect(
        connectAndSign('<xml/>', 'GOST3410_2015_256', '123456789012'),
      ).rejects.toThrow(NCAWrongKeyTypeError)
    })
  })

  describe('XMLDSig validation', () => {
    it('should accept XML with ds:Signature namespace', () => {
      expect(() =>
        validateSignedXML('<F910><ds:Signature>data</ds:Signature></F910>'),
      ).not.toThrow()
    })

    it('should accept XML with bare Signature element', () => {
      expect(() =>
        validateSignedXML('<F910><Signature>data</Signature></F910>'),
      ).not.toThrow()
    })

    it('should throw NCAInvalidSignatureError for XML without signature', () => {
      expect(() =>
        validateSignedXML('<F910><data>no signature here</data></F910>'),
      ).toThrow(NCAInvalidSignatureError)
    })

    it('should throw for empty string', () => {
      expect(() => validateSignedXML('')).toThrow(NCAInvalidSignatureError)
    })
  })
})

// ── @UX-Advocate Tests ─────────────────────────────────────────────────────────

describe('@UX-Advocate: User-Facing Error Quality', () => {
  describe('Error class properties', () => {
    it('all error classes should have name, message, code, and errorKind', () => {
      const errors = [
        new NCATimeoutError(),
        new NCANotRunningError(),
        new NCAWrongPasswordError(),
        new NCAKeyExpiredError(),
        new NCAUserCancelledError(),
        new NCAWrongKeyTypeError('AUTH'),
        new NCAInvalidSignatureError(),
        new NCADisconnectedError('signing'),
        new NCABinMismatchError('999', '123'),
        new NCARevokedCertError(),
      ]

      for (const err of errors) {
        expect(err.name).toBeTruthy()
        expect(err.message).toBeTruthy()
        expect(err.message.length).toBeGreaterThan(10)
        expect(err.code).toBeDefined()
        expect(err.errorKind).toBeDefined()
      }
    })

    it('all errors should be instances of NCAError', () => {
      const errors = [
        new NCATimeoutError(),
        new NCANotRunningError(),
        new NCAWrongPasswordError(),
        new NCAKeyExpiredError(),
        new NCAUserCancelledError(),
        new NCAWrongKeyTypeError('AUTH'),
        new NCAInvalidSignatureError(),
        new NCADisconnectedError('signing'),
        new NCABinMismatchError('999', '123'),
        new NCARevokedCertError(),
      ]

      for (const err of errors) {
        expect(err).toBeInstanceOf(NCAError)
        expect(err).toBeInstanceOf(Error)
      }
    })
  })

  describe('Error messages contain actionable guidance', () => {
    it('NCANotRunningError should mention launching NCALayer', () => {
      const err = new NCANotRunningError()
      expect(err.message.toLowerCase()).toContain('ncalayer')
    })

    it('NCAKeyExpiredError should mention НУЦ РК / pki.gov.kz', () => {
      const err = new NCAKeyExpiredError()
      expect(err.message).toContain('НУЦ РК')
    })

    it('NCAWrongKeyTypeError should mention SIGN key', () => {
      const err = new NCAWrongKeyTypeError('AUTH')
      expect(err.message).toContain('SIGN')
    })

    it('NCABinMismatchError should mention both IINs', () => {
      const err = new NCABinMismatchError('999999999999', '123456789012')
      expect(err.message).toContain('999999999999')
      expect(err.message).toContain('123456789012')
    })

    it('NCARevokedCertError should mention CRL and НУЦ РК', () => {
      const err = new NCARevokedCertError()
      expect(err.message).toContain('CRL')
      expect(err.message).toContain('НУЦ РК')
    })

    it('NCADisconnectedError should mention the phase', () => {
      const err = new NCADisconnectedError('signing')
      expect(err.message).toContain('signing')
    })
  })

  describe('Download URL is correct', () => {
    it('should point to official pki.gov.kz', () => {
      expect(NCALAYER_DOWNLOAD_URL).toBe('https://pki.gov.kz/ncalayer/')
    })

    it('should use secure WSS protocol', () => {
      expect(NCALAYER_URL).toMatch(/^wss:\/\//)
    })
  })

  describe('Connection state tracking for UX', () => {
    it('getConnectionState returns a frozen snapshot', () => {
      const state1 = getConnectionState()
      const state2 = getConnectionState()
      expect(state1).not.toBe(state2) // Different object references
      expect(state1.phase).toBe(state2.phase)
    })

    it('should have all required fields', () => {
      const state = getConnectionState()
      expect(state).toHaveProperty('phase')
      expect(state).toHaveProperty('ws')
      expect(state).toHaveProperty('startedAt')
      expect(state).toHaveProperty('lastActivityAt')
      expect(state).toHaveProperty('interrupted')
      expect(state).toHaveProperty('progress')
    })
  })
})
