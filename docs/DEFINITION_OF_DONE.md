# Definition of Done — Estoca

A change is **done** when both halves below hold. This document is expected to evolve as
the product and team change.

Its single purpose is to protect the invariant: **the Stock never lies.**

---

## Half 1 — Automated (verified by CI)

Enforced by the merge gate ([ADR-0004](adr/0004-a-merge-gate-for-the-invariant.md)). It
requires no manual step:

- The **safety net passes** (`npm test`) — the invariant holds on the paths currently
  under test.
- The build **type-checks** (`npm run build`).

A green check satisfies this half. It is not re-verified by hand.

## Half 2 — Human (certified by a reviewer)

Automated checks only cover the cases already encoded in tests. A reviewer covers what
they cannot: new code, design decisions, and comprehension. On every PR the reviewer
certifies:

1. **The invariant is respected by design, not only by the tests.**
   Stock remains *derived* from movements — no new counter and no second parallel
   calculation. A new code path can pass the existing tests simply because they do not
   exercise it; only a reviewer who understands the invariant can identify a second
   source of truth.

2. **New behavior is covered by a test.**
   CI stays green when an untested feature is added, because the existing tests still
   pass. The reviewer confirms the safety net was extended with the change, so no gap is
   introduced where new behavior was added.

3. **The reviewer understands what the change does and why.**
   If the reviewer cannot explain the change in their own words, it is not done and is
   clarified or simplified before merging. Code that cannot be explained later is a
   maintenance liability regardless of test status.

4. **A design-bearing change carries its mockup.**
   For any change with a visual surface, a rendered mockup (HTML/CSS) and a PNG screenshot
   are committed under `docs/mockups/<issue#>-<slug>/`, built from the exact design tokens.
   This is the design source of record for Route B — the values the design test asserts
   against a computed style — and the visual record of the work. A change with no visual
   surface is exempt.

---

## Review is mandatory

A change reaches `main` only with **one human approval**. This is the human half of
"done" and is not optional.

- **Enforcement:** the GitHub ruleset requires one approval on `main`. It is **activated
  when a second engineer's account joins the repository.** GitHub does not permit
  self-approval, so requiring an approval on a single-contributor repository would force a
  bypass on every merge and remove the meaning of the exception below. Until a second
  reviewer exists, this document is the operative standard; enforcement is applied once it
  can function as intended.

## Break-glass exception

The repository admin may merge **without the required approval** only when **both**
conditions hold:

1. **Waiting causes real, present harm** — for example, the Stock is reporting incorrect
   values in production and a Merchant is acting on them. Time pressure alone does not
   qualify.
2. **The reviewer is genuinely unavailable** — off-hours, on leave, or unreachable. A
   delayed response is not unavailability, particularly if no request was sent. If the
   reviewer is available, the exception does not apply; request an expedited review
   instead.

Both conditions are required. If either is missing, the exception does not apply: either
wait, or obtain the expedited review.

Using the exception carries two obligations:

- **State the reason in the PR.** The bypass is recorded explicitly.
- **Obtain retroactive review.** The reviewer examines the change once available. An
  emergency fix merged under pressure is the change most likely to introduce a second
  defect; the emergency justifies merging before review, not omitting it. The review is
  deferred, not waived.
