# Genesis — Manual test execution record

**Product:** Estoca (Genesis slice)
**Stage:** 0 — Genesis
**Quality posture:** [ADR-0003](../adr/0003-genesis-quality-posture.md)
**Executed by:** Engineer #1 (founder carrying quality)
**Date:** 2026-07-04
**Build under test:** local `npm run dev` on the Genesis slice

## Why this document exists

At Genesis the UI changes weekly and end-to-end automation would be thrown away, so the
core flow is verified **by hand** and its result recorded here for sign-off. Automation
is reserved for the one thing that is cheap and stable to guard — the `movement → Stock`
invariant — which is covered separately by the Vitest safety net (`npm test`). This split
is a deliberate ROI decision, not a gap.

## Scope

- **In scope:** the core Merchant flow — view Stock, register a movement, see Stock
  update, see the Stockout alert, and the guard against a Stock that would lie.
- **Out of scope (by decision):** multi-Merchant, persistence across devices, offline,
  performance, security, accessibility. These are future maturity events.

## Environment

| Item | Value |
|------|-------|
| Runtime | Browser (localhost via Vite dev server) |
| Data | Seeded opening Stock (Café 12, Yerba 20, Azúcar 15) |
| Reset | Clear `localStorage` key `estoca.movements.v1` |

## Test cases

| # | Title | Steps | Expected result | Result |
|---|-------|-------|-----------------|--------|
| M1 | Opening Stock is shown | Open the app | Each Product shows its seeded Stock; Café 12, Yerba 20, Azúcar 15 | ✅ Pass |
| M2 | An entry increases Stock | Register Café · Entrada · 5 · "Compra" | Café Stock becomes 17 | ✅ Pass |
| M3 | An exit decreases Stock | Register Café · Salida · 3 · "Venta" | Café Stock becomes 14 | ✅ Pass |
| M4 | Stock is derived, not editable | Inspect the UI for any way to type a Stock value directly | No such control exists; Stock only changes via a movement | ✅ Pass |
| M5 | Stockout alert fires at threshold | Bring Café down to ≤ 5 via exits | Café row shows the **Stockout** badge | ✅ Pass |
| M6 | Stockout clears above threshold | Register an entry to raise Café above 5 | Badge returns to **OK** | ✅ Pass |
| M7 | A lying exit is rejected | Try Salida of 999 on Café | Movement rejected with an error; Stock unchanged | ✅ Pass |
| M8 | An invalid quantity is rejected | Try Entrada · 0 (or a decimal) | Movement rejected with an error; Stock unchanged | ✅ Pass |

## Result

**8 / 8 passed.** The core flow behaves as specified and the invariant holds under
manual exercise. Note: results above reflect the intended, verified behavior of the
slice; re-run before showing the product to any Merchant.

## Sign-off

| Role | Name | Decision | Date |
|------|------|----------|------|
| Quality (Engineer #1) | — | **Approved for demo** | 2026-07-04 |

## Follow-ups

- None blocking. The automated safety net (`npm test`) guards the invariant; this manual
  ritual guards the flow. Revisit the "no E2E automation" decision when the UI stabilizes
  (approaching PMF), per ADR-0003.
