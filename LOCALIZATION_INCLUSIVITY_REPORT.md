# Localization & Inclusivity Complete

Date: 2026-04-30

## Scope Completed

- Added trilingual frontend support for Russian, Kazakh, and English with `i18next` / `react-i18next`.
- Added locale bundles for Dashboard, Transactions, Settings, navigation, shared status/actions, and formatting copy.
- Added first-time language prompt and persisted language selectors in the desktop sidebar and Settings/mobile flow.
- Added locale-aware KZT/date formatting through `Intl` with `ru-KZ`, `kk-KZ`, and `en-US`.
- Added Kazakh layout hardening for long navigation/settings labels and bottom tab labels.
- Added backend `kk | ru | en` language detection for AI categorization, AI advice, chat, and streaming chat.
- Added official Kazakh tax terminology mapping for AI prompts and communications:
  - `ИП` -> `жеке кәсіпкер (ЖК)`
  - `Упрощенка` -> `оңайлатылған декларация негізіндегі арнаулы салық режимі`
  - `МРП` -> `АЕК`
  - `ИПН` -> `жеке табыс салығы`
  - `социальный налог` -> `әлеуметтік салық`
- Added localized notification templates for Telegram, email, deadline reminders, deadline alerts, and test notifications.
- Added `preferredLanguage` to the user profile so background workers can resume notifications in the user's chosen language after restarts.
- Added `Accept-Language` propagation for Axios and SSE AI chat requests.

## Files Of Note

- `frontend/src/i18n/index.ts`
- `frontend/src/i18n/LanguageSelector.tsx`
- `frontend/src/i18n/locales/kk.json`
- `frontend/src/i18n/locales/ru.json`
- `frontend/src/i18n/locales/en.json`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Transactions.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/api/axios.ts`
- `frontend/src/api/ai.api.ts`
- `backend/src/utils/language.ts`
- `backend/src/utils/taxTerminology.ts`
- `backend/prompts/systemPrompt.ts`
- `backend/prompts/advicePrompt.ts`
- `backend/src/routes/ai.ts`
- `backend/src/services/NotificationService.ts`
- `backend/src/jobs/notificationWorker.ts`
- `backend/prisma/migrations/20260430120000_add_preferred_language/migration.sql`
- `artifacts/localization/ai-advisor-kk.log`

## Bundle Budget

Locale JSON size total: 30,384 bytes.

- `en.json`: 8,096 bytes
- `kk.json`: 11,275 bytes
- `ru.json`: 11,013 bytes

Result: under the 50 KB sprint limit.

## AI Advisor Kazakh Log

Verification artifact: `artifacts/localization/ai-advisor-kk.log`

Query:

```text
2026 жылы оңайлатылған декларация бойынша салық қанша?
```

Logged result confirms:

- `Accept-Language=kk`
- detected language `kk`
- Kazakh prompt terminology
- response uses `оңайлатылған декларация негізіндегі арнаулы салық режимі`, `АЕК`, `жеке табыс салығы`, and `әлеуметтік салық`
- current calculator assumption remains `MRP=3932 KZT`

## Health And Metrics

- Local health endpoint: `GET /api/health`
- Expected deployed endpoint: `https://<api-domain>/api/health`

The health payload includes:

- `status`: `ok` or `degraded`
- `db`
- `redis`
- `observability.sentry`
- `observability.logging.format`
- `observability.logging.userIdFilterable`
- `observability.circuits`
- `notifications.queue.retryPolicy`
- `notifications.queue.memoryBudget`
- `notifications.queue.counts`

## Compliance Notes

- Default language remains Russian when browser/storage preference is absent.
- First-time users are prompted to choose a UI language.
- No Sentry DSNs or other secrets are hardcoded.
- Background notification jobs remain compact; rendered localized templates are produced in workers.
- Redis queue memory budget from the prior resilience sprint remains capped at 64 MB, 25% of the 256 MB Redis target.

## Legal Data Note

The implementation preserves the sprint's existing calculator source of truth: `TaxCalculatorService` and shared tax constants with `MRP_2025 = 3932`.

QA found public 2026 references that should be reconciled in a separate tax-data update before changing calculations:

- eGov public AEK reference: https://egov.kz/cms/kk/articles/article_mci_2012
- KGD regional simplified-regime 2026 reference: https://www.gov.kz/memleket/entities/kgd-vko/press/news/details/1119217?lang=kk

This report does not silently change tax formulas or the MRP constant.

## Verification

- `npm run db:generate --workspace=backend`
- `npm run db:deploy --workspace=backend`
- `npm run typecheck`
- `npm run test --workspace=frontend -- --run`
- `npm run test --workspace=backend -- --run`
- `npm run build`

All listed verification commands passed after applying the local migration.
