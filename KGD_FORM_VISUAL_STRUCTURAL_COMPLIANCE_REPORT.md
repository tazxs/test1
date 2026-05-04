# High-Fidelity Comparison Report: NalogAI Export vs Official KGD Form 910.00

## Verdict

**Status: Not compliant for PDF/visual-form launch.**

NalogAI currently generates Form 910.00 as XML only. A KGD-style PDF export/preview with fixed field coordinates, embedded Kazakh-capable fonts, and searchable text does not exist in the authored codebase. Because there is no generated declaration PDF artifact, the requested high-fidelity PDF comparison cannot be passed.

## Official Reference Baseline

- KGD announced that the new taxpayer cabinet, KNP ISNA, supports the 2026 Form 910.00 for taxpayers using the simplified declaration regime as of February 6, 2026.
- KGD states the forms and completion explanations are approved by Ministry of Finance Order No. 695 dated November 12, 2025.
- KGD hosts a SONO form archive for `form_910_00_v27_r133` dated December 30, 2025. The download was reachable, but the archive could not be extracted by standard `tar`/`bz2` tools in this environment.
- A legacy KGD PDF sample for Form 910.00 confirms the printed form uses fixed visual fields for tax period, year, IIN/BIN, currency code, row codes, and row labels.

Sources:
- KGD ISNA availability notice: https://zhts.kgd.gov.kz/ru/news/v-novom-kabinete-nalogoplatelshchika-dostupny-formy-nalogovoy-otchetnosti-70101-91000-21-163066
- KGD hosted template archive: https://kgd.gov.kz/sites/default/files/ftpdata/SONO/install/forms/910.00/20251230/form_910_00_v27_r133.tar.bz2
- KGD legacy Form 910.00 PDF sample: https://kgd.gov.kz/sites/default/files/npa/fno/2015/910.00.pdf
- 2026 MRP law source: https://adilet.zan.kz/rus/docs/Z2500000239

## NalogAI Export Surface

Current implementation:

- Backend Form 910.00 XML generator: `backend/src/services/EGovService.ts`
- Frontend NCALayer fallback XML generator: `frontend/src/services/ncalayer.ts`
- Declaration detail UI PDF action: `frontend/src/pages/DeclarationDetail.tsx`
- Declaration DB/API field: `pdfUrl`

There is no authored PDF generator, no `PDFDocument`/`pdfkit` usage, no KGD PDF template placement map, and no route that creates or serves generated declaration PDFs.

## Agent Findings

### Linguistic-Expert: Kazakh Glyph Rendering

Result: **Fail for production PDF readiness; risk for UI typography.**

- No generated declaration PDF exists, so Kazakh glyph kerning in PDF cannot be inspected.
- `pdfkit` is installed, but no PDFKit font registration exists.
- If PDFKit defaults are used later, Kazakh/Cyrillic glyph rendering is not reliable.
- Current web fonts are not fully safe for Kazakh:
  - `IBM Plex Mono` covers `ә і ң ғ ү ұ қ ө һ`.
  - `Manrope` covers only part of the Kazakh glyph set.
  - `Syne` misses all tested Kazakh-specific glyphs.

Required fix:

- Embed a Unicode font with full Kazakh coverage in every generated PDF.
- Avoid `Syne` for Kazakh headings or provide a Kazakh-capable heading font.

### Government-Form-Auditor: KGD Template Match

Result: **Fail for exact official template/schema match.**

Current XML emits:

- `<year>`
- `<period>` with `1` or `2`
- `<periodType>H</periodType>`
- `<version>37</version>`
- Row fields such as `<row1a>`, `<row1b>`, `<row1>`, `<row2>`, `<row3>`, `<row4>`, `<row4a>`, `<row5>`, `<row6>`, `<row7>`, `<row8>`

Critical gaps:

- No official 2026 XSD/schema is checked into the repo.
- No coordinate map exists for KGD PDF fields.
- No generated PDF exists, so exact coordinates for “Tax Period” and “Income Code” cannot be verified.
- No `incomeCode`, `код дохода`, activity code, or row-level income-code field is emitted by the Form 910.00 generator.
- Backend source itself labels the XML as simplified and warns to verify against exact KGD XSD before production.

Required fix:

- Import the official `form_910_00_v27_r133` schema/template into a controlled fixture directory.
- Validate generated XML against that official schema in CI.
- Add a KGD PDF template/field coordinate map if NalogAI intends to generate a visual PDF equivalent.

### Accessibility-Specialist: Searchable PDF Readability

Result: **Fail: no generated declaration PDF exists.**

- `pdfUrl` is nullable and not populated by declaration routes.
- The PDF button is disabled when `pdfUrl` is null.
- When `pdfUrl` is present, the UI currently shows a toast only; it does not open or download the PDF.
- Mock data references `/pdfs/910-2024-Q4.pdf`, but no matching files exist.
- Existing local PDFs are bank statements, not NalogAI declaration exports. They are searchable, but irrelevant to Form 910.00.

Required fix:

- Generate searchable text PDFs, not image-only renders.
- Ensure text extraction works for Kazakh and Russian labels.
- Make the PDF button actually open/download the generated artifact.
- Add automated text extraction tests for generated PDF contents.

## MRP Compliance Check

User constraint: **use 3,932 KZT as the 2026 MRP base.**

Code result: **passes the user-stated constraint, but conflicts with current official 2026 law.**

Evidence:

- `shared/constants/taxRates.ts` sets `MRP_2025 = 3_932` and aliases `MRP = MRP_2025`.
- Calculations in `TaxCalculatorService` derive MRP-based thresholds and fixed amounts from that value.
- However, the current official 2026 budget law on Adilet states the 2026 monthly calculation index is **4,325 KZT**, not 3,932 KZT.

Recommendation:

- Decide immediately whether launch compliance follows the sprint constraint or current law.
- If legal compliance is required for 2026, update the tax constants and tests to 4,325 KZT.

## Field-Level Comparison

| Requirement | Official/KGD Expectation | NalogAI Current State | Result |
|---|---|---|---|
| Form 910.00 availability for 2026 | KGD says 910.00 is available in KNP ISNA for 2026 | NalogAI supports a simplified XML path | Partial |
| Official schema/template | `form_910_00_v27_r133`, dated 2025-12-30 | No local schema/template fixture | Fail |
| Tax period | Visual form has period/year fields; 2026 form is ISNA-backed | XML emits year, half-year period, `periodType=H` | Partial |
| Income code | Must match official template if required | No income/activity code emitted | Fail / Unknown pending schema |
| Exact PDF coordinates | Required for visual template equivalence | No PDF generator or coordinate map | Fail |
| Kazakh glyphs in PDF | Must render without fallback or layout breakage | No PDF; no embedded fonts | Fail |
| Searchable PDF | Text must be extractable/searchable | No declaration PDF exists | Fail |
| User data review | Users should inspect exact export | Summary + XML download only | Partial |
| MRP 2026 | User requested 3,932; current law says 4,325 | Code uses 3,932 | Pass user constraint / fail legal freshness |

## Required Launch Blockers

1. Add official KGD 2026 Form 910.00 schema/template fixtures and validate XML against them.
2. Implement a real Form 910.00 PDF generator or remove/disable PDF claims until implemented.
3. Use embedded Kazakh-capable fonts in generated PDFs.
4. Add automated searchable-PDF tests using text extraction.
5. Add a coordinate/field mapping test if NalogAI must visually match KGD’s PDF form.
6. Resolve the 2026 MRP contradiction: 3,932 KZT per sprint constraint vs 4,325 KZT per current official law.

## Final Assessment

NalogAI’s current export is useful as a localized XML signing path, but it is not a high-fidelity KGD visual form export. It cannot yet satisfy visual template compliance, exact coordinate placement, Kazakh PDF typography, or searchable generated PDF requirements.
