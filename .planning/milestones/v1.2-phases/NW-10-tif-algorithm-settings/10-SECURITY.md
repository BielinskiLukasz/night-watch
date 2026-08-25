---
phase: NW-10
slug: tif-algorithm-settings
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-24
---

# Phase NW-10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Event log store input | Day records passed to metrics.js and tifForecast() are internal trusted data | Sleep times (minutes integers), no PII |
| Settings modal FormData | User-entered algorithm settings validated by validateSettings before reaching the store | forecastAlgorithm enum, trimPct integer, precisionTarget integer |
| TIF prediction output | Algorithm-computed strings rendered in today-screen.js | HH:MM times, precision score (0–100 integer) |
| PRECACHE_LIST | Static compile-time constant — no runtime user input | File paths only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01-01 | Tampering | metrics.js arithmetic | low | accept | Pure functions with no side effects; integer-safe arithmetic (max 1440 min); null guards prevent NaN propagation | closed |
| T-10-02-01 | Tampering | trimmedMinMax negative budget | low | mitigate | `budget = Math.max(0, ...)` at forecast-tif.js:68 prevents negative trim; empty trimmed array returns null gracefully | closed |
| T-10-02-02 | Tampering | Anchor resolution with no TIF predictions | low | mitigate | resolveAnchor returns null when no prediction available; confirmed by null-return guards throughout forecast-tif.js | closed |
| T-10-02-03 | DoS | Very large event logs | low | accept | O(N log N) algorithm; 365-day max is negligible | closed |
| T-10-03-01 | Tampering | forecastAlgorithm enum | low | mitigate | Enum rule `values: new Set(['classic','tif'])` at settings-validate.js:57 rejects any other string | closed |
| T-10-03-02 | Tampering | trimPct/precisionTarget out-of-range | low | mitigate | Integer bounds `trimPct: {min:0,max:40}`, `precisionTarget: {min:1,max:300}` at settings-validate.js:58–59 | closed |
| T-10-03-03 | Tampering | PRECACHE_LIST path injection | low | accept | Frozen static constant; no runtime modification possible | closed |
| T-10-04-01 | Tampering | forecastAlgorithm FormData value | low | mitigate | Same enum RULE in validateSettings rejects invalid values; modal stays open on error | closed |
| T-10-04-02 | Tampering | trimPct/precisionTarget non-numeric input | low | mitigate | Number() coercion of non-numeric strings → NaN → fails integer check → validation error | closed |
| T-10-04-03 | Tampering | Handler accumulation on repeated Settings opens | low | mitigate | Module-level `_forecastAlgorithmChangeHandler` removes previous handler before attaching new one (settings-modal.js:97–98) | closed |
| T-10-05-01 | XSS | TIF card DOM rendering | high | mitigate | All prediction values (central, min, max, precision score) rendered via textContent through el() helper — never innerHTML; confirmed by today-screen.js:15–19 header comment and grep | closed |
| T-10-05-02 | Tampering | Algorithm branch selection | low | mitigate | Branch keyed on snap.forecastAlgorithm validated to 'classic'\|'tif' before storage; no injection path | closed |
| T-10-05-03 | Information Disclosure | Precision score display | low | accept | Precision score is algorithm output (0–100 integer) — no user PII or sensitive data | closed |

*Status: closed*
*Severity: critical > high > medium > low*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-01-01 | Pure arithmetic functions with bounded integer inputs (max 1440 min/day); no mutation or injection path | gsd-security-auditor | 2026-08-24 |
| AR-10-02 | T-10-02-03 | Event log capped at ~365 days in practice; O(N log N) sort is negligible; no server-side blast radius | gsd-security-auditor | 2026-08-24 |
| AR-10-03 | T-10-03-03 | PRECACHE_LIST is frozen at module load; SW registration is browser-controlled; no runtime write path | gsd-security-auditor | 2026-08-24 |
| AR-10-04 | T-10-05-03 | Precision score is a computed 0–100 integer; exposes no user PII or sensitive behavioral data | gsd-security-auditor | 2026-08-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-24 | 13 | 13 | 0 | gsd-security-auditor (L1 grep, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-24
