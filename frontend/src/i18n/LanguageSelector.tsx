import { useTranslation } from 'react-i18next'
import { cn } from '@utils/cn'
import { getCurrentLanguage, LANGUAGE_OPTIONS, setLanguage, type SupportedLanguage } from './index'
import { updateProfileApi } from '@api/users.api'
import { useAuthStore } from '@store/authStore'

interface LanguageSelectorProps {
  compact?: boolean
  className?: string
}

export function LanguageSelector({ compact = false, className }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation()
  const { user, accessToken, setUser } = useAuthStore()
  const currentLanguage = getCurrentLanguage()

  async function handleChange(language: SupportedLanguage) {
    if (language !== currentLanguage) {
      await setLanguage(language)
      if (user != null && accessToken != null) {
        try {
          const updated = await updateProfileApi({ preferredLanguage: language })
          setUser(updated, accessToken)
        } catch (error) {
          console.warn('Failed to persist language preference:', error)
        }
      }
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl bg-navy-4/80 border border-border p-1',
        compact ? 'flex-col justify-center' : 'w-full',
        className,
      )}
      role="group"
      aria-label={t('common.language')}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.code === currentLanguage
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => void handleChange(option.code)}
            title={option.label}
            className={cn(
              'min-w-0 rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-green/40',
              compact ? 'w-10' : 'flex-1',
              active
                ? 'bg-green text-navy shadow-[0_0_16px_rgba(0,232,122,0.18)]'
                : 'text-white-dim hover:bg-white-ghost hover:text-white',
            )}
            aria-pressed={active}
            aria-label={option.label}
          >
            {compact ? option.shortLabel : option.shortLabel}
          </button>
        )
      })}
      <span className="sr-only">{i18n.language}</span>
    </div>
  )
}
