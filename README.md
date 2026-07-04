# QA Operating System

A living simulation of how a Quality Assurance system is designed, implemented, and
evolved as a software company grows — from its first days to a mature engineering
organization.

> Built to demonstrate not just *what* I know about QA, but *how* I think, decide, and
> evolve as a QA Leader.

## What's inside

- **The simulated company — Estoca** (`estoca/`): a runnable product (real-time stock
  control for small single-branch retail shops) that serves as the vehicle for the QA
  work. Clickable web + an automated safety net over its core invariant.
- **Decision records** (`docs/adr/`): every significant decision, with the reasoning —
  not only the result.
- **QA artifacts** (`docs/qa/`): test strategies, manual test records, and — as the
  company matures — automated suites and process.
- **Showcase** (`showcase/`): one-click access to the tangible product.

## The invariant everything protects

Estoca exists to keep one promise: **the Stock never lies.** Stock is always *derived*
from an append-only ledger of movements — never a mutable counter that can drift. See
[ADR-0003](docs/adr/0003-genesis-quality-posture.md).

## Where the story is

- **Stage 0 — Genesis** ✅ — product foundation and the invariant, protected by design
  and a small automated safety net. Deliberately no CI, no end-to-end tests, no QA hire
  (too early for the maturity).
- **Stage 1 — The team grows** 🚧 — a second engineer joins as the product gains
  traction; the question becomes how to protect quality when more than one person
  touches the code.

## Run it

```bash
cd estoca
npm install
npm run dev     # the clickable web
npm test        # the automated safety net over the invariant
```
