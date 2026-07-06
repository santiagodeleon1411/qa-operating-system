# ADR-0007 — A contract between the frontend and the backend

## Status
Accepted — 2026-07-06. Builds the seam that [ADR-0006](0006-backend-and-database-with-the-invariant-in-the-schema.md)
introduced and its Consequences explicitly deferred ("a contract between frontend and
backend so they do not drift … introduced when its own cost is justified"). That cost is
now justified: the backend and the frontend are worked on by different people, and the
data layer built in ADR-0006 is not yet reachable from the screen.

## Context
After ADR-0006 the source of truth is a database behind a service, but nothing connects it
to the screen. The user interface still writes to the browser's `localStorage`
(`estoca/src/persistence.ts`); the tested data layer (`estoca/src/db/`) is exercised only
by the safety net. Two things are missing: the wire between the two sides, and a guarantee
that the two sides agree on what travels over it.

The second is the real risk. Once the frontend and the backend evolve independently — here,
in the hands of different roles — each side holds its own assumption about the shape of a
request and a response. When one side changes that shape and the other does not, they
**drift**, and the failure surfaces late, in the running product, where it is most
expensive. A single-process browser never had this failure mode; splitting the data across
a boundary created it, exactly as splitting it across a persistence layer created the
concurrency failure mode in ADR-0006.

The expensive way to catch drift is to stand up both sides together and test end to end.
That is slow, flaky, and catches the problem last. A contract catches it without running
the two sides at once.

## Decision
Define an explicit contract between the two sides, held as **one schema that both import**,
and enforce it **at the boundary**.

- **The contract is a single source of truth for the shape.** One schema module
  (`estoca/src/contract/`) describes the request and response of each endpoint. From that
  one definition come both the static TypeScript types the two sides code against and the
  runtime validator that checks real payloads. There is no second, hand-written type that
  can fall out of step with the validation.
- **The contract is validated at the boundary, on both sides.** The backend validates every
  incoming request and its own outgoing response against the schema; the frontend validates
  every response it receives. A payload that does not match the contract is rejected at the
  edge, not silently mis-read deeper in the code.
- **The seam is kept minimal.** A small backend service over `MovementsRepo` exposes two
  endpoints — `GET /products` (the catalogue with its derived Stock) and `POST /movements`
  (record a movement). It is built on Node's standard library; no web framework is added,
  because two endpoints do not justify one. The frontend calls these endpoints in place of
  `localStorage`.
- **Errors are part of the contract.** When a movement is refused — by the domain rules or
  by the `movements_no_negative_stock` trigger from ADR-0006 — the backend returns a typed
  error shape the frontend can render. Drift on the error path is drift too, so the error
  shape is in the schema and validated like any other response.
- **The invariant does not move.** "The Stock never lies" stays enforced in the database
  schema (ADR-0006). The contract is a new guard at a new boundary, layered on top of the
  existing ones — it does not re-implement the invariant, and no derived Stock is ever sent
  as a writable field.

### Contract (faithful to `estoca/src/domain.ts`)

```
GET /products
  → 200  Product[]  where Product = {
      id: string, name: string, threshold: number,
      stock: number,        // derived server-side; read-only, never sent back to write
      stockout: boolean      // stock <= threshold
    }

POST /movements
  body   { productId: string, kind: 'entry' | 'exit',
           quantity: integer > 0, reason: non-empty string }
         // no `at`: the server is authoritative on time
  → 201  Movement = { productId, kind, quantity, reason, at: ISO string }
  → 422  { error: string }   // domain rule or never-negative trigger refused it
```

### Guardianship across the boundary
The invariant remains defended in the layers named in ADR-0006 (schema, safety net, human
review). The contract adds one guard of its own, with a clear owner:

- **Contract, validated at the edge** — the schema both sides share; drift is caught the
  moment a payload fails validation, and the contract tests fail before any code that
  drifted can ship. Owned jointly by whoever changes an endpoint; enforced by the machine
  through the CI gate.

## Considered options
- **Consumer-driven contract testing (Pact-style)** — deferred, not rejected. It earns its
  operational weight (a broker, extra CI wiring) when the two sides **cannot** share one
  codebase: separate repositories, independent deploys, or a third consumer of the same
  API. None of those is true today — one repository, one deploy. Adopting it now would be
  paying for a problem not yet present. **Graduation trigger:** revisit when the frontend
  and backend split into separate repositories or deploy independently, or when a second
  consumer of the API appears.
- **Shared TypeScript types only, no runtime validation** — rejected. Types vanish at
  compile time; they cannot catch a real payload that arrives in the wrong shape at
  runtime, which is precisely the drift this decision exists to catch.
- **No contract; rely on full-stack end-to-end tests** — rejected as the primary guard. It
  catches drift last and slowest, and is flaky. End-to-end coverage remains deferred as in
  earlier ADRs; the contract is the cheaper, earlier guard for this specific risk.
- **A heavier web framework for the service** — rejected as premature. Two endpoints over
  `MovementsRepo` do not justify the dependency; revisit if the surface grows.

## Consequences
- The safety net **extends** again: contract tests join the suite and the CI gate, checking
  that both sides honor the shared schema. The pattern from ADR-0006 holds — coverage
  follows the risk to the new boundary.
- The honest scope gap from ADR-0006 closes: the tested data layer becomes reachable from
  the screen. The frontend's dependence on `localStorage` as a source of truth ends;
  `localStorage` may remain only as a non-authoritative cache, if at all.
- The shared schema is a new artifact both roles own together. A change to an endpoint is a
  change to the contract, and the contract tests make that change visible on both sides.
- **Schema migrations remain deferred** (ADR-0006). A contract for the API is not a
  migration strategy for the database; each is introduced when its own cost is justified.
- Mechanical enforcement of the human-review gate remains armed on the condition set in
  ADR-0005 (a second engineer's account joining the repository).
