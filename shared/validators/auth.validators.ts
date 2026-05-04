import { z } from 'zod'
import { validateIIN } from '../utils/iinValidator'

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email обязателен' })
    .email('Некорректный email'),
  password: z
    .string({ required_error: 'Пароль обязателен' })
    .min(1, 'Пароль обязателен'),
})

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email обязателен' })
    .email('Некорректный email'),
  password: z
    .string({ required_error: 'Пароль обязателен' })
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .max(128, 'Пароль слишком длинный')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
  fullName: z
    .string({ required_error: 'Имя обязательно' })
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя слишком длинное'),
})

// Reusable IIN field: empty string → undefined (field omitted), non-empty →
// must be 12 digits and pass the Luhn-based checksum defined in validateIIN().
const iinField = z
  .string()
  .transform((v) => (v.trim() === '' ? undefined : v.trim()))
  .pipe(
    z
      .string()
      .regex(/^\d{12}$/, 'ИИН должен содержать 12 цифр')
      .refine(validateIIN, 'ИИН недействителен (неверная контрольная цифра)')
      .optional()
  )

export const onboardingSchema = z.object({
  businessType: z.enum(['SELF_EMPLOYED', 'SOLE_PROPRIETOR', 'LLC'], {
    required_error: 'Выберите тип деятельности',
  }),
  taxRegime: z.enum(
    ['SIMPLIFIED_DECLARATION', 'GENERAL_REGIME', 'PATENT', 'ESP'],
    { required_error: 'Выберите налоговый режим' }
  ),
  iin: iinField.optional(),
})

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100)
    .optional(),
  iin: iinField.optional(),
  businessType: z
    .enum(['SELF_EMPLOYED', 'SOLE_PROPRIETOR', 'LLC'])
    .optional(),
  taxRegime: z
    .enum(['SIMPLIFIED_DECLARATION', 'GENERAL_REGIME', 'PATENT', 'ESP'])
    .optional(),
  preferredLanguage: z
    .enum(['ru', 'kk', 'en'])
    .optional(),
})

export const updateNotificationPrefsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  telegramNotifications: z.boolean().optional(),
  notifyDaysBefore: z
    .array(z.number().int().positive())
    .max(10)
    .optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>
