# ADR-0005 — Human review as the second half of "done," with a break-glass exception

## Status
Accepted — 2026-07-06. Builds on [ADR-0004](0004-a-merge-gate-for-the-invariant.md), which
retained human review as a complementary layer. This ADR defines that layer.

## Context
The merge gate (ADR-0004) addressed only the **automated** half of "is this done?": CI is
green, the invariant safety net passed, the build type-checks. Automation can certify
that, but only for the cases already encoded in tests.

The **human** half remains, and the arrival of a second engineer exposes it: Is the change
understood? Does it respect the invariant *by design*, rather than only by passing tests
that a new path does not exercise? Was the new behavior covered by a test, or was a gap
introduced behind a green check? Automated checks do not address these.

## Decision
Human review is **mandatory** — a change reaches `main` only with **one approval**. This is
the second half of the [Definition of Done](../DEFINITION_OF_DONE.md), which specifies the
three items a reviewer certifies (invariant-by-design, new-behavior-is-tested,
reviewer-understands-the-change) and is applied to every PR through a pull-request
template.

- **Enforcement is activated when the second engineer's account joins the repository.**
  GitHub does not permit self-approval; requiring an approval on a single-contributor
  repository would force a bypass on every merge and remove the meaning of the exception
  below. Until a second reviewer exists, the Definition of Done is the operative standard;
  the ruleset is applied once it can be enforced as intended.

- **Break-glass exception.** The repository admin may merge without the required approval
  only when **both** conditions hold: (1) waiting causes real, present harm, **and** (2)
  the reviewer is genuinely unavailable. The bypass is recorded, its reason stated in the
  PR, and the change receives **retroactive review**, because an emergency fix is the
  change most likely to introduce a second defect. Merging precedes review; the review is
  deferred, not omitted.

## Considered options
- **Review as a norm rather than a gate** — rejected as the primary rule: an unenforced
  norm erodes under pressure, which is when review matters most. The obligation is
  established early so it becomes standard practice before habits form. It operates as a
  norm only in the interval before enforcement is activated, by necessity.
- **No exception — strict enforcement** — rejected: with two people, the single reviewer
  will eventually be unavailable during a genuine emergency; a rule that ignores this
  fails in practice and produces a nominal approval under pressure.
- **Broad bypass or self-merge** — rejected: on a two-person team this is equivalent to
  having no gate.
- **Trigger the exception on a broken invariant alone** — rejected as incomplete: a broken
  invariant justifies the urgency, but if the reviewer is available, skipping the review is
  unjustified. Both conditions are required.

## Consequences
- "Done" now has both halves: automation covers the encoded cases; the reviewer covers new
  code, design, and comprehension.
- The break-glass exception prevents an absent reviewer from blocking a genuine emergency,
  while the recorded justification prevents the exception from displacing the review
  requirement.
- Enforcement is documentation-only until the second engineer's account exists. The value
  in the interim is the Definition of Done and the PR template guiding behavior; mechanical
  enforcement is deferred deliberately.
- The exception depends on honest use. The recorded justification makes any misuse visible;
  if misuse occurs, the bypass scope is revisited.
