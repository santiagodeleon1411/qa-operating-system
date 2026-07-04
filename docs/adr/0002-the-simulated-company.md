# ADR-0002 — The simulated company and our vantage point

## Status
Accepted — 2026-07-04

## Context
QA Operating System needs a *concrete* company to simulate; an abstract "B2B SaaS"
produces only generic QA platitudes. We must fix three things up front, because
every downstream QA decision bends to them: **what** the company builds, **where**
in its life we join, and **whose** point of view narrates the decisions.

## Decision
The company — working name **Estoca** — is a **B2B SaaS for real-time stock control
aimed at single-branch retail SMBs**.

The MVP wedge is deliberately narrow: a Merchant loads its Products, records Stock
movements (entries and exits), and sees current Stock at all times, with Stockout
alerts. Multi-branch, POS integration, suppliers, and purchase orders are
**explicitly out of scope** for the MVP and become later stages.

We join the story at **Genesis**: a pre-seed, bootstrapped company of three — a
commercial/product co-founder, a technical co-founder acting as CTO, and the
narrator as **engineer #1**. There is no QA role and no process; the single
objective is landing the first paying Merchant.

The narrator's vantage point is **engineer #1 who carries the quality point of
view** — not a QA title, and not the technical co-founder. QA is built from zero,
and its authority is *earned*, not granted.

## Considered options
- **Domain — A) retail SMB inventory (chosen) / B) team collaboration tool /
  C) analytics-BI.** B is saturated and undifferentiated to any evaluator; C
  narrates as abstract and technical quickly. A is authentic to the author's real
  domain knowledge, immediately legible to any reader, and offers the longest, most
  varied QA runway (integrations, multi-tenant, data correctness, workflows).
- **Vantage — (a) engineer #1 with quality POV (chosen) / (b) technical
  co-founder / CTO.** (b) grants authority early but forfeits the most compelling
  arc — the birth of a QA function where none existed — and is less credible, since
  a CTO optimizes for shipping, not quality.

## Consequences
- **Authenticity.** Decisions can be grounded in lived domain knowledge, which
  reads as judgment rather than research.
- **A long runway.** Each product expansion (multi-branch, POS, suppliers,
  reporting) opens a distinct, self-contained QA stage.
- **The strongest arc on display.** "Build QA from zero" showcases the hardest,
  most valuable leadership skill: justifying and creating a quality function under
  startup constraints.
- **Watch-out (recorded, not solved).** Deep domain familiarity tempts us to make
  the simulation too easy. We commit to injecting adverse scenarios where the domain
  puts us in genuine difficulty, preserving the falsifiability required by
  [ADR-0001](0001-how-we-record-decisions.md).
