# HANDOFF — QA Operating System

**Fecha:** 2026-07-15
**Estado:** Stage 2, arco del **laboratorio de testing delegado a IA**. Esta sesión cerró las
**capas 3 y 4** de la feature del umbral de stock bajo (#22) y corrió un **`/code-review` high
(8 angles)** sobre el diff completo. La feature está **funcionalmente completa y verificada**;
cortamos con una **decisión pendiente**: qué findings del review arreglar antes del PR a main.

---

## ▶ AL RETOMAR — leé esto primero

**PUNTO EXACTO DE CORTE:** feature #22 completa (capas 1–4), 20 E2E verdes (2 corridas limpias),
`tsc` limpio. Acabo de entregar el **reporte del code-review** y le ofrecí a Santiago 3 caminos
(a/b/c). **Eligió `handoff` en vez de responder → la decisión del review sigue ABIERTA.**

**DECISIÓN PENDIENTE (no re-litigar el review, ya está hecho — solo falta ELEGIR qué aplicar):**
- **(a) recomendado:** arreglar el **cluster P1 (findings 1–2)** + mis findings de tests baratos
  (7–8), correr tests, y seguir a **`/security-review`** → **PR a main**.
- **(b):** arreglar todo lo accionable (1–2, 5, 7–10) en un commit de "review cleanup".
- **(c):** solo documentar y ir al PR.

**NO re-corras el code-review** (ya está, findings abajo). **NO re-derives casos** (test plan #21).

## Estado de git (esta sesión)
- **Rama:** `feat/low-stock-threshold`. **8 commits sobre `main`** (nada mergeado a main aún).
  Nuevos de esta sesión, **sin pushear a origin**:
  - `9ca4f6b` — **capa 3: E2E black-box** (TC-01..04 nuevos + TC-06 dividido employee/runner).
  - `c27075b` — **fix UX:** aire al spinner del input de umbral (hallazgo de la sesión manual TC-26).
  - (previos ya descritos en handoffs anteriores: `909ae4b` FE, `ddbc285` i18n, `0d7b2e8` BE,
    `0069a15` mockup.)
- **Uncommitted:** solo `HANDOFF.md` (este archivo).
- **Test plan aprobado (28 casos):** comentario en issue #21 (los TC usan `belowThreshold`).
  https://github.com/santiagodeleon1411/qa-operating-system/issues/21

## Lo que se cerró esta sesión (NO rehacer)
- **Capa 3 — E2E (commit `9ca4f6b`):** archivo nuevo `estoca/e2e/low-stock-behavior.spec.ts` con
  TC-01 (borde `stock==threshold` → badge), TC-02 (`+1` → sin badge), TC-03/04 (reactividad por
  **movimiento** que cruza el umbral, sin reload). TC-06 extendido a Bruno **y Caro** en
  `low-stock-threshold.spec.ts` (loop). TC-05 mapeado a capa 2, **no duplicado** (decisión
  "mapear + extender"). Page Object: `setStockTo(product, target)` nuevo; `setThreshold` ahora
  espera la respuesta del PATCH.
- **Capa 4 — manual (ejecutada por Santiago):** **TC-25 Pass** (badge legible a 390/768/full) con
  **known limitation**: un token largo SIN espacios desborda la tabla horizontalmente — inalcanzable
  con el catálogo cerrado (sin crear productos), se vuelve real cuando exista "crear productos" (v2).
  **TC-26 Pass** (inmediatez verificada por automatización; discoverability confirmada por él) — y
  **destapó** el spinner del `input[type=number]` pegado al valor → arreglado en `c27075b`.

## Lecciones de QA-lead esta sesión
1. **Race de re-render async (la volví a pisar y sirvió de ejemplo):** `setThreshold` disparaba un
   `renderApp` in-place no esperado; al llenar el form de movimiento justo después, el re-render lo
   reemplazaba y el submit mandaba el **default (`entry`)** en vez del `exit` → café quedó en 12 en
   vez de 10. *Un dato imposible delata el harness, no el dominio; leer el snapshot ARIA lo resolvió.*
   Fix: gate determinístico (`waitForResponse` del PATCH) + reordenar (acción que re-fetchea primero,
   terminar en aserciones auto-retry). **Nunca un `sleep`.**
2. **El tier manual produce lo que la automatización no ve:** TC-26 encontró el spinner incómodo. El
   veredicto de discoverability es del humano; la inmediatez es objetiva (ya la prueban TC-22/03/04).
3. **Un test puede estar verde sobre código muerto** (ver findings del review) — el review destapó
   que la regla `low stock` testeada en `domain.ts` no tiene caller de producción.

## Resultado del `/code-review` high (8 angles, ya verificado — NO re-correr)
La **matemática del umbral es correcta** (sin off-by-one, `0` válido, borde `<=`, orden 401→403→
422→404). **Autorización owner-only sólida** (server-side, actor desde cookie, SQL parametrizado,
enum de motivos en lockstep intacto post-i18n). **No hay bug que rompa comportamiento hoy.** Findings:

**P1 — arreglar antes del merge (barato, alto valor):**
1. **Regla `low stock` duplicada** (`products-repo.ts:44` `toView` la calcula inline) mientras
   `domain.ts` `isBelowThreshold`/`effectiveThreshold` tienen **cero callers de producción**
   (confirmado por grep) pero cargan los unit tests → la ruta que shipea saltea el dominio testeado.
   Fix: que `toView` llame al dominio (una fuente), o borrar los helpers.
2. **`assertValidThreshold` (`domain.ts:73`) muerto** → el write valida solo por zod
   (`contract.setThresholdInput`) + CHECK de SQLite. Fix: que el handler lo llame, o borrarlo.
   (1 y 2 son el mismo problema: "dominio paralelo muerto que da falsa confianza".)

**P2 — reales, bajo impacto, documentar como known limitations:**
3. `main.ts:377` — guardar umbral deja **stale las otras filas** (re-render desde `current` en
   memoria, solo refresca la fila editada). Cara multi-sesión, ya diferida.
4. `main.ts:378` — `renderApp` por `innerHTML` **borra lo tipeado sin guardar** en otros formularios.
   Altitud del re-render grueso (raíz de la carrera del punto 1 de lecciones). Refactor, no este PR.
5. `client.ts:96` — un **404** (product no existe) se mapea a `ThresholdRefused` → se muestra como
   error de validación. Solo con id stale. Fix chico: rama 404.
6. `main.ts:369` — **no se puede volver un umbral a "sin setear"/default** desde la UI. Hoy
   inalcanzable igual (todos los productos vienen con umbral).

**P3 — rigor de los tests nuevos (míos, asumidos):**
7. `estoca-page.ts` `setThreshold` **se cuelga** con inputs que el cliente rechaza (vacío/decimal):
   `waitForResponse` espera un PATCH que nunca sale. El **docstring miente**. Corregir docstring +
   guardar el caso. (Latente: ningún test pasa decimales hoy.)
8. `low-stock-threshold.spec.ts:82` — el assert de no-owner **confía en el seed de azucar** sin
   forzarlo → flake latente por orden. Fix de 1 línea.
9. `estoca-page.ts:159` `setStockTo` sin guard de `NaN` (puede colgarse); y `window.__mark` es
   **casi tautológico** (una SPA no navega en un movimiento → la marca sobrevive por arquitectura).
10. `handlers.test.ts:232` — el test de contract-drift **diverge en dos ejes** ahora, dejó de aislar
    la regresión `stock→quantity` que dice cubrir.

**Descartados como NO-defectos** (no re-plantear): badge con tokens hardcodeados (diseño deliberado,
lo pinea el test de tokens), re-parse zod en el success path (guard de drift ADR-0007), 422 antes de
authz en JSON malformado (no filtra nada).

## Lo que sigue en la cinta (plan, no re-litigar)
- **(a) ahora:** decidir y aplicar findings del review → **`/security-review`** sobre el
  `PATCH /products` owner-only → **PR a main** (self-merge cuando pase `Estoca — safety net`).
- **Pendiente de esta feature, aún NO hecho:** registrar la **Manual test session** (TC-25/26 +
  known limitation del desborde + fix del spinner) como comentario en el issue #21. *(Acción hacia
  afuera — mostrarle el texto antes de postear.)*
- **(b) después:** **escena de la llegada de Matías** (ing #2) que revisa los PRs de proceso abiertos
  **#19 / #20 / #24** (NO mergear: su review ES el onboarding). Matías = personaje, no cuenta real.

## Deferidos que siguen (avisar proactivamente cuando corresponda)
- **Escaneo de dependencias en CI** (vuln del `npm install`): deferido, sigue caliente.
- **Durabilidad de la DB** (in-memory, resetea) + migraciones — el umbral tampoco sobrevive restart.
  En Known limitations de #21.
- Flag `Secure` de la cookie (prod/HTTPS); fix de timing en `authenticate` (hash dummy); cola de
  revisión de faltantes (v2 maker-checker); **v2 del charter** (ejecución-con-veredicto autónomo).
- **Crear productos (v2):** cuando exista, se vuelven reales (a) el desborde de nombre largo (TC-25),
  y (b) la rama del default de umbral (hoy inalcanzable). Anotado arriba.
- **Branch protection en main: PRENDIDA a propósito** (ruleset, 0 approvals; PR + check
  `Estoca — safety net` + non-fast-forward). NO tocar. Memoria `review-gate-posture`.

## Stack y comandos
- Vite + Vitest + `better-sqlite3` + `zod` + `tsx` + `@playwright/test`. App en `estoca/`.
- **Correr (desde `estoca/`):** `npm run dev:api` (:3001) + `npm run dev` (:5173, proxy /api).
  DB in-memory, ACUMULA estado mientras el server vive → los E2E fuerzan su estado.
- **Tests (desde `estoca/`):** `npm test` (vitest), `npm run test:e2e` / `npx playwright test`
  (self-hostea los servers), `npx tsc --noEmit`.
- **NOTA:** dejé `dev:api` (:3001) y `dev` (:5173) corriendo en background esta sesión. Podés
  reusarlos o reiniciarlos. Para screenshots/driver: escribí el `.mjs` DENTRO de `estoca/`, corré,
  y **borralo** (no dejar sueltos). El diff del review quedó en scratchpad (efímero); los findings
  ya están arriba.
- **Login dev:** `ana`/`estoca-ana` (owner), `bruno`/`estoca-bruno` (employee), `caro`/`estoca-caro` (runner).
- **Charter del agente:** `docs/qa/ai-testing-agent-charter.md` (rama `docs/ai-testing-agent`).
- `gh` con scope `project`. Repo: `santiagodeleon1411/qa-operating-system`.
  Board: https://github.com/users/santiagodeleon1411/projects/1 (campo Stage).

## Rol y estilo (CRÍTICO — no cambió)
- Claude = **mentor de QA / thought partner**, NO asistente. Desafía supuestos, explica trade-offs,
  lente de madurez/ROI. Esta sesión: se laburó CON él (eligió "mapear+extender", ejecutó los casos
  manuales, pidió correr la sonda). En el review le di findings + recomendación ROI, no un volcado.
- **Voz de artefactos = seria, técnica, EN INGLÉS, sin metáforas** (issues, DoD, tests, commits,
  código, producto). Conversación en criollo. (`artifact-voice`, `product-copy-english`.)
- **Se engancha con la evolución de ROLES/narrativa** → escenas con personajes con nombre. Cast:
  **Sofía** (PM), **Matías** (ing #2, próxima escena), **Ana** (dueña), **Bruno** (empleado),
  **Caro** (cadete). (`narrative-fuels-engagement`.)
- **Playwright lo aprende en el trabajo** → se enseñó E2E a fondo en capa 3. (`playwright-real-job`.)
- **Saltos de fase grandes**, norte = QA ecosystem entendible/escalable/**vendible**. (`phase-granularity`.)
- **Mockup por tarea con diseño** = check #4 del DoD (PR #24). (`mockup-per-task`.)
- **Guardar SIEMPRE al cerrar.** (`save-on-leave`.)

## Suggested skills (próxima sesión)
- **`security-review`** — sobre el `PATCH /products` owner-only, tras aplicar los findings del review.
- **`run`** / **`verify`** — si los servers de background murieron o para reconfirmar la feature.
- **`review`** (o self-merge) — al abrir el PR a main.
- **`handoff`** — al cerrar la próxima sesión.
