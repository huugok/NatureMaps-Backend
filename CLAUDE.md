# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## Project overview

**Nature MAPS** (also referred to as "Flower MAP" in the planning docs) is a multilingual botanical
tourism application focused on Valencia, Spain. This repository, **NatureMaps-Backend**, is the
backend service: an Express + TypeScript API backed by a PostgreSQL database (hosted on Neon)
via Drizzle ORM.

The project follows a monolith architecture split across two repositories for team organization
(Software Engineering vs. Creative Technologies):

- **Backend** (this repo): `github.com/huugok/NatureMaps-Backend`
- **Frontend**: `github.com/huugok/NatureMaps-Frontend`

See [docs/](docs/) for the original planning material:

- `Nature_MAPS_Requisitos.pdf` — full functional/non-functional requirements (P0/P1/P2 priority).
- `Lluvia_de_ideas.pdf` — product pitch and user stories.
- `Flower MAP — Data Sources.md` — external open-data sources and the proposed domain model.
- `preparacion-entorno-desarrollo.pdf` — dev environment setup notes (repos, DB, git workflow).

## What the backend is for

The backend's job is to act as an **integration and normalization layer** over several external
data sources, not to be a from-scratch botanical database. Per `docs/Flower MAP — Data Sources.md`,
the intended MVP data sources are:

1. **Valencia Open Data** (Ajuntament de València) — official tree inventory, protected trees,
   parks/green spaces (GeoJSON/JSON/KMZ, CC BY 4.0).
2. **GBIF** — species taxonomy and biodiversity occurrence records.
3. **OpenStreetMap** (Overpass API) — pedestrian paths, parks, cultural POIs for route generation.
4. **BDBCV** (Banco de Datos de Biodiversidad de la Comunitat Valenciana) — regional biodiversity
   observations.

Later/enrichment sources: Wikidata, Wikimedia Commons, Generalitat Valenciana/IDEV, AEMET
(weather).

Every imported record should preserve provenance (`source`, `source_record_id`, `source_url`,
`imported_at`, `license`, etc.) — do not merge external records without tracking where they came
from. See section 4–7 of the data sources doc for the proposed entities (`Species`,
`PlantLocation`, `Observation`, `BotanicalPOI`) and duplicate-detection strategy before adding new
tables or ingestion logic.

## Core product requirements to keep in mind

From `docs/Nature_MAPS_Requisitos.pdf`, the P0/MVP scope the backend needs to support:

- Nearby plants based on user location.
- Plant species identification from a user-submitted photo (via an **external** recognition API —
  not a custom-trained model, per RNF2).
- Plant detail view (name, photo, short botanical description, points of interest).
- Search plants by name/criteria.
- Map of locations for a selected plant.
- Botanical walking routes.
- Multilingual content (user-selectable language).

Non-functional constraints: mobile-first usage, must tolerate limited/intermittent connectivity
(tourists off wifi), plant recognition must call an external API rather than embedding a model.

## Tech stack

- **Runtime**: Node.js, TypeScript (ESM — `"type": "module"` in [package.json](package.json)).
- **Web framework**: Express 5.
- **Database**: PostgreSQL hosted on [Neon](https://neon.tech), accessed via
  `@neondatabase/serverless` + Drizzle ORM (`drizzle-orm/neon-http`).
- **Schema/migrations**: Drizzle Kit ([drizzle.config.ts](drizzle.config.ts), schema at
  [src/db/schema.ts](src/db/schema.ts)).
- **Dev tooling**: `tsx` for watch-mode dev server, `tsc` for production build.

## Repository layout

```
src/
  index.ts          Express app entry point (GET /health, mounts /trees)
  db/
    index.ts         Drizzle client, connects via DATABASE_URL
    schema.ts         Drizzle table definitions (users, trees)
  controllers/
    treesController.ts  Request handlers for /trees (import + list)
  routes/
    trees.ts             Express router mounted at /trees
  middlewares/         (empty scaffold — Express middleware goes here)
  services/
    valenciaOpenData.ts  Fetches + parses tree data from Valencia's open data API
docs/                  Planning docs (requirements, data sources, dev environment)
```

The `middlewares` directory currently only contains a `.gitkeep` placeholder. The `trees` feature
(below) is the first real example of the intended layering: **routes** wire HTTP paths to
**controllers**, controllers call **services** (which hold business logic and talk to external
APIs/DB), and **middlewares** handle cross-cutting concerns (auth, validation, error handling).
Follow this same pattern for new features rather than putting logic directly in route handlers.

## Trees proof of concept (Valencia Open Data)

A working end-to-end example of the ingestion pattern described in
`docs/Flower MAP — Data Sources.md`: fetch from an external source, normalize, store with
provenance.

- **Source**: Valencia City Council's Arbolado (tree inventory) ArcGIS REST endpoint —
  `https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151/query`.
  No API key required. ~157k trees total; requests are capped via `resultRecordCount`.
- **Service**: [src/services/valenciaOpenData.ts](src/services/valenciaOpenData.ts) —
  `fetchValenciaTrees(limit)` requests GeoJSON and maps the raw ArcGIS fields (`idarbol`,
  `nom_botanico`, `nom_comu_c`, `nom_comu_v`, `distrito`, `barrio`, point geometry) onto a plain
  `ValenciaTree` shape.
- **Schema**: `trees` table in [src/db/schema.ts](src/db/schema.ts) — `externalId` (the source's
  `idarbol`, unique) is the dedup key, plus `source: 'VALENCIA_OPEN_DATA'` and `importedAt` for
  provenance, per the data model in the data sources doc.
- **Endpoints** (mounted at `/trees` in [src/index.ts](src/index.ts)):
  - `POST /trees/import?limit=200` — fetches `limit` trees from Valencia Open Data and inserts new
    ones (`onConflictDoNothing` on `externalId`, so re-running is safe and idempotent). Returns
    `{ fetched, stored }`.
  - `GET /trees?limit=200` — plain GET, no required params, so it's directly browser-openable at
    `http://localhost:3000/trees`. Returns `{ total, returned, limit, trees }`.

When extending this pattern to other sources (GBIF, OSM Overpass, BDBCV), mirror the same shape:
one service module per source doing fetch + normalize, a dedicated table with a `source`/
`external_id`/`imported_at` provenance triplet, and idempotent inserts.

## Environment variables

Copy [.env.example](.env.example) to `.env` (gitignored) and fill in real values:

- `DATABASE_URL` — Neon PostgreSQL connection string (`sslmode=require`).
- `PORT` — HTTP port (defaults to `3000` if unset).

Never commit `.env` or real credentials.

## Common commands

```bash
npm run dev          # start dev server with hot reload (tsx watch)
npm run build         # type-check and compile to dist/
npm start              # run compiled server (dist/index.js)

npm run db:generate    # generate SQL migrations from schema.ts
npm run db:migrate      # apply migrations to the database
npm run db:push          # push schema directly (no migration files) — dev convenience only
npm run db:studio         # open Drizzle Studio to browse the database
```

## Conventions and things to watch for

- **ESM everywhere**: local relative imports must use explicit `.js` extensions (see
  `import * as schema from './schema.js'` in [src/db/index.ts](src/db/index.ts)) even though the
  source files are `.ts`, because `moduleResolution`/`module` is `nodenext`.
- **Strict TypeScript**: `tsconfig.json` has `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes` enabled. Write types accordingly (e.g. guard against `undefined` on
  array/object index access).
- **Drizzle schema first**: add/modify tables in `src/db/schema.ts`, then run `db:generate` +
  `db:migrate` (or `db:push` during early prototyping) rather than editing the database by hand.
- **Data provenance is a first-class concern**: any table or ingestion job that imports data from an
  external source (Valencia Open Data, GBIF, BDBCV, OSM, Wikidata, etc.) should record source,
  source record id, and license/attribution, per the data model in
  `docs/Flower MAP — Data Sources.md`.
- **No test suite or linter is configured yet** — if you add one, wire it into `package.json`
  scripts and mention it here.
- **Known issue**: `npm run build` (`tsc`) can fail on Windows with
  `Unable to resolve @typescript/typescript-win32-x64` — TypeScript 7's native compiler is missing
  its platform binary package. `npm run dev` (`tsx`) is unaffected since it doesn't invoke `tsc`.
