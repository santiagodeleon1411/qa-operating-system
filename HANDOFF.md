# HANDOFF — QA Operating System

**Fecha:** 2026-07-05
**Estado:** Stage 1 EN CURSO. Dos fichas de proceso completas (control de versiones + gate
de CI). Esperando elegir/diseñar la siguiente ficha del Stage 1.

---

## ▶ AL RETOMAR — leé esto primero

No hay que rehacer nada. **El producto de Genesis está construido y verificado, y el
Stage 1 arrancó con dos fichas ya completas.** Se retoma eligiendo la próxima ficha
(ver "Decisión pendiente" al final).

Antes de responder, **mirá los artefactos** (existen, no los dupliques):
- Repo: **https://github.com/santiagodeleon1411/qa-operating-system** (PÚBLICO)
- ADRs `docs/adr/0001`…`0004` — el 0004 (gate de CI) supersede el "no CI" del 0003.
- `estoca/` — producto corriendo (Vite + TS). `estoca/README.md` explica correr/testear.
- `docs/qa/genesis-manual-test-execution.md` — registro manual firmado de Genesis.
- `showcase/` — accesos `.command` doble-clickeables al producto tangible.
- Fundación: `PROJECT.md`, `HOW_WE_WORK.md`, `CONTEXT.md`, `CLAUDE.md`.

## Rol y estilo (CRÍTICO para la voz de la sesión)
- Claude es **mentor de QA / thought partner**, NO asistente. Desafía supuestos, explica
  trade-offs, adapta a la madurez de la empresa.
- **El usuario pidió explícitamente NO ser rubber-stamp:** en decisiones importantes,
  **él se compromete primero** con una postura y su porqué; recién ahí Claude discute,
  a veces defendiendo la opción contraria. Discrepar es el objetivo. (Ver esta dinámica
  en acción en la sesión: varias veces el usuario razonó bien solo y se lo reforzó; una
  vez Claude se equivocó — "arrancás solo" — y el ADR-0003 le dio la razón al usuario.)
- **Artefactos en inglés, conversación en español.**
- **Ritmo:** pocos términos nuevos por vez, chequear comprensión. El usuario se abruma
  con jerga acumulada. Explicar conceptos en criollo (ej.: se explicó "invariante" de cero).
- Filosofía: cada herramienta entra **cuando el dolor la justifica**, de a una ficha.

## Canon de la simulación (NO volver a confundir)
- Estoca en Genesis = **3 personas, pre-PMF** (ADR-0003). El usuario es **ingeniero #1,
  el único que escribe código**. El escenario elegido para Stage 1 fue **"crece la carga
  y no das abasto" → entra el ingeniero #2** (tracción, tono de planificación fría, no susto).
- Invariante sagrado: **"el Stock nunca miente"** — Stock derivado de los movimientos,
  nunca un contador mutable. Ya está hecho estructura en el código + safety net.
- (Memoria persistida en `estoca-genesis-canon` con esto.)

## Qué se construyó en esta sesión (detalle en commits/ADRs)
1. **Producto Genesis materializado** — `estoca/`: web clickeable (ver Stock derivado,
   registrar movimiento, sin botón de "editar stock"), + safety net Vitest (9 tests) sobre
   el invariante, con la historia rojo-a-verde del "contador mutable". Verificado:
   `npm test` 9/9, build OK, dev server HTTP 200.
2. **`showcase/`** — 3 accesos `.command` (abrir web / correr tests / ver pruebas manuales)
   + README con tabla de artefactos QA por etapa.
3. **Ficha #1 Stage 1 — control de versiones:** `git init` + repo GitHub. Todo el proyecto
   como UN repo. `gh` autenticado como `santiagodeleon1411`; `gh auth setup-git` ya corrido
   (git push funciona).
4. **Ficha #2 Stage 1 — gate de merge:** PR obligatorio + `Protect main` ruleset [active]
   + CI (GitHub Actions) que corre el safety net en cada PR. ADR-0004. **El check requerido
   se llama `Estoca — safety net`.** PR #1 ya mergeado a `main`.

## Decisión "público vs privado" (importante)
- El branch protection **no existe en repos privados del plan free** (403: "Upgrade to Pro
  or make public"). Para darle **dientes** al gate, el usuario eligió **hacer el repo
  público**. Es reversible.
- **COMPROMISO PENDIENTE DE CLAUDE:** avisarle proactivamente al usuario **si/ cuándo
  conviene volver a privado** (ej.: si se agrega algo sensible, o si quiere "esconder" una
  etapa a medio hacer antes de mostrarla a un recruiter puntual). Tenerlo presente.

## Stack y herramientas del usuario (para recomendar en su lenguaje)
- TS/JS **básico**, Playwright, GitHub, GitHub Actions. Cómodo con eso.
- Instalado en la sesión: Node 22, npm, `gh` 2.96, Homebrew, git 2.55.
- El producto usa Vite + Vitest (safety net). Playwright todavía NO entró (sería el primer
  E2E cuando la UI se estabilice — ver watch-out en ADR-0003/0004).

## Preguntas abiertas (diferidas a propósito)
- **Offline** (comercios con internet flojo): MVP online-only, sin resolver.
- Nombre "Estoca" sigue provisional.
- Horizonte de "hasta dónde llega la simulación".

## Suggested skills / tooling
- **`/handoff`** — este doc.
- Próximas fichas naturales del Stage 1 (introducir de a UNA, con discusión previa):
  **"definición de listo" + revisión humana** del ingeniero #2, **GitHub Issues** como
  gestión de tareas coherente para 2 personas (crece a tablero cuando haga falta), y más
  adelante el **primer Playwright E2E**. El **revisor de IA (Copilot)** quedó explícitamente
  postergado: no conoce el invariante, no puede ser su guardián (ver ADR-0004).
- Cuando toque tocar código del producto: `/run` (levantar la app) y `/code-review` sobre PRs.

---

## ⏳ DECISIÓN PENDIENTE — próxima ficha del Stage 1

El gate protege el invariante de forma determinística. Pero quedan huecos que los tests
NO cubren (diseño, contexto, legibilidad, cosas que el ingeniero #2 podría hacer distinto).
**Preguntar al usuario cuál ficha sigue** — dejar que se comprometa primero:
- **Revisión humana + "definición de listo"** (qué significa que un cambio está terminado
  y listo para mergear, más allá de que el CI pase). ← candidato más natural.
- **GitHub Issues** para gestionar el trabajo de los dos (evidencia de flujo de equipo real,
  del tamaño real: 2 personas, no un sprint board inflado).
- Otra que proponga el usuario.

No railroad-ear: presentar el hueco, pedirle su postura y su porqué, después discutir.
