/**
 * AIService — provider-agnostic AI facade.
 *
 * Set AI_PROVIDER=groq in .env to use Groq (Llama).
 * Defaults to Gemini when AI_PROVIDER is unset or set to "gemini".
 *
 * If the selected provider fails to initialise (e.g. missing API key), a
 * NullAiProvider is returned so the backend starts successfully — AI routes
 * will return 503 with a clear message instead of crashing the server.
 */
import type { IAiProvider } from './AiProviderService'
import { InternalError } from '@utils/errors'
import { logger } from '@utils/logger'

// ── Null provider — used when real provider fails to initialise ────────────────
class NullAiProvider implements IAiProvider {
  constructor(private readonly reason: string) {}

  private fail(): never {
    throw new InternalError(
      `AI provider not available — ${this.reason}. ` +
      'Add GROQ_API_KEY or GEMINI_API_KEY to your .env file.'
    )
  }

  // All methods delegate to fail() — never returns, satisfies every return type
  categorize:      IAiProvider['categorize']      = () => this.fail()
  categorizeBulk:  IAiProvider['categorizeBulk']  = () => this.fail()
  getAdvice:       IAiProvider['getAdvice']       = () => this.fail()
  chat:            IAiProvider['chat']            = () => this.fail()
  chatStream:      IAiProvider['chatStream']      = () => this.fail()
}

// ── Factory ────────────────────────────────────────────────────────────────────
function createAIService(): IAiProvider {
  const provider = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase()

  try {
    if (provider === 'groq') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { groqService } = require('./GroqService') as { groqService: IAiProvider }
      return groqService
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { geminiService } = require('./GeminiService') as { geminiService: IAiProvider }
    return geminiService
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logger.warn(
      `AI provider "${provider}" failed to initialise — AI routes will return 503. Reason: ${reason}`
    )
    return new NullAiProvider(reason)
  }
}

export const aiService: IAiProvider = createAIService()
