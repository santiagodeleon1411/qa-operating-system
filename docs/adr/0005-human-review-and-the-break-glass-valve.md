# ADR-0005 — Human review as the other half of "done," with a break-glass valve

## Status
Accepted — 2026-07-06. Builds on [ADR-0004](0004-a-merge-gate-for-the-invariant.md), which
kept human review as a *complementary* layer. This ADR gives that layer its shape.

## Context
The merge gate (ADR-0004) answered only the **mechanical** half of "is this done?": CI is
green, the invariant's safety net passed, the build type-checks. A machine can certify
that — but only for the paths we already knew to ask about.

The **human** half is still open, and it is exactly what surfaces when engineer #2 joins:
Is the change understood? Does it respect the invariant *by design*, not just by passing
tests a new path never touches? Did the new behavior bring its own test, or did we open a
blind spot behind a green check? No machine sees these.

## Decision
Human review is **mandatory** — a change reaches `main` only with **one approval**. This is
the second half of our [Definition of Done](../DEFINITION_OF_DONE.md), which names the
three things a reviewer certifies (invariant-by-design, new-behavior-is-tested,
reviewer-understands-it) and is guided into every PR by a pull-request template.

- **Enforcement is armed when engineer #2's account joins the repo.** GitHub does not let
  you approve your own PR; requiring an approval on a one-person repo would force a bypass
  on *every* merge — turning the emergency valve below into the normal front door and
  rotting its meaning. Until a real second reviewer exists, the Definition of Done is the
  standing norm; the ruleset takes over the moment it can bite honestly.

- **Break-glass valve (visible bypass).** The repository admin may merge without the
  required approval only when **both** hold: (1) waiting causes real, present harm, **and**
  (2) the reviewer is genuinely unavailable. The break is recorded, its reason written in
  the PR, and the change gets **retroactive review** — because a panic fix is the change
  most likely to carry a second bug. Speed is bought; the review is delayed, not forgiven.

## Considered options
- **Review as a norm, not a gate** — rejected as the primary rule: norms without teeth
  erode under pressure, exactly when review matters most. We build the obligation early so
  it becomes culture before habits set. (It *is* the norm in the window before enforcement
  arms — by necessity, not by choice.)
- **No valve — pure discipline** — rejected: with only two people, your one reviewer will
  eventually be unavailable during a real emergency; a rule that ignores that reality
  breaks itself, and the pressure produces a rubber-stamp approval anyway.
- **Wide bypass / self-merge allowed** — rejected: on a two-person team this is
  indistinguishable from having no gate.
- **Trigger break-glass on "invariant broken" alone** — rejected as incomplete: a broken
  invariant justifies the *speed*, but if the reviewer is sitting next to you, skipping
  them is skipping review for no reason. The valve needs *both* conditions.

## Consequences
- "Done" now has both halves: the machine guards the paths we know; the human guards the
  blind spots — new code, design, and understanding.
- The break-glass keeps us from ever being trapped by an absent reviewer during a real
  emergency, while the recorded mark keeps the exit from swallowing the discipline.
- Watch-out: enforcement is documentation-only until engineer #2's account exists. The
  value in the meantime is the Definition of Done and the PR template shaping behavior;
  the mechanical bite is deferred deliberately, not forgotten.
- The valve depends on honesty — the glass *can* be broken out of laziness. The mark makes
  that visible; if we ever see it abused, revisit the bypass scope.
