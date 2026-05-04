# NCALayer Full Spectrum Failure Mapping Report

**Date:** 2026-05-01  
**Constraint:** 2026 KGD ISNA Technical Specifications §4.3.2–4.3.5  
**Agents:** @QA-Chaos-Monkey, @UX-Advocate, @Security-Auditor

---

## Failure Mapping Table: [Trigger → Result → User Message]

| # | Trigger | NCALayer Code | Error Class | ErrorKind | User Message (RU) | User Message (KK) | User Message (EN) | Recovery Action |
|---|---------|--------------|-------------|-----------|-------------------|-------------------|-------------------|-----------------|
| 1 | NCALayer not installed / not running | 502 | `NCANotRunningError` | `ncalayer_missing` | NCALayer не запущен или недоступен | NCALayer іске қосылмаған | NCALayer is not running | Show install instructions + download link to pki.gov.kz |
| 2 | WebSocket disconnect mid-signing (NCALayer crash, force-close, network drop) | 502 | `NCADisconnectedError` | `disconnected` | Соединение с NCALayer разорвано на этапе «signing» | Байланыс үзілді | Connection lost | Retry + check antivirus/firewall, port 13579 |
| 3 | NCALayer connected but no response within 60s | 408 | `NCATimeoutError` | `timeout` | Время ожидания NCALayer истекло | Күту уақыты аяқталды | Timed out | Ensure NCALayer is active, retry |
| 4 | Wrong key password entered by user | 401 | `NCAWrongPasswordError` | `wrong_password` | Неверный пароль ключа ЭЦП | ЭЦҚ құпиясөзі қате | Incorrect EDS password | Check Caps Lock, retry |
| 5 | Certificate validity period expired | 404 | `NCAKeyExpiredError` | `key_expired` | Срок действия ключа ЭЦП истёк {date} | ЭЦҚ мерзімі аяқталған | EDS key expired | Get new key at pki.gov.kz or ЦОН |
| 6 | Certificate revoked (CRL) | 405 | `NCARevokedCertError` | `key_revoked` | Сертификат ЭЦП отозван (CRL) | Сертификат кері қайтарылған | Certificate revoked | Contact НУЦ РК for new key |
| 7 | Certificate IIN ≠ Declarant IIN (BIN mismatch) | 406 | `NCABinMismatchError` | `bin_mismatch` | ЖСН сертификата ({certIin}) не совпадает с вашим ЖСН ({expectedIin}) | ЖСН сәйкес келмейді | IIN mismatch | Use personal EDS key matching your IIN |
| 8 | AUTH key loaded instead of SIGN key | 403 | `NCAWrongKeyTypeError` | `wrong_key_type` | Для ФНО требуется ключ «Подпись» (SIGN) | Декларацияға қол қою үшін SIGN-кілт қажет | A SIGN key is required | Load SIGN key in NCALayer |
| 9 | User cancelled NCALayer dialog | 402 | `NCAUserCancelledError` | `user_cancelled` | Подпись отменена пользователем | Қол қою тоқтатылды | Signing cancelled | Retry when ready |
| 10 | Signed XML lacks XMLDSig block | 409 | `NCAInvalidSignatureError` | `invalid_signature` | Подписанный XML не содержит подписи XMLDSig | Қол қойылған құжат валидациядан өтпеді | XMLDSig is missing | Retry signing operation |
| 11 | Unsupported signing algorithm | 407 | `NCAError` | `generic` | NCALayer ошибка (status 407) | Қол қою қатесі | Signature error | Ensure GOST3410_2015_256 is used |
| 12 | Cryptographic token not found | 503 | `NCAError` | `generic` | NCALayer ошибка (status 503) | Қол қою қатесі | Signature error | Insert Kaztoken / check USB |
| 13 | NCALayer internal error | 500 | `NCAError` | `generic` | NCALayer ошибка (status 500) | Қол қою қатесі | Signature error | Restart NCALayer, retry |
| 14 | Malformed JSON response from NCALayer | — | `NCAError` | `generic` | NCALayer вернул некорректный ответ | Белгісіз қате | An unknown error occurred | Restart NCALayer |

---

## Agent Analysis

### @QA-Chaos-Monkey: Environmental Failure Simulation

| Scenario | Before | After | Status |
|----------|--------|-------|--------|
| WebSocket disconnect mid-signing | Promise hangs for 60s timeout | `NCADisconnectedError` thrown immediately via `close` event listener | ✅ Fixed |
| NCALayer installed but not launched | Generic timeout after 5s | `NCANotRunningError` with install instructions + download link | ✅ Already handled |
| Partial state (connected, getKeyInfo hangs) | Promise hangs indefinitely | Timeout after 5s via `CONNECT_TIMEOUT_MS` | ✅ Already handled |
| Connection state tracking | No visibility into operation phase | `getConnectionState()` exposes phase, interrupted flag, progress | ✅ Added |
| Double-click / concurrent connections | Possible race conditions | Guard in `startSigning()` checks `state.step` | ✅ Already handled |

**Key improvement:** The `sendRequest()` function now listens for WebSocket `close` events, immediately rejecting with `NCADisconnectedError` instead of waiting for the full timeout. The `connectionState` object tracks the current phase (`idle → connecting → connected → fetching_key_info → validating_certificate → signing → validating_signature → disconnected`) for debugging and partial-state recovery.

### @UX-Advocate: Instruction Modal Audit

| Feature | Status | Details |
|---------|--------|---------|
| Direct download link to NCALayer | ✅ Present | `https://pki.gov.kz/ncalayer/` — opens in new tab |
| Localized troubleshooting (KK) | ✅ Added | 3-step guide in Kazakh + error messages for all 10 error kinds |
| Localized troubleshooting (RU) | ✅ Added | 3-step guide in Russian + error messages for all 10 error kinds |
| Localized troubleshooting (EN) | ✅ Added | 3-step guide in English + error messages for all 10 error kinds |
| Manual fallback (XML download) | ✅ Present | Download unsigned XML + link to KGD cabinet (knp.kgd.gov.kz) |
| Firewall/port guidance | ✅ Added | Disconnected error mentions port 13579 and antivirus/firewall |
| Distinct "not installed" vs "not running" | ⚠️ Combined | Both map to `ncalayer_missing` — NCALayer protocol doesn't distinguish |
| Error-specific icons | ✅ Present | Each error kind has a unique emoji icon for visual scanning |
| Retry button on all errors | ✅ Present | Every error panel includes a retry action |

### @Security-Auditor: Certificate Integrity Validation

| Check | KGD 2026 Spec | Implementation | Status |
|-------|--------------|----------------|--------|
| SIGN key enforcement | §4.3.2 | `keyUsage !== 'SIGN'` check before signing | ✅ |
| Certificate expiry | §4.3.2 | `validTo < new Date()` check before password prompt | ✅ |
| IIN/BIN match | §4.3.2 | `extractIinFromSubjectDn()` + `NCABinMismatchError` | ✅ Added |
| CRL revocation | §4.3.2 | `NCARevokedCertError` (code 405) + message pattern matching | ✅ Added |
| GOST3410_2015_256 algorithm | §4.3.3 | Default algorithm parameter, code 407 mapping | ✅ |
| XMLDSig validation | §4.3.4 | `validateSignedXML()` checks for `<ds:Signature` or `<Signature` | ✅ |
| Error code mapping | §4.3.5 | `NCA_ERROR_CODE_MAP` with 13 codes mapped | ✅ Added |

---

## NCALayer Error Code Map (2026 KGD ISNA Spec §4.3.5)

```
Code | Kind               | Description
-----|--------------------|----------------------------------
200  | success            | Operation completed successfully
401  | wrong_password     | Invalid key password (PIN)
402  | user_cancelled     | User cancelled the operation
403  | wrong_key_type     | Key type mismatch (AUTH vs SIGN)
404  | key_expired        | Certificate validity period ended
405  | key_revoked        | Certificate revoked (CRL)
406  | bin_mismatch       | Certificate IIN/BIN ≠ declarant
407  | algorithm_mismatch | Unsupported signing algorithm
408  | timeout            | NCALayer did not respond in time
409  | invalid_xml        | Input XML is malformed or empty
500  | internal_error     | NCALayer internal error
502  | not_running        | NCALayer unreachable
503  | token_error        | Cryptographic token not found
```

---

## Files Modified

| File | Changes |
|------|---------|
| [`ncalayer.ts`](nalogai/frontend/src/services/ncalayer.ts) | +3 error classes, +error code map, +connection state tracking, +IIN extraction, +WS disconnect detection, +BIN validation in `connectAndSign` |
| [`EGovSigningModal.tsx`](nalogai/frontend/src/components/declarations/EGovSigningModal.tsx) | +3 error kinds (`key_revoked`, `bin_mismatch`, `disconnected`), +IIN pass-through to `connectAndSign` |
| [`kk.json`](nalogai/frontend/src/i18n/locales/kk.json) | +3 error message sets (keyRevoked, binMismatch, disconnected) |
| [`ru.json`](nalogai/frontend/src/i18n/locales/ru.json) | +3 error message sets (keyRevoked, binMismatch, disconnected) |
| [`en.json`](nalogai/frontend/src/i18n/locales/en.json) | +3 error message sets (keyRevoked, binMismatch, disconnected) |
| [`ncalayer.failure.test.ts`](nalogai/frontend/src/services/__tests__/ncalayer.failure.test.ts) | New: 30+ test cases covering all failure scenarios |

---

## Test Coverage Summary

| Agent | Test Suite | Cases |
|-------|-----------|-------|
| @QA-Chaos-Monkey | `Environmental Failure Simulation` | 6 tests (disconnect, partial state, timeout, malformed response) |
| @Security-Auditor | `Certificate Integrity Validation` | 14 tests (expired, BIN mismatch, revoked, error codes, IIN extraction, XMLDSig) |
| @UX-Advocate | `User-Facing Error Quality` | 10 tests (error properties, actionable messages, URLs, state tracking) |
