import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { loginSchema } from 'nalogai-shared/validators/auth.validators'
import type { LoginInput } from 'nalogai-shared/validators/auth.validators'
import { loginApi } from '@api/auth.api'
import { useAuthStore } from '@store/authStore'
import { toast } from '@store/notificationStore'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { ROUTES } from '@lib/constants'

// ── Logo mark (same as Navbar) ────────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="flex items-center justify-center gap-0.5 mb-8">
      <span className="font-display text-[22px] text-white leading-none">Nalog</span>
      <motion.span
        className="w-2 h-2 rounded-full bg-green mx-0.5"
        style={{ boxShadow: '0 0 8px rgba(0,232,122,0.5)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="font-display text-[22px] text-white leading-none">AI</span>
    </div>
  )
}

// ── Login Page ─────────────────────────────────────────────────────────────────
export function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, setUser } = useAuthStore()

  // Redirect already-authed users
  useEffect(() => {
    if (isAuthenticated) void navigate(ROUTES.DASHBOARD, { replace: true })
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginInput) {
    try {
      const result = await loginApi(values)
      setUser(result.user, result.accessToken)
      toast.success('Добро пожаловать!')
      void navigate(ROUTES.DASHBOARD, { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Ошибка входа. Попробуйте снова.'
      toast.error(message)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.05 },
    },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-5 py-10">
      <motion.div
        className="w-full max-w-[440px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div
          className="bg-navy-3 border border-border rounded-[20px] px-10 py-12"
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
        >
          <motion.div variants={itemVariants}>
            <LogoMark />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display text-[28px] text-white text-center"
          >
            Войти в аккаунт
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="font-body text-[15px] text-white-dim text-center mt-2"
          >
            Введите email и пароль
          </motion.p>

          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit(onSubmit)}
            className="mt-8 flex flex-col gap-4"
            noValidate
          >
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              type="password"
              label="Пароль"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="text-right -mt-2">
              <Link
                to="/forgot-password"
                className="font-body text-[13px] text-green hover:text-green-dim transition-colors duration-150"
              >
                Забыли пароль?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={isSubmitting}
            >
              Войти
            </Button>
          </motion.form>

          {/* Divider */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-4 my-8"
          >
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-[13px] text-white-dim">или</span>
            <div className="flex-1 h-px bg-border" />
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="font-body text-[14px] text-white-dim text-center"
          >
            Нет аккаунта?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="text-green hover:text-green-dim transition-colors duration-150"
            >
              Зарегистрироваться
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}
