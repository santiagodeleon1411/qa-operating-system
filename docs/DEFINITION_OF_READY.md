# Definition of Ready — Estoca

A piece of work is **ready** to enter development when all of the criteria below hold. This
document is expected to evolve as the product and team change.

It is the mirror of the [Definition of Done](DEFINITION_OF_DONE.md): the Definition of Done
guards the **exit** to production; the Definition of Ready guards the **entrance** to
development. Its purpose is to keep work from being built before it is worth building,
buildable, and verifiable — and never in a form that would require the Stock to lie.

A request that does not yet meet these criteria is not rejected. It is **refined** — with
the person who raised it — until it does. Refinement is where a raw request becomes ready;
it is not a gate that sends work away.

---

## The criteria

A reviewer confirms, before the work is scheduled:

1. **The problem is stated, not only the solution.**
   The request says what the Merchant is trying to achieve, not just what to build. "Let
   them set the stock number" is a proposed solution; "Merchants need to reconcile the
   system with a physical count" is the problem. Stating the problem is what lets a better,
   safer solution be found — and often reveals that the first-proposed solution was not the
   only way, or not the right one.

2. **It has been checked against the invariant and the existing guarantees.**
   No work enters in a form that would require the Stock to lie — a stored, mutable counter,
   a second source of truth, or a value the client can write directly. When the literal
   request collides with the invariant, it is **reframed** into a version that honors it
   before it enters. This is the project's spine: the illegal state is made impossible, not
   permitted under control.

3. **Acceptance criteria exist and are testable.**
   The work enters with the specific, verifiable conditions that define it as correct,
   written so each can become a test. A criterion that cannot be turned into a test is not
   yet a criterion — it is an opinion, and it is sharpened until it is testable.

4. **The edge cases and failure paths are named.**
   Not only the happy path: the empty, zero, boundary, duplicate, and stale cases, and what
   the user sees when something goes wrong. An unnamed edge does not disappear; it is
   discovered mid-build as a bug or an argument. Naming it up front is cheaper than finding
   it late.

5. **Its unknowns and dependencies are surfaced.**
   Anything the work needs that does not yet exist — another feature, a decision not yet
   made, data not yet captured — is called out now, not discovered halfway through. A hidden
   dependency is a deadline that has already slipped without anyone knowing.

---

## Ready is a shared standard

A request typically originates with the Product Manager. Making it *ready* is a shared act:
the PM owns the problem and its priority; the reviewer owns whether it can be built and
verified without weakening what the product already guarantees. Neither half is optional,
and the standard is met before development starts — not negotiated once code is being
written, which is the most expensive moment to discover that the work was never ready.
