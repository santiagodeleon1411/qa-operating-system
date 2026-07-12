# Definition of Done — Estoca

A change is **done** when both halves below hold. This document is expected to evolve as
the product and team change.

Its single purpose is to protect the invariant: **the Stock never lies — and we know who
moved it, and whether they were allowed to.**

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

4. **Attribution and authorization are preserved.**
   Every write path still records *who* acted and enforces *whether they were allowed* on
   the server, not only in the UI. A new or changed write endpoint keeps its 401/403
   guards, and adjustment reasons remain a closed server-side enum. The UI may hide a
   control it cannot use, but the server must still refuse the request behind it — the
   guarantee is enforced where it cannot be bypassed, not merely where it is displayed.

---

## Review is mandatory

A change reaches `main` only with **one human approval**. This is the human half of
"done" and is not optional.

- **Enforcement:** the GitHub ruleset requires one approval on `main` and both CI checks
  to pass. It was **activated on 2026-07-12, ahead of the second engineer's start, so the
  repository is ready the day they can review.** GitHub does not permit self-approval, so
  during the short single-contributor window before their account joins, a routine change
  waits for that first reviewer rather than merging alone; the break-glass exception below
  covers a genuine emergency in the interim. This document was the operative standard
  before enforcement and remains the standard that enforcement points to.

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
