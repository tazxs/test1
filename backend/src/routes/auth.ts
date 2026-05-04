import { Router } from 'express'
import { z } from 'zod'
import { AuthService } from '@services/AuthService'
import { validate } from '@middleware/validate'
import { requireAuth } from '@middleware/auth'
import { authLimiter } from '@middleware/rateLimit'
import { sendSuccess } from '@utils/response'
import { asyncHandler } from '@utils/asyncHandler'
import {
  loginSchema,
  registerSchema,
  onboardingSchema,
} from 'nalogai-shared/validators/auth.validators'

const REFRESH_COOKIE = 'refreshToken'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  path: '/api/auth',
}

export const authRouter = Router()

authRouter.use(authLimiter)

// POST /api/auth/register
authRouter.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body as {
    email: string
    password: string
    fullName: string
  }
  const result = await AuthService.register(email, password, fullName)
  res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS)
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 201)
}))

// POST /api/auth/login
authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string }
  const result = await AuthService.login(email, password)
  res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS)
  sendSuccess(res, { user: result.user, accessToken: result.accessToken })
}))

// POST /api/auth/refresh
authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No refresh token' },
    })
    return
  }
  const tokens = await AuthService.refresh(token)
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS)
  sendSuccess(res, { accessToken: tokens.accessToken })
}))

// POST /api/auth/logout
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined
  if (token) {
    await AuthService.logout(token)
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  }
  sendSuccess(res, null)
}))

// GET /api/auth/me
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await AuthService.getMe(req.user!.sub)
  sendSuccess(res, { user })
}))

// POST /api/auth/onboarding
authRouter.post('/onboarding', requireAuth, validate(onboardingSchema), asyncHandler(async (req, res) => {
  const body = req.body as {
    businessType: string
    taxRegime: string
    iin?: string
  }
  const user = await AuthService.completeOnboarding(req.user!.sub, body)
  sendSuccess(res, { user })
}))

// POST /api/auth/forgot-password
const forgotPasswordSchema = z.object({
  email: z.string().email('Некорректный email'),
})

authRouter.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string }
  await AuthService.forgotPassword(email)
  // Always return success to prevent email enumeration
  sendSuccess(res, { message: 'Если аккаунт существует, письмо для сброса пароля отправлено' })
}))

// POST /api/auth/reset-password
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  password: z
    .string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .max(128, 'Пароль слишком длинный')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
})

authRouter.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token: string; password: string }
  await AuthService.resetPassword(token, password)
  sendSuccess(res, { message: 'Пароль успешно изменён' })
}))
