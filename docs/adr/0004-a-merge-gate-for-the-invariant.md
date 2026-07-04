# ADR-0004 — A merge gate: CI runs the invariant's safety net on every PR

## Status
Accepted — 2026-07-04. Supersedes the "no CI gates" decision in
[ADR-0003](0003-genesis-quality-posture.md), which was scoped to a solo, pre-PMF Genesis.

## Context
A second engineer joins Estoca as the product gains traction. Until now the invariant
("the Stock never lies") was protected by design *and* by a silent fact: a single
careful person, holding the whole model, touched all the code. With two engineers that
fact no longer holds — a well-meaning change can break the invariant or introduce a
regression, and no one would notice until a Merchant sees a number that lies.

The existing automated safety net (Vitest, over the movement→Stock logic) only helps if
someone remembers to run it before merging. "Remembering" is not a quality strategy.

ADR-0003 deliberately refused CI — correctly, for a solo pre-PMF founder. The arrival of
engineer #2 is exactly the condition that flips that trade-off.

## Decision
Changes reach `main` only through a **Pull Request**, and a PR may merge only if the
**automated safety net passes in CI**.

- **PR + branch protection:** direct pushes to `main` are disallowed; every change goes
  through a PR (a GitHub ruleset on `main`).
- **CI (GitHub Actions):** on every PR, `npm ci && npm test && npm run build` runs the
  invariant safety net and type-checks the build. A failing check blocks the merge.
- The CI check is the **deterministic guardian of the invariant** — it encodes our rule
  and does not depend on anyone's memory.

## Considered options
- **Human review only** — valuable for design and context, but a person may not catch an
  invariant break, and review depends on attention. Kept as a *complementary* layer, not
  the guardian.
- **AI code review (Copilot et al.) as the guardian** — rejected: an AI reviewer does not
  know our invariant and could approve a change that stores Stock as a mutable counter.
  It protects broad quality, not *this* rule. May be reconsidered later as an extra
  layer, once it demonstrably adds more signal than noise for a two-person team.
- **No gate, trust and discipline** — rejected: this is exactly the risk the second
  engineer introduces.

## Consequences
- The one invariant that must never break is now protected by design *and* by a gate
  that cannot be forgotten.
- Small friction per change (open a PR, wait for CI). Acceptable and healthy at two
  engineers — the flow is the point.
- Watch-out: the safety net currently covers only the invariant logic. As user-facing
  flows stabilize, revisit adding an end-to-end (Playwright) check to the gate — per the
  E2E watch-out already flagged in ADR-0003.
