# ORION CRM — Agent Rules

## Human Priority
- Time and knowledge are the highest-value resources in this project.
- Do not create avoidable rework, parallel environments, or status confusion.
- Do not present assumptions as completed work.

## Environment Rules
- This repo has one canonical local runtime: `docker compose` from the repository root.
- Before changing anything related to runtime, inspect the existing stack first.
- Do not create or rely on an alternate Docker stack, ad-hoc container flow, or parallel environment when this repo already has a defined compose flow.
- If the running environment is stale, rebuild the current stack. Do not invent a second one.
- If another Docker project exists elsewhere on the machine, treat it as external until explicitly told to remove it.

## UI / Mockup Rules
- A pasta canônica de design visual do projeto é `PRD.DOCS/Designer Systems/`.
- O arquivo base do design system do ORION é `PRD.DOCS/Designer Systems/ORION-DESIGN-SYSTEM.html`.
- Todo mockup `.html` ou artefato visual salvo dentro de `PRD.DOCS/` deve ser tratado como especificação visual obrigatória da feature correspondente.
- Não invente layout, componente, estilo, hierarquia visual, interação ou variação estética se já existir mockup/documentação visual em `PRD.DOCS/`.
- Never say a frontend, page, screen, or interface is "ready", "implemented", or "done" unless all of the following are true:
  - the route/component exists in code
  - the current running environment is using the latest code
  - the page was checked against the user-provided PRD/mockup for that feature
  - the response clearly states whether the result is exact, partial, or only foundational
- If the delivery is backend-first or partial UI, state that directly and explicitly.
- If the user provided mockups, review them before claiming visual completion.
- If the page is protected by login, say that clearly instead of implying it is publicly visible.

## Reporting Rules
- Always separate status into:
  - `Banco`
  - `API/Backend`
  - `Frontend/UI`
- If a visual change is not visible on the page the user is currently checking, state exactly where the change appears.
- If something was not validated in a live browser/runtime, say so explicitly.

## Failure Prevention
- Before saying "it is done", verify the environment that the user is actually using.
- Before saying "the page does not exist", verify route files and runtime status.
- Before saying "the interface is ready", verify the rendered result or explicitly label it as unvalidated.
- If there is ambiguity, stop compressing uncertainty into confidence. Report the uncertainty.
