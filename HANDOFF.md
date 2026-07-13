# HANDOFF — QA Operating System

**Fecha:** 2026-07-13
**Estado:** Stage 2, arco del **laboratorio de testing delegado a IA**. Esta sesión corrió la
**primera feature por la cinta nueva casi entera**: resolvió el unknown que la frenaba (escena con
Ana), aprobó el diseño (mockup), y **el agente (Claude) derivó los 28 casos de prueba**, que el
usuario revisó, ajustó (metió un tope y una decisión de multi-sesión) y **aprobó**. Todo subido y
trazable a los issues. **Cortamos justo antes de construir la feature.** El planning del charter (v1)
está **completo**; lo que sigue es implementación real.

---

## ▶ AL RETOMAR — leé esto primero

**PUNTO EXACTO DE CORTE:** la task **#21 está Ready con su test plan aprobado y subido**. El paso de
*planning* del charter terminó (agente redactó → humano revisó/ajustó/OK). El usuario eligió cortar
acá y pidió handoff.

**Próximo paso:** **construir la feature del umbral por producto**, por capas, ejercitando los 28
casos del test plan de a uno:
1. **Backend primero** — campo `threshold` por producto, endpoint para setearlo (auth: owner-only,
   403 a no-owner), validación `entero 0–10000`, `belowThreshold = (stock <= threshold ?? 5)` en
   `GET /products`. Reemplaza el badge hard-codeado de umbral 5. → tests **contract/unit** (TC-07..17,
   11b/c, 16).
2. **Frontend + diseño** — badge por producto que refleja `belowThreshold` (la UI NO recomputa),
   control de umbral visible **solo al owner**, actualización sin reload. → tests **component**
   (TC-18..22) y **design numérico** tolerancia cero (TC-23/24) contra el mockup.
3. **E2E** (TC-01..06) con Playwright — el usuario lo está aprendiendo en el trabajo, **enseñar a
   fondo** (memoria `playwright-real-job`).
4. **Manual** (TC-25/26) — juicio del humano, no se automatiza.

**NO re-derives los casos** (están aprobados y en #21). **NO re-litigues** el tope, el default ni el
multi-sesión (decididos abajo).

## Artefactos de ESTA sesión (existen, NO duplicar — referenciar)
- **Test plan completo (28 casos):** comentario en **#21** →
  https://github.com/santiagodeleon1411/qa-operating-system/issues/21#issuecomment-4953011848
  Trazable a cada AC, a la altura correcta, expected explícito. Es el output del agente per charter.
- **#21 (padre)** actualizado: unknown cerrado en la spec, edge case del tope, sección **Known
  limitations** (multi-sesión, tope, durabilidad).
- **#22 (BE)** actualizado: **BE3 = entero 0–10000** + comentario con rationale del tope + TC-11b/c.
- **#23 (FE+diseño)**: sin cambios esta sesión; los 7 design tokens siguen congelados.
- **Mockup:** `docs/mockups/21-low-stock-threshold/badge.html` + `badge.png`. Es el **design source
  of record** (Ruta B) y el screenshot para la futura presentación a recruiters. **Sin commitear.**
- **DoD:** `docs/DEFINITION_OF_DONE.md` — nuevo **check #4** (tarea con diseño → mockup+PNG bajo
  `docs/mockups/`). **Sin commitear.**

## Decisiones tomadas ESTA sesión (no re-litigar)
- **Default de umbral (unknown cerrado):** producto sin umbral → **cae al 5 global**. Razón de Ana
  (dueña): *el default debe fallar hacia el aviso, nunca hacia el silencio* — un faltante silencioso
  es lo peor; un falso aviso es solo ruido. Confirmado por comentario en #21/#22.
- **Tope del umbral = 10.000** (rango `0–10000`, cerrado en BE3). Es un **guard defensivo** contra
  tipeos/abuso, NO un modelo del negocio (un almacén reordena en decenas/bajos cientos). Flag: revisar
  si Estoca crece a SKUs de alto volumen.
- **Multi-sesión: NO se implementa nada, se documenta.** Se separó (A) sync en vivo cross-session vs
  (B) single-session-por-dispositivo. **Ambas declinadas** por ROI/madurez: B rompe el uso multi-
  dispositivo legítimo de Ana y no hay driver de seguridad; A es infra cara para beneficio marginal.
  Se acepta **desfase acotado documentado** (pantalla refleja al cargar / próxima acción). Si aparece
  driver: polling liviano primero, websockets después. Queda en Known limitations de #21.
- **Badge = lectura pública** (lo ven todos los roles); el **control** de umbral es owner-only.
- **Mockup por tarea = práctica durable** → ahora check #4 del DoD. Motivo: presentación visual a
  recruiters + design source of record. (Memoria `mockup-per-task`.)

## Estado git al cortar
- Rama: **`docs/dor-ac-altitude`** (es el branch del PR #20; ojo, los cambios de abajo NO son de ese PR).
- **Sin commitear:** `docs/DEFINITION_OF_DONE.md` (check #4), `docs/mockups/` (nuevo), `HANDOFF.md`.
- **Plan de encapsulado propuesto (no ejecutado):** el **mockup** viaja con la rama de la feature
  cuando se construya (es su design source). El **check #4 del DoD** se suma al lote de PRs de
  proceso que esperan la **escena de Matías** (#19 DoD authz, #20 DoR altura) — su revisión de ese
  backlog ES el onboarding. Preguntar al usuario antes de commitear/ramificar.

## Lo que sigue en la narrativa (plan que el usuario eligió, no re-litigar)
- **(a) ahora:** correr esta primera feature por la cinta — planning **hecho**, falta **construir**.
- **(b) después:** **escena de la llegada de Matías** (ing #2), que revisa el backlog de PRs de
  proceso (#19, #20, y ahora el del DoD check #4). Jugada transparente (empresa = sim), NO con cuenta
  burner. Matías = personaje, no cuenta real.

## Deferidos que siguen (avisar proactivamente cuando corresponda)
- **Escaneo de dependencias en CI** (vuln CRÍTICA del `npm install`): deferido, sigue caliente
  (supply-chain).
- **Durabilidad de la DB** (in-memory, resetea) + migraciones — ahora más visible: el umbral no
  sobrevive un restart. En Known limitations de #21.
- Flag `Secure` de la cookie (prod/HTTPS); fix de timing en `authenticate` (hash dummy); cola de
  revisión de faltantes (v2 maker-checker).
- **v2 del charter:** ejecución-con-veredicto autónomo (hoy v1 = solo planning) + ambiente corriendo.
  Deferido a "cuando el arnés esté probado".
- **Branch protection en main: intencionalmente APAGADA.** Estándar documentado (DoD/DoR/charter), no
  gate vivo, hasta que exista cuenta de revisor real. **NO re-prender.** (Memoria `review-gate-posture`.)
- Cuentas + perfiles de dev reales: idea del usuario "el día de mañana". No ahora.

## Rol y estilo (CRÍTICO — no cambió)
- Claude = **mentor de QA / thought partner**, NO asistente. Desafía supuestos, explica trade-offs,
  lente de madurez/ROI en cada recomendación de tooling. (CLAUDE.md.) Esta sesión peleó bien el tope,
  el multi-sesión y el default — salieron mejores decisiones de esas tensiones.
- **El usuario NO quiere rubber-stamp:** se compromete con postura + porqué; ahí Claude discute (a
  veces defendiendo la contraria).
- **Voz de artefactos = seria, técnica, EN INGLÉS, sin metáforas** (issues, DoD, test plan, mockup).
  Conversación en criollo. (Memorias `artifact-voice`.)
- **Se engancha con la evolución de ROLES/narrativa** → escenas con personajes con nombre. Cast:
  **Sofía** (PM), **Matías** (ing #2, próxima escena), **Ana** (dueña), **Bruno** (empleado), **Caro**
  (cadete). (`narrative-fuels-engagement`.)
- **Playwright lo aprende en el trabajo** → enseñar E2E a fondo cuando se llegue a TC-01..06.
  (`playwright-real-job`.)
- **Saltos de fase grandes**, norte = QA ecosystem entendible/escalable/**vendible**;
  **la honestidad vende**. (`phase-granularity`.)
- **Guardar SIEMPRE al cerrar.** (`save-on-leave`.)

## Stack y comandos
- Vite + Vitest + `better-sqlite3` + `zod` + `tsx` + `@playwright/test`. Auth/authz sin dep nueva.
- **Correr la app:** `npm run dev:api` (:3001) + `npm run dev` (:5173, proxy /api). DB in-memory.
- **Tests:** `npm test` (vitest), `npm run test:e2e` (playwright), `npx tsc --noEmit`.
- **Screenshot de mockup:** `npx playwright screenshot --full-page <file.html> <file.png>`.
- **Login dev:** `ana`/`estoca-ana` (dueña), `bruno`/`estoca-bruno` (empleado), `caro`/`estoca-caro`
  (cadete).
- **Charter del agente:** `docs/qa/ai-testing-agent-charter.md` en la rama **`docs/ai-testing-agent`**
  (BORRADOR, sin PR aún). Es el marco que gobierna el paso de derivación de casos.
- `gh` con scope `project` ya configurado. Repo: `santiagodeleon1411/qa-operating-system`.
- Board: https://github.com/users/santiagodeleon1411/projects/1 (campo Stage).

## Suggested skills (para la próxima sesión)
- **`run`** — levantar la app para ver el badge/UI a medida que se construye la feature.
- **`verify`** — ejercitar la feature del umbral de punta a punta una vez implementada.
- **`code-review`** — sobre el diff de la feature una vez construida.
- **`security-review`** — el endpoint de setear umbral toca autorización (owner-only); vale un pase.
- **`handoff`** — al cerrar la próxima sesión, re-compactar el estado.
- (El "agente de testing" del charter se juega con Claude mismo; no es una skill.)
