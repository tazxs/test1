/**
 * MailService — SMTP-based email sending via nodemailer.
 * 
 * Uses SMTP configuration from environment variables.
 * Falls back to console logging if SMTP is not configured (dev mode).
 * All templates are bilingual (RU/KK) with professional NalogAI branding.
 */
import nodemailer from 'nodemailer'
import { logger } from '@utils/logger'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM ?? 'NalogAI Support <noreply@nalogai.kz>'
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null

interface SendMailOptions {
  to: string
  subject: string
  html: string
}

async function sendMail(options: SendMailOptions): Promise<void> {
  if (!transporter) {
    // Dev mode — log instead of sending
    logger.info('📧 MailService (dev mode — no SMTP configured)', {
      to: options.to,
      subject: options.subject,
      preview: options.html.slice(0, 200),
    })
    return
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    logger.info('Email sent', { to: options.to, subject: options.subject })
  } catch (err) {
    logger.error('Failed to send email', { to: options.to, error: err })
    // Don't throw — email failure shouldn't break the flow
  }
}

// ── Bilingual Password Reset Template (RU/KK) ────────────────────────────────

function passwordResetTemplate(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0e1a; color: #e0e0e0; padding: 40px 20px; margin: 0; }
    .container { max-width: 480px; margin: 0 auto; background: #141926; border-radius: 16px; border: 1px solid #1e2538; padding: 40px; }
    .logo { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 24px; }
    .logo span { color: #00E87A; }
    h1 { font-size: 20px; color: #fff; margin-bottom: 12px; }
    p { font-size: 14px; color: #8892a8; line-height: 1.6; margin-bottom: 20px; }
    .btn { display: inline-block; background: #00E87A; color: #0a0e1a; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 10px; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #1e2538; margin: 24px 0; }
    .lang-section { margin-bottom: 24px; }
    .lang-label { font-size: 11px; color: #4a5568; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .footer { font-size: 12px; color: #4a5568; margin-top: 32px; border-top: 1px solid #1e2538; padding-top: 16px; }
    .footer a { color: #00E87A; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Nalog<span>AI</span></div>

    <!-- Russian Section -->
    <div class="lang-section">
      <div class="lang-label">Русский</div>
      <h1>Сброс пароля</h1>
      <p>Вы запросили сброс пароля для вашего аккаунта NalogAI. Нажмите кнопку ниже, чтобы создать новый пароль.</p>
      <p>Ссылка действительна в течение <strong>1 часа</strong>.</p>
      <a href="${resetUrl}" class="btn">Сбросить пароль</a>
    </div>

    <hr class="divider">

    <!-- Kazakh Section -->
    <div class="lang-section">
      <div class="lang-label">Қазақша</div>
      <h1>Құпия сөзді қалпына келтіру</h1>
      <p>Siz NalogAI аккаунтыңыз үшін құпия сөзді қалпына келтіруді сұрадыңыз. Жаңа құпия сөз жасау үшін төмендегі батырманы басыңыз.</p>
      <p>Сілтеме <strong>1 сағат</strong> ішінде жарамды.</p>
      <a href="${resetUrl}" class="btn">Құпия сөзді қалпына келтіру</a>
    </div>

    <div class="footer">
      <p>Если вы не запрашивали сброс пароля / Егер сіз құпия сөзді қалпына келтіруді сұрамаған болсаңыз, просто проигнорируйте это письмо.</p>
      <p style="margin-top: 12px;">
        <strong>NalogAI Support</strong><br>
        <a href="https://nalogai.kz">nalogai.kz</a> · <a href="mailto:support@nalogai.kz">support@nalogai.kz</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ── Public API ────────────────────────────────────────────────────────────────

export const MailService = {
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${APP_URL}/reset-password?token=${token}`
    await sendMail({
      to: email,
      subject: 'NalogAI — Сброс пароля / Құпия сөзді қалпына келтіру',
      html: passwordResetTemplate(resetUrl),
    })
  },
}
