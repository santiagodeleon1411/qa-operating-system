# ADR-0003 — Genesis quality posture: protect one invariant, defer everything else

## Status
Accepted — 2026-07-04

## Context
At Genesis, Estoca is three people with no product-market fit. The product will be
rewritten several times before it stabilizes, so any heavy quality infrastructure
built now would be thrown away. But the product's entire value proposition is trust
in a single number — the **Stock** on hand. We need a quality posture calibrated to
*this* maturity, not to a best-practice checklist.

## Decision
The worst failure mode is **"Stock lies"** — the displayed Stock not matching the
physical shelf. We concentrate essentially all quality effort there and deliberately
defer everything else.

**Protect the invariant structurally.** Stock is always *derived from the Merchant's
Stock movements* — an append-only ledger of entries and exits — never stored as a
separately mutable counter that can drift. This makes "Stock lies" hard *by
construction* rather than by remembering to test for it.

**We install, and nothing more:**
- A small automated safety net (~5–6 tests) over the movement→stock logic: double
  registration, concurrent movements, negative stock.
- A 10-minute manual smoke ritual on the core flow (load Product → entry → exit →
  Stock correct → Stockout alert fires), run by the founders before showing any Merchant.
- Lightweight bug capture in a single markdown list — no tool.

**We deliberately refuse (too early for this maturity):**
- A dedicated QA hire.
- A formal test plan or test-case-management tool.
- An end-to-end UI test framework — the UI changes weekly pre-PMF; maintenance would
  exceed value.
- CI gates, coverage targets, a regression suite, staging ceremony.

## Considered options
- **Mutable Stock counter with transactional guards** — simpler to build, but leaves
  "Stock lies" one race or glitch away and keeps no audit trail. Rejected: it turns
  the catastrophic failure into a discipline problem instead of a structural
  near-impossibility.
- **Full test automation from day one** — rejected on ROI: pre-PMF churn would
  discard it.

## Consequences
- Quality effort is proportional to **risk and company maturity**, not to a checklist.
- The one invariant that must never break is protected by design.
- The movements ledger becomes an asset later: audit trail, reporting, and the
  foundation for the offline sync we already flagged as a future need.
- Watch-out: "refuse E2E automation" must be revisited the moment the UI and flows
  stabilize (approaching PMF). This ADR is *expected* to be superseded then — per
  [ADR-0001](0001-how-we-record-decisions.md), we will supersede it, not quietly edit it.
