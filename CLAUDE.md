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
  index.ts          Express app entry point (currently exposes GET /health)
  db/
    index.ts         Drizzle client, connects via DATABASE_URL
    schema.ts         Drizzle table definitions
  controllers/        (empty scaffold — request handlers go here)
  routes/              (empty scaffold — Express routers go here)
  middlewares/         (empty scaffold — Express middleware goes here)
  services/            (empty scaffold — business logic / external API integrations go here)
docs/                  Planning docs (requirements, data sources, dev environment)
```

The `controllers`, `routes`, `middlewares`, and `services` directories currently only contain
`.gitkeep` placeholders — the project is an early-stage scaffold. When adding features, follow this
layering: **routes** wire HTTP paths to **controllers**, controllers call **services** (which hold
business logic and talk to external APIs/DB), and **middlewares** handle cross-cutting concerns
(auth, validation, error handling).

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
