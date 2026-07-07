# ADR-0008 — Identity: authentication, attribution, and authorization

## Status
Accepted — 2026-07-07. Resolves the "who" that
[the stock-count-adjustment spec](../specs/stock-count-adjustment.md) deferred as sensitive,
records the attribution into the append-only ledger of
[ADR-0006](0006-backend-and-database-with-the-invariant-in-the-schema.md), and supplies the
identity that the human-review lock in
[ADR-0005](0005-human-review-and-the-break-glass-valve.md) presupposes. The trigger is
present: the first pilot customer operates the product with employees, and an adjustment
recorded in production cannot be traced to a person.

## Context
The append-only ledger records every movement — its kind, quantity, reason, and time —
immutably. It does not record **who** made it. In a single-operator shop this is invisible.
The first pilot customer is not a single operator: the owner works alongside a new employee
and a delivery hand. When a physical-count adjustment reduces a Product by 40 units marked
"Robo o pérdida," the owner cannot tell whether it was theft, an error, or which person
entered it. The ledger is trustworthy about *what* changed and *when*, and silent about the
one thing the owner needs: *who*. The audit trail has a hole exactly where trust is required,
and it is now open in front of a paying customer.

"Add users" bundles three concerns that are usually conflated and have very different costs
and, crucially, different **owners**:

- **Authentication** — proving you are who you say. An engineering decision.
- **Attribution** — recording the acting user on each action. An engineering decision.
- **Authorization** — deciding what an actor is permitted to do. A **policy** decision that
  belongs to the business and the customer, not to engineering alone.

The value that closes this incident is a **trustworthy actor on every recorded action**. That
requires attribution *and* authentication together: an actor a caller merely asserts — a name
chosen from a list — is spoofable, and a spoofable actor leaves the trail as untrustworthy as
no trail at all. Authorization is a different control: it *prevents* an action rather than
*attributing* one. The incident is a failure of detection ("who did this?"), not of
prevention ("stop this person from doing it"), so authorization is not what closes it — though
it is the natural next control once the customer's delegation rules are known.

## Decision
Adopt one identity model spanning all three concerns, and **build it in two ordered slices**
behind this single decision. An ADR records a decision; it does not dictate one shipment — the
contract of [ADR-0007](0007-a-contract-between-frontend-and-backend.md) was decided whole and
built across three PRs, and identity follows the same shape.

### The model

- **Authentication.** A user is an account that must authenticate before it can write.
  Credentials are stored only as a salted hash from a strong key-derivation function — never
  plaintext, never reversible. A session establishes the acting user for each request and
  expires. The mechanism is kept minimal: password recovery flows, multi-factor
  authentication, and third-party or single-sign-on login are **deferred with triggers**
  (below); none is justified for one pilot shop.

- **Attribution.** Every write to the ledger — a movement and an adjustment alike — records
  the **authenticated** user as its actor, inside the append-only record itself. Being in the
  immutable ledger, the actor cannot be altered after the fact, exactly as the movement it
  belongs to cannot. This **extends the invariant**: "the Stock never lies" becomes "the Stock
  never lies, and every change names who made it." The actor is assigned server-side from the
  session; like `at` in ADR-0007, it is never accepted as a client-writable field, so a caller
  cannot record an action under someone else's name.

- **Authorization.** Access is **role-based and enforced server-side, at the same write
  boundary that defends the invariant** — never in the UI, which can only hide a control, not
  prevent a request. What this ADR fixes now is the *shape*: roles, checked at the boundary,
  with denials returned in the contract's typed error shape. The specific role model — which
  roles exist, which may record movements, which may reconcile a physical count — is a
  **policy decision owned by the business with the customer**, and is defined before Slice 2 is
  built. Engineering does not invent the permissions matrix.

### The build, in two slices

- **Slice 1 — Authentication + Attribution.** Closes the production incident. From here, every
  movement and every adjustment names a proven actor in the ledger. This is the complete
  solution to the detection failure that occurred — complete for the problem that broke, not
  for every problem identity will ever touch.

- **Slice 2 — Authorization.** Enforces the role model once it is defined with the customer.
  Sequenced after Slice 1 for two reasons: (1) it multiplies the test surface — every action
  times every role times allow/deny — and is far safer landed on a stable authentication base;
  and (2) its policy is not yet known. Building it now would encode a *guessed* permissions
  model and all but guarantee a rewrite when the customer's real delegation is learned. The
  guess is the expensive path, not the wait.

## Considered options
- **Attribution only, with a self-asserted actor (no authentication)** — rejected. An actor
  the caller chooses is spoofable; the trail it produces is as untrustworthy as none. It would
  *appear* to close the incident while leaving it open, which is worse than leaving it visibly
  open.
- **Build all three concerns in one shipment** — rejected, though it was the first instinct.
  It bundles three independent failure surfaces into one review and one release, and it forces
  the authorization policy to be invented before the customer has stated it. The likeliest
  outcome is the wrong permissions model and a second rewrite. The decision is made whole here;
  only the build is staged, so nothing is designed piecemeal.
- **Adopt a third-party identity provider / OAuth / SSO now** — deferred, not rejected. It
  earns its operational weight with many tenants, an enterprise sign-on requirement, or a
  security surface beyond a single pilot. None holds today. **Graduation trigger:** a second
  customer (multi-tenancy), or a customer that requires single sign-on.
- **Enforce authorization in the UI** — rejected as a guard. Hiding a button is convenience,
  not enforcement; the request can still be made directly against the endpoint. Authorization
  is enforced at the write boundary where the invariant is defended, consistent with ADR-0006.
- **Multi-tenancy — multiple shops in one deployment — now** — deferred. The pilot is a single
  shop; its users belong to it implicitly. **Graduation trigger:** the second customer. Named
  here so the deferral is deliberate, not an oversight.

## Consequences
- The safety net's **question changes**, not merely its coverage. Alongside "does it work?",
  identity introduces "does it *fail safe*?" — a rejected login, an expired session, a write
  attempted with no session, and (in Slice 2) an action attempted by a role that may not take
  it. Security-relevant paths join the suite and the CI gate. This is the largest shift in the
  testing posture since the safety net began.
- Attribution makes the ledger answer "who," closing the gap the stock-count-adjustment spec
  deferred as sensitive. The invariant's guarantee widens to include authorship.
- The human-review lock (ADR-0005), armed on the second engineer's account joining the
  repository, now has the identity it presupposed: a review can be attributed to a reviewer.
- The project holds **secrets** for the first time. A security review of the pending changes
  applies to the authentication-bearing PRs; for them, the threat model — not only the happy
  path — is part of "done."
- **Deferred with triggers**, restated for the record: password recovery, multi-factor
  authentication, third-party/SSO identity, and multi-tenancy. Each is introduced when its own
  cost is justified, per the project's standing pattern.
- Slice 2's role model is a **pending policy artifact**, to be produced with the customer
  before it is built. Until then, all authenticated users share the same capabilities;
  attribution, not authorization, is what constrains behavior in the interim — every action is
  recorded against the person who took it.
