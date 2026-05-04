import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { api } from '@api/axios'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { ROUTES } from '@lib/constants'

const schema = z.object({
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Z]/, 'Нужна заглавная буква')
    .regex(/[0-9]/, 'Нужна цифра'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (!token) {
    return (
      <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-navy-2 p-8 text-center">
          <h1 className="font-display text-xl text-white mb-3">Недействительная ссылка</h1>
          <p className="font-body text-sm text-white-dim mb-6">
            Ссылка для сброса пароля недействительна или отсутствует.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="inline-block rounded-lg bg-green px-6 py-2.5 font-body text-sm font-semibold text-navy hover:bg-green-dim transition-colors"
          >
            Вернуться к входу
          </Link>
        </div>
      </div>
    )
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      setSuccess(true)
      setTimeout(() => navigate(ROUTES.LOGIN), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка сервера'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px] rounded-2xl border border-border bg-navy-2 p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17L4 12" />
            </svg>
          </div>
          <h1 className="font-display text-xl text-white mb-3">Пароль изменён</h1>
          <p className="font-body text-sm text-white-dim">
            Ваш пароль успешно изменён. Перенаправление на страницу входа...
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] rounded-2xl border border-border bg-navy-2 p-8"
      >
        <h1 className="font-display text-xl text-white mb-2">Новый пароль</h1>
        <p className="font-body text-sm text-white-dim mb-6">
          Введите новый пароль для вашего аккаунта.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Новый пароль"
            type="password"
            placeholder="Минимум 8 символов"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Подтвердите пароль"
            type="password"
            placeholder="Повторите пароль"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {error && (
            <p className="font-body text-sm text-red">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Сменить пароль
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
