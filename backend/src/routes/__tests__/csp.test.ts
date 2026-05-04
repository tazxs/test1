/**
 * CSP (Content Security Policy) audit test.
 *
 * Verifies that the backend's helmet configuration produces
 * the expected CSP headers that block unauthorized external scripts.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../app'

describe('CSP Headers — Security Audit', () => {
  it('includes Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['content-security-policy']).toBeDefined()
    expect(typeof res.headers['content-security-policy']).toBe('string')
  })

  it('CSP restricts default-src to self', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string
    expect(csp).toContain("default-src 'self'")
  })

  it('CSP blocks inline scripts (no unsafe-inline in script-src)', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string
    // script-src should NOT contain 'unsafe-inline'
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/)
    expect(scriptSrcMatch).toBeTruthy()
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'")
  })

  it('CSP restricts frame-src to none', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string
    expect(csp).toContain("frame-src 'none'")
  })

  it('CSP restricts object-src to none', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string
    expect(csp).toContain("object-src 'none'")
  })

  it('CSP allows only trusted connect-src domains', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string
    const connectSrcMatch = csp.match(/connect-src\s+([^;]+)/)
    expect(connectSrcMatch).toBeTruthy()

    const allowedDomains = connectSrcMatch![1]
    // Must include our API
    expect(allowedDomains).toContain("'self'")
    // Must include Sentry
    expect(allowedDomains).toContain('sentry.io')
    // Must include Groq
    expect(allowedDomains).toContain('api.groq.com')
    // Must include Google Gemini
    expect(allowedDomains).toContain('generativelanguage.googleapis.com')
  })

  it('CSP allows Google Fonts in style-src and font-src', async () => {
    const res = await request(app).get('/api/health')
    const csp = res.headers['content-security-policy'] as string

    // style-src should include Google Fonts
    const styleSrcMatch = csp.match(/style-src\s+([^;]+)/)
    expect(styleSrcMatch).toBeTruthy()
    expect(styleSrcMatch![1]).toContain('fonts.googleapis.com')

    // font-src should include Google Fonts static
    const fontSrcMatch = csp.match(/font-src\s+([^;]+)/)
    expect(fontSrcMatch).toBeTruthy()
    expect(fontSrcMatch![1]).toContain('fonts.gstatic.com')
  })

  it('includes X-Content-Type-Options header (nosniff)', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('includes X-Frame-Options header (DENY)', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('includes Strict-Transport-Security header', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })
})
