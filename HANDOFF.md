# HANDOFF — QA Operating System

**Fecha:** 2026-07-14
**Estado:** Stage 2, arco del **laboratorio de testing delegado a IA**. Esta sesión construyó la
**capa 1 (backend) de la primera feature** por la cinta nueva: umbral de stock bajo por producto
(#21/#22). Antes resolvió el **encapsulado git** de los sueltos que venían arrastrándose y corrigió
una memoria desactualizada. La capa 1 está **commiteada, pusheada y verificada corriendo**. Cortamos
antes de la **capa 2 (frontend + diseño)**.

---

## ▶ AL RETOMAR — leé esto primero

**PUNTO EXACTO DE CORTE:** capa 1 backend de #22 **terminada** (commit `dcab82d` en
`feat/low-stock-threshold`). 104 tests verdes, `tsc` limpio, verificado sobre el transporte HTTP real.

**Próximo paso: capa 2 — frontend + diseño** (TC-18..24 del test plan de #21). Arrancar leyendo
`estoca/src/main.ts` y `estoca/src/styles.css` completos antes de tocar nada. Qué construir:
- **Badge por producto que refleja `belowThreshold`** — la UI **NO recomputa** desde stock/threshold;
  una sola fuente de esa decisión, el server. (TC-18/19). El badge del mockup dice **"Stock bajo"**
  (hoy `main.ts` todavía renderiza el texto viejo "Stockout"/"OK" — el rename de campo ya se hizo,
  falta el rediseño visual del badge). El cliente ya tiene `setThreshold()` en `estoca/src/api/client.ts`.
- **Control de umbral visible solo al owner** (TC-20/21). El rol viaja en `sessionUser.role`; la UI
  refleja la política (esconder el control), pero la garantía es el 403 del server, ya hecho.
- **Actualización sin reload** cuando el owner cambia el umbral (TC-22): `PATCH /products` devuelve la
  vista actualizada; usar esa respuesta para re-renderizar la fila sin recargar.
- **Diseño numérico tolerancia-cero** (TC-23/24): 7 tokens del badge asertados contra computed style,
  igualdad exacta, contra el mockup (design source of record). Ruta B del DoD.

**NO re-derives casos** (aprobados en #21). **NO re-litigues** las decisiones de abajo.

## Artefactos / estado de ESTA sesión (existen, referenciar, NO duplicar)
- **Rama de la feature:** `feat/low-stock-threshold` (pusheada), 2 commits sobre `main`:
  - `d54daed` — mockup (design source): `docs/mockups/21-low-stock-threshold/{badge.html,badge.png}`.
  - `dcab82d` — **capa 1 backend de #22** (ver el mensaje del commit para el detalle BE1..BE4).
- **Test plan aprobado (28 casos):** comentario en #21 →
  https://github.com/santiagodeleon1411/qa-operating-system/issues/21 (los TC usan `belowThreshold`).
- **#22 (BE):** los ACs backend ya están implementados y testeados (TC-07..16 + 404 en
  `estoca/src/server/threshold-handlers.test.ts`).
- **PRs de proceso abiertos (batch de Matías, esperan su escena):** #19 (DoD authz), #20 (DoR altura),
  **#24 (DoD check #4 = mockup por tarea, nuevo esta sesión)**. NO mergear: su review ES el onboarding.
- **HANDOFF** viajó a main vía **PR #25 (mergeado)**; este archivo lo reemplaza en la working tree.

## Encapsulado git resuelto ESTA sesión (no rehacer)
- Los tres sueltos que venían arrastrándose se separaron limpio: **mockup → rama de la feature**;
  **DoD check #4 → PR #24**; **HANDOFF → PR #25 (mergeado a main, CI verde, self-merge)**.
- Se arregló una topología mal armada (había commiteado HANDOFF a local-main antes de cortar las
  ramas); quedó cada rama = `origin/main` + un solo cambio aislado. Nada roto, nada pusheado de más.

## Decisiones tomadas ESTA sesión (no re-litigar)
- **`stockout` → `belowThreshold`** renombrado en TODO el stack (dominio `isStockout`→`isBelowThreshold`,
  contrato, repo, cliente, front). Motivo: "stockout" (sin stock) era misnomer de un aviso de *stock
  bajo / por debajo del umbral*.
- **Umbral nullable + resolve-on-read:** `threshold` puede ser `null` = "sin setear" (estado real,
  distinto de un 5 explícito); resuelve a `DEFAULT_THRESHOLD=5` en lectura (regla de Ana: fallar hacia
  el aviso). BE4.
- **Atribución = tabla append-only `threshold_changes`** (quién-qué-cuándo), misma disciplina del
  ledger de movimientos. BE2.
- **Endpoint = `PATCH /products` con body `{ productId, threshold }`** (ruteo flat, sin path-params,
  consistente con `POST /movements`). Nuevo **`ProductsRepo`** para config de producto, separado del
  `MovementsRepo` (ledger).
- **Orden de guardas:** 401 → 403 (owner-only, antes de parsear el body) → 422 (validación) → 404.
- **Validación devuelve 422**, NO el 409 que sugería la nota de #22. Decisión consciente: 422 es
  consistente con `postMovement` y correcto (contenido no procesable, no un conflicto); el test plan
  no fija el código. Flag para la escena de Matías / review.
- **Rango 0–10000** espejado dominio ↔ contrato (zod) ↔ schema (CHECK). Cap defensivo, no modelo de
  negocio.

## Corrección de memoria ESTA sesión (importante)
- **`review-gate-posture` estaba MAL:** decía "branch protection en main OFF". Es **FALSO** — el push
  directo a main fue rechazado. main **tiene ruleset vivo**: PR obligatorio + status check
  **`Estoca — safety net`** + non-fast-forward, con **0 approvals requeridos** (así no hay teatro de
  self-approval). Memoria corregida (dato + índice en MEMORY.md). Consecuencia: TODO va por rama+PR,
  incluso HANDOFF; self-merge cuando el check pasa.

## Lección de QA-lead de ESTA sesión
La premisa del #21 ("umbral hard-codeado ≤5 compartido") **ya era falsa en el código**: el umbral por
producto existía desde #13. El trabajo real no era "agregar el campo" sino **rename + estado 'sin
umbral' + endpoint de set**. Construir a ciegas desde el handoff habría duplicado lo existente y roto
el flag. *Verificar el código antes de construir desde spec/handoff.*

## Stack y comandos
- Vite + Vitest + `better-sqlite3` + `zod` + `tsx` + `@playwright/test`. App en `estoca/`.
- **Correr:** `npm run dev:api` (:3001) + `npm run dev` (:5173, proxy /api). DB in-memory (resetea).
- **Tests:** `npm test` (vitest), `npm run test:e2e` (playwright), `npx tsc --noEmit`. Todo desde `estoca/`.
- **Screenshot mockup:** `npx playwright screenshot --full-page <file.html> <file.png>`.
- **Login dev:** `ana`/`estoca-ana` (owner), `bruno`/`estoca-bruno` (employee), `caro`/`estoca-caro` (runner).
- **Charter del agente:** `docs/qa/ai-testing-agent-charter.md` en rama `docs/ai-testing-agent` (borrador,
  sin PR). Gobierna el paso de derivación de casos (v1 = solo planning).
- `gh` con scope `project`. Repo: `santiagodeleon1411/qa-operating-system`.
  Board: https://github.com/users/santiagodeleon1411/projects/1 (campo Stage).

## Lo que sigue en la cinta (plan elegido, no re-litigar)
- **(a) ahora:** terminar la feature del umbral — **capa 2 (frontend+diseño)** → **capa 3 (E2E
  Playwright, TC-01..06 — enseñar a fondo)** → **capa 4 (manual TC-25/26)**.
- **(b) después:** **escena de la llegada de Matías** (ing #2) que revisa el backlog de PRs de proceso
  (#19, #20, #24). Jugada transparente (empresa = sim). Matías = personaje, NO cuenta real.

## Deferidos que siguen (avisar proactivamente cuando corresponda)
- **Escaneo de dependencias en CI** (vuln CRÍTICA del `npm install`): deferido, sigue caliente (supply-chain).
- **Durabilidad de la DB** (in-memory, resetea) + migraciones — el umbral tampoco sobrevive restart.
  En Known limitations de #21.
- Flag `Secure` de la cookie (prod/HTTPS); fix de timing en `authenticate` (hash dummy); cola de
  revisión de faltantes (v2 maker-checker).
- **Multi-sesión:** NO se implementa, se documenta (desfase acotado aceptado). En Known limitations de #21.
- **v2 del charter:** ejecución-con-veredicto autónomo (hoy v1 = solo planning) + ambiente corriendo.
- **Branch protection en main: PRENDIDA a propósito** (ruleset con 0 approvals). NO tocar. (Memoria
  `review-gate-posture`, corregida esta sesión.)

## Rol y estilo (CRÍTICO — no cambió)
- Claude = **mentor de QA / thought partner**, NO asistente. Desafía supuestos, explica trade-offs,
  lente de madurez/ROI. (CLAUDE.md.) Esta sesión peleó bien el scope (el hallazgo del spec drift) y las
  tres decisiones de diseño salieron de esa discusión.
- **El usuario NO quiere rubber-stamp:** se compromete con postura + porqué.
- **Voz de artefactos = seria, técnica, EN INGLÉS, sin metáforas** (issues, DoD, test plan, commits,
  código). Conversación en criollo. (`artifact-voice`.)
- **Se engancha con la evolución de ROLES/narrativa** → escenas con personajes con nombre. Cast:
  **Sofía** (PM), **Matías** (ing #2, próxima escena), **Ana** (dueña), **Bruno** (empleado),
  **Caro** (cadete). (`narrative-fuels-engagement`.)
- **Playwright lo aprende en el trabajo** → enseñar E2E a fondo en la capa 3 (TC-01..06).
  (`playwright-real-job`.)
- **Saltos de fase grandes**, norte = QA ecosystem entendible/escalable/**vendible**; la honestidad
  vende. (`phase-granularity`.)
- **Mockup por tarea con diseño** = check #4 del DoD (PR #24). (`mockup-per-task`.)
- **Guardar SIEMPRE al cerrar.** (`save-on-leave`.)

## Suggested skills (próxima sesión)
- **`run`** — levantar la app para ver el badge/control a medida que se construye la capa 2.
- **`verify`** — ejercitar la feature de punta a punta una vez que el front esté.
- **`code-review`** — sobre el diff de la feature (backend ya + frontend) antes de cerrarla.
- **`security-review`** — el endpoint owner-only (`PATCH /products`) toca autorización; vale un pase.
- **`handoff`** — al cerrar la próxima sesión.
