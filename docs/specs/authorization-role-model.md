# Proposal — Authorization role model

## Status
**Proposal — pending owner sign-off.** Drafted 2026-07-10 by engineering as the input to
identity slice 2 (authorization) decided in
[ADR-0008](../adr/0008-identity-authentication-attribution-authorization.md). Authorization is
a **business policy, not an engineering decision**: this document proposes a default and makes
the risk of each grant explicit, but the permission matrix is not final until the shop owner
approves or amends it. No authorization code is written before that sign-off.

Builds on identity slice 1 (authentication and attribution), which established that every
write is performed by an authenticated actor and stamped, immutably, into the ledger.

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
| 4 | Record adjustment — reason *Breakage* / *Data-entry error* | High |
| 5 | Record adjustment — reason *Theft or loss* | Highest |

## Proposed permission matrix

| Action | Owner | Employee | Runner |
|--------|:-----:|:--------:|:------:|
| View Stock / history | ✅ | ✅ | ✅ |
| Movement — entry | ✅ | ✅ | ❌ |
| Movement — exit | ✅ | ✅ | ✅ |
| Adjustment — Breakage / Data-entry error | ✅ | ✅ | ❌ |
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

## Decisions requiring the owner's sign-off
Engineering recommends the matrix above. The two cells below are business policy, not
engineering; the owner confirms or amends them:

1. **Theft-or-loss adjustment restricted to the owner only.** Recommended. The counter-case to
   weigh: if the owner is frequently off-site, a shortfall may need to be recorded in the
   moment by an employee. If so, the grant widens to the employee — but never to the runner.
2. **The runner may record exits (not read-only).** Recommended per the pilot's request, made
   safe by attribution as described above.

## Out of scope (deferred, with triggers)
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
