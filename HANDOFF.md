# HANDOFF — QA Operating System

**Fecha:** 2026-07-04
**Estado:** Stage 0 (Genesis) CERRADO. En el límite Stage 0 → Stage 1, esperando que el usuario elija dirección.

---

## ▶ AL RETOMAR — leé esto primero

La fundación y la etapa Genesis están completas. **Lo único pendiente es que el usuario elija el rumbo de Stage 1 entre tres escenarios (A / B / C)** — están al final de este doc. No hay que rehacer nada; se arranca eligiendo escenario.

Antes de responder, **leé los artefactos** (no los dupliques, ya existen):
- `docs/adr/0001-how-we-record-decisions.md`
- `docs/adr/0002-the-simulated-company.md`
- `docs/adr/0003-genesis-quality-posture.md`
- `CONTEXT.md`
- Los tres docs de fundación: `PROJECT.md`, `HOW_WE_WORK.md`, `CLAUDE.md`

## Rol y estilo (importante para la voz de la sesión)
- Claude es **mentor de QA / thought partner**, NO asistente. Desafía supuestos, explica trade-offs, presenta alternativas, adapta a la madurez de la empresa. Ver `CLAUDE.md` y `HOW_WE_WORK.md`.
- Se trabaja **discusión → consenso → recién ahí documentar**. Una pregunta a la vez (estilo grill-me).
- **Artefactos en inglés, conversación en español.**
- **Ritmo:** el usuario se abrumó una vez con demasiados nombres/tecnicismos juntos. Ir despacio, pocos términos nuevos por vez, chequear comprensión.

## Qué se decidió (resumen; el detalle está en los ADRs)
- **Empresa:** "Estoca" (nombre provisional) — SaaS B2B de control de stock en tiempo real para comercios retail chicos, mono-sucursal. Arranca con UN producto; multiproducto es evento de madurez futuro.
- **Columna vertebral:** hitos de madurez (pre-producto → MVP → primeros clientes → escalamiento → madurez).
- **Lector primario:** el QA/Engineering Manager que va a entrevistar al usuario.
- **Realismo:** diseño-real siempre; artefactos concretos solo en momentos críticos de credibilidad; Figma MCP y conexiones reales cuando el dolor las justifique.
- **Rol del usuario en la historia:** ingeniero #1 que carga la mirada de calidad (QA nace desde cero).
- **Postura de calidad de Genesis:** poco esfuerzo, todo concentrado en el invariante "el Stock nunca miente" (Stock derivado de los movimientos, no un contador mutable). Se niega explícitamente: hire de QA, plan formal, framework E2E, gates de CI. Ver ADR-0003.
- **Calibración del usuario:** mid-senior, ~4 años. Desafiarlo en trade-offs y estrategia.

## Preguntas abiertas (diferidas a propósito)
- **Offline** (comercios con internet flojo): riesgo conocido, MVP es online-only, sin resolver.
- Nombre "Estoca" sigue provisional.
- Horizonte de "hasta dónde llega la simulación".
- `CONTEXT.md` es v1 — el usuario iba a revisar términos con ojo de dueño del rubro (¿"Merchant" vs "Comercio"?).

## Suggested skills / tooling
- **`/handoff`** — instalada en `.claude/skills/handoff/`. (Nota: no estaba registrada como comando invocable en la sesión que la creó; puede necesitar reiniciar Claude Code para que aparezca.)
- Ninguna herramienta nueva de QA todavía — por diseño, es demasiado temprano. La próxima (framework de tests o Figma MCP) entra cuando una etapa lo justifique, explicando problema/encaje/costo.

## Bootstrap analizado (referencia)
Se revisó el bootstrap en `/Users/santiagodeleon/repos/bootstrap-skill/bootstrap-skills-main`. Es una metodología de *desarrollo* (Windows/PowerShell, DOMO/Zoho). NO instalar completo. Piezas de oro adoptadas/a adoptar: formato ADR + CONTEXT.md (ya adoptados), método grill-me/grill-with-docs. Para más adelante: tdd, review-loop, to-prd/to-issues cuando haya software real.

---

## ⏳ DECISIÓN PENDIENTE — Stage 1: elegir A, B o C

- **A) El primer cliente… y el primer bug en producción.** Primer comercio que paga; a los días, un descuadre real de stock. Stage 1 = primer incidente, cuánto proceso agregar. → *manejo de incidentes y riesgo.*
- **B) Señales de que funciona: 5 comercios y piden más.** Aparece tracción (multi-sucursal, proveedores). Stage 1 = ¿cuándo vale la pena la primera automatización? → *escalar el producto.*
- **C) Llega plata y llega gente: entra el ingeniero #2.** El equipo se duplica. Stage 1 = proteger el invariante cuando otros tocan el código (code review, definición de "listo"). → *escalar el equipo.*
