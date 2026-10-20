# AGENTS.md — NatureMaps-Backend

Guía para agentes (y personas) que trabajen en este repositorio. Mantenerla actualizada cuando
cambien los comandos, la estructura o las convenciones.

> Última verificación: 2026-10-20 · `main` @ `4612131` · `origin/explore_open_data` @ `e0b8dfa`
> (sin commits nuevos en `origin`).

## Qué es este proyecto

**Nature MAPS** (referido como *Flower MAP* en la documentación de diseño) es una guía botánica
turística multilingüe centrada en Valencia. Este repositorio es el **backend**: una API
Express + TypeScript sobre PostgreSQL (Neon) con Drizzle ORM.

El backend actúa como **capa de integración y normalización** sobre fuentes de datos abiertas; no
pretende ser una base botánica construida desde cero.

- Backend (este repo): `github.com/huugok/NatureMaps-Backend`
- Frontend (repo hermano, misma carpeta padre): `github.com/huugok/NatureMaps-Frontend`
- Documentación de producto compartida: `../docs/` (PDF/ODT/XLSX: requisitos, DAFO,
  estudio de competidores, proyección de ingresos)
- Documentación de integración: `origin/explore_open_data:docs/`
  (`Nature_MAPS_Requisitos.pdf`, `Lluvia_de_ideas.pdf`, `Flower MAP — Data Sources.md`)
- Convenciones para agentes: `docs/agents/` (`issue-tracker.md`, `triage-labels.md`,
  `domain.md`, `git-workflow.md`)

No hay monorepo ni workspace: cada repo se instala y se ejecuta por separado con `npm`.

## Estado de ramas (leer antes de empezar)

`main` contiene **solo el scaffold** (commit `4612131`: Express + `/health` + conexión Drizzle).
La implementación real vive en `origin/explore_open_data` (5 commits sin mergear, HEAD `e0b8dfa`):

- ingesta de arbolado de Valencia Open Data + tabla `trees`
- enriquecimiento de especies vía Wikipedia/Wikidata + tabla `species`
- endpoints `/trees` y `/species`
- `CLAUDE.md`, `README.md` y `docs/` propios de esa rama

Antes de asumir que una carpeta está vacía, comprobar la rama:
`git branch -r` y `git log --oneline main..origin/<rama>`.
Ese `CLAUDE.md` de la rama describe la misma arquitectura en inglés; al mergear, evitar que quede
duplicado con este archivo (dejar una sola fuente de verdad y un puntero desde el otro).

## Stack

- Node.js (probado con v26), npm, ESM (`"type": "module"`).
- Express 5, CORS abierto (`cors()` sin opciones) y `express.json()`.
- PostgreSQL en Neon vía `@neondatabase/serverless` + `drizzle-orm/neon-http`.
- Drizzle Kit para generar/aplicar migraciones y `drizzle-kit studio`.
- `tsx watch` en desarrollo, `tsc` para el build.

## Comandos

```bash
npm install
npm run dev            # tsx watch src/index.ts
npm run build          # tsc -> dist/
npm start              # node dist/index.js

npm run db:generate    # migraciones SQL desde src/db/schema.ts -> drizzle/
npm run db:migrate     # aplica migraciones
npm run db:push        # empuja el schema sin migraciones (solo prototipado)
npm run db:studio      # Drizzle Studio
```

No hay linter ni suite de tests configurados. No inventar `npm test` ni afirmar que algo está
"validado": la verificación real hoy es `npx tsc --noEmit` (o `npm run build`) y probar los
endpoints con `curl` contra el servidor en marcha.

## Variables de entorno

`.env` está gitignored. Partir de `.env.example`:

- `DATABASE_URL` — cadena de Neon, con `sslmode=require`.
- `PORT` — puerto HTTP (por defecto `3000`).

Nunca leer, imprimir ni commitear valores reales de `.env`.

## Estructura y capas

```
src/index.ts        App Express: CORS, JSON, GET /health, monta routers
src/db/index.ts     Cliente Drizzle (neon-http) a partir de DATABASE_URL
src/db/schema.ts    Tablas Drizzle
src/routes/         Routers (solo cablean rutas -> controladores)
src/controllers/    Handlers HTTP: parsean request, responden, sin lógica de negocio
src/services/       Lógica de negocio e integración con APIs externas
src/middlewares/    Cross-cutting (validación, errores, auth) — vacío por ahora
docs/agents/        Convenciones para agentes (issue tracker, domain docs)
```

Regla de capas a seguir en features nuevas: **routes → controllers → services**, y middlewares para
lo transversal. No poner lógica ni acceso a datos directamente en los handlers de rutas.

En `main` las carpetas `controllers/`, `routes/`, `services/` y `middlewares/` solo tienen
`.gitkeep`; el ejemplo completo está en `origin/explore_open_data`.

## Modelo de datos y procedencia

Tablas implementadas en la rama de feature:

- `trees` — árboles importados de Valencia Open Data. `external_id` (= `idarbol`) único; nombres
  científico/común (es/ca), distrito, barrio, lat/lon; `source` y `imported_at`.
- `species` — enriquecimiento cultural por especie, clave = nombre binomial normalizado (único);
  `wikidata_id`, `wikipedia_lang`, `wikipedia_url`, `description`, `cultural_extract`,
  `image_url`, `source`, `fetched_at`.
- `users` — tabla de ejemplo del scaffold, sin uso todavía.

**La procedencia es requisito de diseño**: cada tabla o job que importe datos externos debe
guardar fuente, id del registro original, licencia/atribución y fecha de importación. Las
inserciones deben ser idempotentes (`onConflictDoNothing` sobre la clave natural).

## Endpoints (rama `explore_open_data`)

- `GET /health` → `{ status: 'ok' }`
- `POST /trees/import?limit=200` — descarga N árboles del endpoint ArcGIS de Valencia y los inserta
  (idempotente). Devuelve `{ fetched, stored }`.
- `GET /trees?limit=200` — `{ total, returned, limit, trees }`.
- `GET /trees/:id` — árbol + su `species` (o `null`); 400 si el id no es numérico, 404 si no existe.
- `POST /species/enrich` — enriquece especies distintas de `trees` que aún no estén guardadas.
  Devuelve `{ totalSpecies, alreadyStored, enriched, notFound, failed }`.
- `GET /species` — `{ total, species }`.

Los `GET` no requieren parámetros para poder abrirlos en el navegador
(`http://localhost:3000/trees/1`).

## Integraciones externas

- **Valencia Open Data** (Arbolado): endpoint ArcGIS REST `MapServer/151/query`, sin API key,
  ~157k árboles; usar `resultRecordCount` para limitar y no pedir el inventario completo.
- **Wikipedia REST summary** (`/api/rest_v1/page/summary/{title}`): gratis, probar `es` y caer a
  `en`, con `User-Agent` descriptivo obligatorio por etiqueta de Wikimedia.
- **Wikidata**: el id llega en el propio summary (`wikibase_item`); no hace falta llamada aparte.
- Previstas: GBIF, Overpass/OSM, BDBCV, IDEV, AEMET.

Normalización importante: los nombres de Valencia incluyen cultivares/sexo
(`"Morus alba 'Fruitless'"`, `"Phoenix dactylifera hembra"`); usar `toBinomialName()` antes de
buscar en Wikipedia y como clave de `species`.

## Convenciones

- **ESM + `nodenext`**: los imports relativos llevan extensión `.js` aunque el fichero sea `.ts`
  (`import { db } from './db/index.js'`). `verbatimModuleSyntax` obliga a `import type` para tipos.
- **TypeScript estricto**: `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
  Comprobar `undefined` al indexar arrays/objetos y no pasar `undefined` a props opcionales.
- **Schema primero**: cambiar `src/db/schema.ts` y luego `db:generate` + `db:migrate`
  (`db:push` solo para prototipado). No editar tablas a mano.
- Un módulo de servicio por fuente externa (fetch + normalización), y un router/controlador por
  recurso.
- No commitear `.env`, `node_modules` ni `dist` (ya ignorados).
- Estilo: seguir el fichero que se toca (comillas simples, sin punto y coma en el scaffold).
  No hay Prettier/ESLint; no reformatear código ajeno.

## Problemas conocidos

- `npm run build` puede fallar en Windows con
  `Unable to resolve @typescript/typescript-win32-x64` (falta el binario nativo de TypeScript 7).
  `npm run dev` (tsx) no se ve afectado.
- Si aparecen acentos corruptos (`Ã©`) al inspeccionar respuestas, revisar la herramienta de
  inspección antes que el código: Express, el driver de Neon y `fetch` manejan UTF-8 bien.

## Git

`main` está protegida: **no se pushea directo ni se mergea sin PR**. El flujo completo, la
configuración de protección y el versionado están en `docs/agents/git-workflow.md`.

- Rama por cambio: `feat/<slug>`, `fix/<slug>`, `docs/<slug>` o `chore/<slug>`, siempre desde
  `main` actualizado.
- PR obligatoria contra `main`; merge con **squash** y borrado de la rama. Nada de force-push ni de
  borrar `main`.
- Una PR debe pasar build/tipos/lint/tests y estar al día con `main` antes del merge.
- Commits en imperativo con prefijo `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Versionado por tags semver `vX.Y.Z` en cada repo; subir `package.json` solo en la PR de release.
- Issues: GitHub Issues vía `gh`, repo inferido del remote (`docs/agents/issue-tracker.md`).
- Este checkout es el principal del repo: para trabajo en paralelo, usar worktrees en vez de
  ramas sin commitear en el árbol principal.
- No hacer `git push` ni abrir PRs sin que lo pida el usuario.
- Rama de trabajo actual sin prefijo (`explore_open_data`): nació antes de esta política; no
  renombrar sin cerrar su PR.

## Agent skills

### Issue tracker

GitHub Issues vía `gh` (repo inferido del remote). See `docs/agents/issue-tracker.md`.

### Triage labels

Cinco roles canónicos, con el mismo nombre como label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` en la raíz. See `docs/agents/domain.md`.
