# ADR-0001 — How this organization records decisions

## Status
Accepted — 2026-07-04

## Context
QA Operating System simulates a QA organization growing alongside a B2B SaaS
company. Across that growth we will make many consequential decisions — tooling,
process, risk posture, hiring, release strategy. The value of this project is not
the decisions themselves but the **reasoning** behind them: a reader (the QA /
Engineering Manager evaluating this work) should be able to reconstruct *how we
think* before ever meeting us. That requires a durable, low-friction way to record
decisions and the trade-offs behind them.

## Decision
We record consequential decisions as **Decision Records (ADRs)** in `docs/adr/`,
numbered sequentially (`NNNN-slug.md`). We use "ADR" broadly — for any decision
worth remembering, not only architectural ones.

We write an ADR only when **all three** are true:

1. **Hard to reverse** — changing our mind later carries real cost.
2. **Surprising without context** — a future reader would ask "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and we chose one for specific reasons.

If any is missing, we skip the ADR. Reversible or obvious decisions don't earn one.

Each ADR states, at minimum, the **context**, the **decision**, and the **why**.
Optional sections (Considered Options, Consequences, Status) are added only when
they add value.

Separately, we maintain a **`CONTEXT.md`** glossary — the canonical, opinionated
language of our fictional company — created lazily when the first domain term is
resolved.

Guiding principle (inherited from `HOW_WE_WORK.md`):
**document the reasoning, not only the result.**

## Considered options
- **No formal record (chat/notes only)** — rejected: reasoning evaporates between
  stages and sessions; the portfolio would show conclusions without the thinking
  that is its entire point.
- **Heavyweight templates (a full RFC per decision)** — rejected: friction kills
  the habit, most decisions don't warrant it, and volume would bury the signal.
- **Lightweight ADRs gated by a three-part test (chosen)** — cheap to write,
  self-limiting, and legible to an outside reader.

## Consequences
- A running, browsable decision trail that doubles as the portfolio's spine.
- Low maintenance cost; the three-part test prevents ADR sprawl.
- Risk: under-documenting a decision that later proves to matter.
  Mitigation: any stage can retroactively add an ADR.
- Risk: hindsight bias making every past decision look correct.
  Mitigation: when a decision ages badly we **supersede** it with a new ADR rather
  than editing history — the correction is itself evidence of judgment.
