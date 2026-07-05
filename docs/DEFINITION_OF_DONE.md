# Definition of Done — Estoca

"Done" is not "it works on my machine." A change is **done** when both halves below hold.
This document is alive: it is signed for today, not forever. When the product changes and
a rule gets in the way, we change the rule.

Everything here exists to protect one thing: **the Stock never lies.**

---

## Half 1 — Mechanical (the machine certifies this)

Already enforced by the merge gate ([ADR-0004](adr/0004-a-merge-gate-for-the-invariant.md)).
No human needs to remember it:

- The **safety net passes in CI** (`npm test`) — the invariant is intact on the paths we
  already know to ask about.
- The build **type-checks** (`npm run build`).

A green check answers this half. We do not re-verify it by hand.

## Half 2 — Human (a reviewer certifies this)

The machine only checks what we already knew to ask. A human guards the **blind spots** —
what is new, what is design, what is understanding. In every PR the reviewer certifies:

1. **The invariant is respected in design, not just in the test.**
   Stock is still *derived* from movements — no new counter, no second parallel
   calculation. A new code path can pass the existing tests simply because they do not
   touch it; only a human who understands the invariant sees a second source of truth.

2. **New behavior brings its own test.**
   CI stays green when you add an untested feature — the old tests still pass because no
   one broke them. The reviewer confirms the safety net **grew** with the change, so we
   did not open a blind spot exactly where we added something new.

3. **The reviewer understands what the change does and why.**
   If the reviewer cannot explain the change in their own words, it is **not done** — it
   is clarified or simplified before merging. Code that no one can explain in six months
   is a maintenance time bomb, however green the check is.

---

## The review is mandatory

A change reaches `main` only with **one human approval** — this is the human half of
"done," and it is not optional.

- **Enforcement:** the GitHub ruleset requires 1 approval on `main`. It is **armed the day
  a second engineer's account joins the repo.** Enforcing a two-person rule on a
  one-person repo would force a bypass on *every* merge, which rots the emergency valve
  below into the normal front door. Until then this document is the standing norm; the
  machine takes over the moment a real second reviewer exists.

## The break-glass valve

Like the little hammer behind the glass of a fire extinguisher: it exists for the real
emergency, and **breaking it leaves a mark**. That visibility — not difficulty — is what
keeps it from being abused.

The repository admin may merge **without the required approval** only when **both**
conditions hold:

1. **Waiting causes real, present harm** — e.g. the Stock is lying in production *right
   now* and a Merchant is acting on false numbers. Not "I'm in a hurry."
2. **The reviewer is genuinely unavailable** — asleep, on leave, unreachable. Not "they
   didn't answer in five minutes" (especially if you never pinged them). If the reviewer
   is at hand, you do **not** break glass — you ask for a fast review.

Both must hold. If either is missing, it is not break-glass: you either wait, or you get
the quick review.

When you break the glass, you owe two things:

- **Write why in the PR** — the mark must be legible, not silent.
- **Retroactive review** — the reviewer looks at it the moment they are back. A panic fix,
  shipped fast with a Merchant bleeding, is the *most* likely change to carry a second
  bug. The emergency buys speed; it does not forgive the review — it only delays it.
