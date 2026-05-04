/**
 * RagService — retrieval-augmented generation for NK RK tax law.
 *
 * Flow:
 *   user query → Gemini text-embedding-004 → vector(768)
 *               → pgvector cosine similarity search against tax_law_chunks
 *               → top-k articles returned with articleNumber, title, content
 *
 * The returned articles are injected into Gemini/Groq prompts as grounded context,
 * eliminating hallucination of NK RK article numbers.
 *
 * Resilience: if GEMINI_API_KEY is absent or the DB has no embeddings yet,
 * searchRelevantArticles() returns [] gracefully — the AI falls back to
 * parametric knowledge without crashing the request.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@utils/language'
import { terminologyPromptBlock } from '@utils/taxTerminology'

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768

export interface TaxLawResult {
  articleNumber: string
  title: string
  content: string
  similarity: number
}

export class RagService {
  private genAI: GoogleGenerativeAI | null = null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
    } else {
      logger.warn('RagService: GEMINI_API_KEY not set — RAG disabled, AI will use parametric knowledge only')
    }
  }

  /**
   * Search the tax law knowledge base for articles relevant to `query`.
   * Returns top-k results sorted by cosine similarity (highest first).
   * Returns [] if embeddings are unavailable or the table is empty.
   */
  async searchRelevantArticles(query: string, topK = 5): Promise<TaxLawResult[]> {
    if (!this.genAI) return []

    try {
      const embedding = await this.embed(query)
      if (!embedding) return []

      // pgvector cosine distance operator: <=>
      // 1 - distance = similarity (0–1, higher = more relevant)
      const vectorLiteral = `[${embedding.join(',')}]`

      const rows = await prisma.$queryRawUnsafe<Array<{
        article_number: string
        title: string
        content: string
        similarity: number
      }>>(
        `SELECT article_number, title, content,
                1 - (embedding <=> $1::vector) AS similarity
         FROM tax_law_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        vectorLiteral,
        topK,
      )

      return rows.map((r) => ({
        articleNumber: r.article_number,
        title:         r.title,
        content:       r.content,
        similarity:    r.similarity,
      }))
    } catch (err) {
      // Never crash the AI request due to RAG failure — degrade gracefully
      logger.warn('RagService: search failed, continuing without RAG context', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  /**
   * Format RAG results as a human-readable block for prompt injection.
   * Each article is presented with its number, title, and content.
   *
   * @param maxContentLen  Truncate article content to this length (default 1500).
   *                       Use a smaller value (e.g. 1200) for providers with tighter
   *                       context windows such as Groq Llama models.
   */
  formatForPrompt(articles: TaxLawResult[], maxContentLen = 1500, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
    if (articles.length === 0) return ''
    const articleBlock = articles
      .map((a) => {
        const content = a.content.length > maxContentLen
          ? a.content.slice(0, maxContentLen) + '…'
          : a.content
        return `${a.articleNumber} «${a.title}»:\n${content}`
      })
      .join('\n\n')

    return [
      `RAG_LANGUAGE=${language}. When summarizing these Tax Code excerpts, answer in the user language and keep exact article numbers.`,
      terminologyPromptBlock(language),
      articleBlock,
    ].join('\n\n')
  }

  /**
   * Generate a vector(768) embedding for the given text using Gemini's
   * text-embedding-004 model. Returns null on failure.
   */
  async embed(text: string): Promise<number[] | null> {
    if (!this.genAI) return null
    try {
      const model = this.genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
      const result = await model.embedContent(text.slice(0, 2000))
      const values = result.embedding.values
      if (values.length !== EMBEDDING_DIMENSIONS) {
        logger.warn('RagService: unexpected embedding dimensions', { got: values.length, expected: EMBEDDING_DIMENSIONS })
        return null
      }
      return values
    } catch (err) {
      logger.warn('RagService: embedding failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }
}

export const ragService = new RagService()
