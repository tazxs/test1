# Total Kazakh Compliance: Declarations & Deadlines Verified

## Scope

Emergency stabilization pass for declaration creation, declaration detail/preview, NCALayer signing fallback XML, Form 910.00 deadline cards, backend declaration XML generation, and cron-triggered deadline notifications.

## Completed

- Localized `/declarations`, `/declarations/:id`, deadline calendar cards, status badges, empty states, action buttons, signing modal copy, and PDF/XML fallback actions through i18n keys.
- Added Kazakh/Russian/English locale parity for declaration, deadline, signing, and XML label namespaces.
- Added localized client-side XML comments/labels for Form 910.00 and Form 200.00 previews/fallback downloads.
- Synced client XML row structure with backend `EGovService` generators.
- Added shared tax terminology constants so key terms such as `Individual Income Tax` map consistently to `Жеке табыс салығы`.
- Corrected Form 910.00 calculation periods from quarterly to semi-annual windows:
  - H1: January 1 through June 30
  - H2: July 1 through December 31
- Corrected Form 910.00 deadline templates:
  - H1 filing: August 15
  - H1 payment: August 25
  - H2 filing: February 15 of the following year
  - H2 payment: February 25 of the following year
- Localized deadline reminder names/dates and urgency phrasing, including Kazakh `1 күн қалды`.

## KGD Source Check

- KGD regional guidance states Form 910.00 is filed semi-annually, with H1 due by August 15 and H2 due by February 15.
- KGD guidance also states payment for taxes in the simplified declaration is due by the 25th day of the second month after the reporting period, matching August 25 and February 25.

Sources:
- https://vko.kgd.gov.kz/ru/node/55861
- https://shymkent.kgd.gov.kz/ru/news/vopros-hochu-rabotat-po-uproshchennoy-deklaracii-18-144292
- https://kst.kgd.gov.kz/kk/qa/category/11/Modernization%203.0?page=1

## Verification

- `npm run typecheck --workspace=frontend` passed.
- `npm run build --workspace=frontend` passed.
- `npm run typecheck --workspace=shared` passed.
- `npm exec --workspace=backend -- vitest run src/services/__tests__/EGovService.test.ts src/jobs/__tests__/notificationQueue.test.ts` passed: 21 tests.
- Locale JSON parse passed for `kk`, `ru`, and `en`.
- Locale key parity passed: 452 keys in each locale.
- Targeted hardcoded Cyrillic string scan passed for declaration/deadline TSX surfaces.
- `git diff --check` passed for the touched declaration/deadline/localization files.

## Known Non-Blocking Items

- `npm run typecheck --workspace=backend` remains blocked by existing unrelated unused-variable errors in `TaxPrecision50.test.ts` and `CloudPaymentsGateway.ts`.
- `npm exec --workspace=frontend -- vitest run src/services/__tests__/ncalayer.failure.test.ts` remains red due existing WebSocket timeout cases and Russian-only message assertions that now conflict with runtime localization.
- Browser visual QA was not run in this pass.
