import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { api } from '@api/axios'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { ROUTES } from '@lib/constants'

const schema = z.object({
  email: z.string().email('Некорректный email'),
})

type FormData = z.infer<typeof schema>

export function ForgotPassword() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка сервера'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px] rounded-2xl border border-border bg-navy-2 p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </div>
          <h1 className="font-display text-xl text-white mb-3">Письмо отправлено</h1>
          <p className="font-body text-sm text-white-dim mb-6">
            Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса пароля.
            Проверьте вашу почту.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="inline-block rounded-lg bg-green px-6 py-2.5 font-body text-sm font-semibold text-navy hover:bg-green-dim transition-colors"
          >
            Вернуться к входу
          </Link>
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
        <h1 className="font-display text-xl text-white mb-2">Забыли пароль?</h1>
        <p className="font-body text-sm text-white-dim mb-6">
          Введите ваш email и мы отправим ссылку для сброса пароля.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          {error && (
            <p className="font-body text-sm text-red">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Отправить ссылку
          </Button>
        </form>

        <p className="mt-6 text-center font-body text-sm text-white-dim">
          Вспомнили пароль?{' '}
          <Link to={ROUTES.LOGIN} className="text-green hover:underline">
            Войти
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
