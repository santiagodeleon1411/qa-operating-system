# Proposal — Authorization role model

## Status
**Approved by the owner — 2026-07-10, refined during sign-off.** Drafted by engineering as the
input to identity slice 2 (authorization) decided in
[ADR-0008](../adr/0008-identity-authentication-attribution-authorization.md), then amended in a
sign-off round with the owner and approved. Ready for development.

Builds on identity slice 1 (authentication and attribution), which established that every
write is performed by an authenticated actor and stamped, immutably, into the ledger.

### Sign-off outcome
The initial proposal restricted **all** shortfall write-offs to the owner. The owner is off-site
much of the week, which surfaced a conflict with the project's core invariant: if only the owner
can record a shortfall, the Stock *lies* until the owner returns. Resolving it without weakening
the control produced the design below — a **maker-checker split**: recording a shortfall and
*classifying it as theft* became two separate acts, and only the second is restricted. An
employee can correct the Stock in the moment; only the owner can label a disappearance a loss.
The unit of authorization is therefore the **adjustment reason**, not the adjustment action.

## Why authorization, and why now
Slice 1 answered *who moved the Stock*. It did not answer *who is allowed to*. Today every
authenticated user can perform every action: a delivery runner can record a "theft or loss"
adjustment exactly as the owner can. That is acceptable for a single-operator shop and
unacceptable the moment a shop has staff — which the pilot customer now does.

Authorization closes that gap by binding each action to the roles permitted to perform it,
enforced on the server at the write edge.

## Principles
1. **Least privilege — deny by default.** Each role begins able to do nothing; the owner
   *grants* only what the business needs. Opening a permission later is cheap and visible;
   discovering a permission was left open is neither. This mirrors the security posture the
   project already holds: the question is "does it fail safe?", not "does it work?".
2. **Engineering proposes, the owner disposes.** The permission matrix below is a
   recommendation. The two decisions that are genuinely the business's to make are called out
   explicitly under *Decisions requiring sign-off*.
3. **The proposal makes the risk of each grant visible**, so the owner decides with the
   trade-off in front of them rather than by default.
4. **Enforcement is server-side, never trusted to the client.** Hiding a button improves the
   interface; it does not enforce a policy. The handler is the boundary — exactly as the
   acting user is resolved and stamped server-side, never taken from the caller's claim.

## The actors
The pilot's people, as they exist today:

- **Owner** — runs the shop and is accountable for its inventory. (Ana, in the pilot.)
- **Employee** — works the day-to-day: receives stock, records sales. (Bruno.)
- **Runner** — handles deliveries out of the shop. (Caro.)

## The actions
The operations the system exposes today, with the sensitivity that drives their default:

| # | Action | Sensitivity |
|---|--------|-------------|
| 1 | View Stock and history (read) | Low |
| 2 | Record movement — **entry** (restock / purchase) | Medium |
| 3 | Record movement — **exit** (sale / delivery) | Medium |
| 4 | Record adjustment — reason *Breakage* / *Data-entry error* / *Unexplained shortfall* | High |
| 5 | Record adjustment — reason *Theft or loss* | Highest |

Adjustments 4 and 5 are the same action distinguished only by their **reason**, which is why the
reason — not the bare action — is the unit of authorization. *Unexplained shortfall* is a new,
deliberately neutral reason introduced by the sign-off (see below): it records that a count does
not match without asserting a cause.

## Proposed permission matrix

| Action | Owner | Employee | Runner |
|--------|:-----:|:--------:|:------:|
| View Stock / history | ✅ | ✅ | ✅ |
| Movement — entry | ✅ | ✅ | ❌ |
| Movement — exit | ✅ | ✅ | ✅ |
| Adjustment — Breakage / Data-entry error / **Unexplained shortfall** | ✅ | ✅ | ❌ |
| **Adjustment — Theft or loss** | ✅ | ❌ | ❌ |

## Rationale for the sensitive grants

### Theft-or-loss adjustment is restricted to the owner (segregation of duties)
This is the load-bearing control in the model. A "theft or loss" adjustment is the one place
where a shortfall is written off — where missing inventory is reconciled away with a reason.
A person who can both move the Stock *and* record that Stock as "lost" can remove inventory
and erase the evidence in the same act.

Standard internal control separates these duties: **whoever handles the merchandise should not
be the one who justifies its disappearance.** Restricting theft-or-loss adjustments to the
owner keeps the write-off in the hands of the person accountable for the inventory, not the
people who move it daily.

### Recording a shortfall is separated from classifying it as theft (maker-checker)
The owner being off-site forced the question the initial proposal missed: how does the Stock
stay honest when the only person allowed to write off a shortfall is away for days? The answer
is to split the act. Recording *that* a count fell short and classifying that shortfall *as
theft* are different decisions with different risk:

- Any employee may record an adjustment with the neutral reason **Unexplained shortfall**. The
  Stock is corrected in the moment, so it never lies — the invariant holds.
- Only the owner may record an adjustment reasoned **Theft or loss** — the classification that
  writes the shortfall off as an accounted-for loss.

Why prevent this and not merely detect it, given that attribution already names who recorded
every movement: **a theft written off as a "loss" disguises itself as routine.** It leaves a
tidy, plausible, reconciled record that no one has reason to look at twice — attribution names
the recorder but does not raise a hand. Forcing an employee's shortfall into *Unexplained*
turns a self-justifying act into an open question that lands on the owner's desk unresolved. The
control is worth its cost here precisely because the risk it addresses hides itself.

**What this does not do (stated so it is not over-claimed).** This closes the hole of writing a
shortfall off as a loss. It does not stop a shortfall being disguised as a legitimate *exit* (a
sale that never happened) — an employee holds the exit permission, and attribution, not
authorization, is the record there. Catching that requires reconciliation (recorded sales
against takings), which is a detection concern and out of scope for this model.

### The runner may record exits, and attribution is what makes that safe
Granting the runner exits lets them decrease Stock (recording deliveries out). In isolation
that reads as risk. It is safe here for two reasons, and both are why slice 1 had to come
first:

- **Every exit is attributed** to the runner in the append-only ledger. The action is
  traceable to a named person; it cannot be performed anonymously.
- **The runner still cannot record a theft-or-loss adjustment.** They can move merchandise in
  plain sight, but they cannot *justify a disappearance*. The segregation-of-duties line above
  holds regardless of this grant.

The runner is denied entries (restocking) and the non-theft adjustments as least-privilege
defaults: nothing in the delivery role requires them today.

## Decisions settled at sign-off
These were the business-policy calls; the owner made them:

1. **Theft-or-loss classification restricted to the owner only** — confirmed. The off-site
   conflict it raised was resolved by the maker-checker split above (employees record
   *Unexplained shortfall*; only the owner classifies *Theft or loss*), not by widening the
   theft grant.
2. **The runner may record exits (not read-only)** — confirmed, made safe by attribution.

## Out of scope (deferred, with triggers)
- **A shortfall review queue** — the maker-checker split above lets an employee record an
  *Unexplained shortfall* and lets the owner classify their own counts as *Theft or loss*, but
  it does not let the owner later *reclassify* an employee's unexplained shortfall in the
  system. That reclassification workflow (pending state, review surface, an audit trail of the
  reclassification) is the fuller version of this control. Deferred until the shop asks to act
  on shortfalls after the fact; for the pilot the owner reviews them in the history by eye.
- **Assigning and changing roles in the product** — roles are seeded in code for the pilot. A
  self-service admin surface waits until the shop manages its own staff.
- **Role hierarchies and custom roles** — three fixed roles are enough for the pilot. Revisit
  when a fourth role or a franchise with varying policies appears.
- **Per-product or per-location permissions** — the shop is single-location. Revisit on
  multi-location, tracked alongside multi-tenancy in ADR-0008.

## After sign-off — how it will be enforced and tested
Recorded here so the plan is legible before code exists:

- **Enforcement at the write edge.** Each handler checks the actor's role against the approved
  matrix before touching the ledger. A permitted action proceeds; a forbidden one is refused
  with **403 (authenticated but not permitted)** — a new outcome distinct from slice 1's
  **401 (not authenticated)**. The distinction matters: 401 says *log in*, 403 says *you may
  not*.
- **The test matrix multiplies by role.** Every action is now tested as *action × role ×
  (allowed | denied)* — each permitted cell proves the action succeeds, each denied cell proves
  it is refused with 403 and that **nothing reached the ledger**. The denials are the point:
  they are the tests that prove the policy has teeth, the same way the XSS regression proved
  its fix did.
- **The UI reflects the policy for usability, the server enforces it for safety.** Buttons a
  role cannot use are hidden, but the guarantee lives in the handler; an end-to-end test drives
  a forbidden action past the interface to confirm the server refuses it.
