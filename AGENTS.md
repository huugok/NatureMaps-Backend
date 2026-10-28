# AGENTS.md — NatureMaps-Backend

Guía para agentes (y personas) que trabajen en este repositorio. Mantenerla actualizada cuando
cambien los comandos, la estructura o las convenciones.

> Última verificación: 2026-10-27 · `origin/main` @ `bd4ed52`.
> `feat/plant-data-model`: una migración inicial limpia para el catálogo simplificado.

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
- Documentación histórica del prototipo: [docs del archivo](https://github.com/huugok/NatureMaps-Backend/tree/032d4f8f722a5a246e79a9e967b805cdad87f6f7/docs),
  conservadas en el tag remoto `archive/explore-open-data` (`032d4f8`, incluye `e0b8dfa`)
  (`Nature_MAPS_Requisitos.pdf`, `Lluvia_de_ideas.pdf`, `Flower MAP — Data Sources.md`)
- Convenciones para agentes: `docs/agents/` (`issue-tracker.md`, `triage-labels.md`,
  `domain.md`, `git-workflow.md`)

No hay monorepo ni workspace: cada repo se instala y se ejecuta por separado con `npm`.

## Estado de ramas (leer antes de empezar)

`origin/main` ya incluye identificación Pl@ntNet (`/plants/identify`, página `/probar`), además
del scaffold. La antigua rama `explore_open_data` fue retirada; su prototipo se conserva en el
tag remoto `archive/explore-open-data` (`032d4f8`, posterior a `e0b8dfa`):

- ingesta de arbolado de Valencia Open Data + tabla `trees`
- enriquecimiento de especies vía Wikipedia/Wikidata + tabla `species`
- endpoints `/trees` y `/species`
- `CLAUDE.md`, `README.md` y `docs/` propios de esa rama

Para consultar el archivo desde otro clon: `git fetch origin tag archive/explore-open-data`,
y después `git show archive/explore-open-data:<ruta>`.
Las instrucciones actuales para agentes se mantienen solo en este archivo; no copiar las del prototipo.

En `feat/plant-data-model`, `docs/data-model.md` describe cuatro tablas de catálogo, con `users`
conservada del scaffold. Solo queda `0000_plant_catalog`; el reinicio experimental se describe
en «Decisión de reinicio de la base de prueba», más abajo. `/trees` y `/species` usan el modelo simplificado;
Wikipedia, Wikidata e imágenes están adaptados.
Documentación vigente: [README.md](README.md) para comandos y
[docs/data-model.md](docs/data-model.md) para el modelo y flujo de importación.
El archivo conserva el código y los documentos originales; no es una copia de seguridad de la
base ni de las migraciones intermedias descartadas. La documentación vigente está en este checkout.

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
npm run test:catalog   # Node Test Runner + tsx + PGlite; sin .env ni servicios externos
npm start              # node dist/index.js

npm run db:generate    # migraciones SQL desde src/db/schema.ts -> drizzle/
npm run db:migrate     # aplica migraciones
npm run db:seed        # seed idempotente del contenido editorial (species_profiles)
npm run db:push        # empuja el schema sin migraciones (solo prototipado)
npm run db:studio      # Drizzle Studio
node docs/check-db.mjs # SELECT de conexión; sin cambios en datos
```

En PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd` con los mismos argumentos.

No hay linter ni comando `npm test`. Para cambios del catálogo ejecutar `npm run build` y
`npm run test:catalog`. La suite ejecuta la migración y el SQL real sobre PGlite, y prueba HTTP con
un upstream ficticio; no demuestra disponibilidad de Neon ni del ArcGIS público.

## Variables de entorno

`.env` está gitignored. Partir de `.env.example`:

- `DATABASE_URL` — cadena de Neon, con `sslmode=require`.
- `PORT` — puerto HTTP (por defecto `3000`).

Nunca leer, imprimir ni commitear valores reales de `.env`.

### Rotación de credenciales

- **2026-10-28 — `DATABASE_URL` rotada.** La cadena de conexión de Neon quedó
  expuesta en una sesión de trabajo (chat del agente) y se restableció la
  contraseña en Neon. **Si tenías la cadena anterior configurada en tu `.env`
  local, ya no funciona**: pide la cadena nueva y actualiza tu `.env`. La
  cadena válida vive únicamente en `.env`; cualquier copia anterior (historial
  de chat incluido) es inválida: no usarla, no compartirla y rotar de nuevo si
  reaparece en algún sitio.
- **2026-10-28 — `PLANTNET_API_KEY` rotada** (quedó expuesta en esa misma
  sesión). **Si tenías la clave anterior configurada, ya no funciona**: pide
  la nueva y actualiza tu `.env`. La clave válida vive únicamente en `.env`;
  cualquier copia anterior es inválida.

## Estructura y capas

```
src/index.ts        Carga .env e inicia el servidor HTTP
src/app.ts          App Express: CORS, JSON, GET /health, monta routers
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

En `main` ya hay router/controlador/servicio para Pl@ntNet. La ingesta normalizada está en
`src/services/inventoryImport.ts`; `valenciaOpenData.ts` obtiene/valida/normaliza y no accede a BD.
`treeCatalog.ts` devuelve una lista ligera; la ficha incluye procedencia y especie enriquecida.
Las posiciones municipales `Falta` se excluyen sin almacenarlas. `stored` cuenta plantas nuevas,
`excluded` posiciones ausentes y `skipped` plantas ya guardadas. No hay `runId` ni `located`.
Los nombres se guardan por ejemplar e idioma para no mezclar `macho`/`hembra`.
`neon-http` no admite callbacks interactivos `db.transaction`: usar batches transaccionales para
las escrituras relacionadas. El importador usa un bloqueo transaccional por conjunto de datos.

## Modelo de datos y procedencia

Catálogo actual: `species`, `plant_locations`, `plant_names`, `species_enrichments`,
`species_profiles` (ficha editorial curada por especie/idioma, cargada con `npm run db:seed`,
idempotente y adjunta al taxón existente por nombre científico; los textos curados mandan sobre
Wikipedia con `coalesce` y las fotos siguen en `species_enrichments`).
Consultar `docs/data-model.md` antes de cambiar importación o lectura. `users` se conserva.
El usuario redujo expresamente el alcance a plantas, Wikipedia y la integración Pl@ntNet existente.
No recrear logs, payloads completos ni infraestructura genérica para proveedores futuros.
`plant_locations` guarda fuente, ID/enlace externos y fecha; los nombres heredan esa procedencia.
`(source, external_id)` evita plantas duplicadas; `(source, scientific_name)` agrupa etiquetas dentro
de una fuente sin reconciliar taxones entre proveedores. No usar `toBinomialName()` como identidad global.
`POST /species/enrich?lang=es|en` carga solo la edición solicitada y detecta pendientes por idioma;
sin `lang`, conserva el modo anterior es → en para especies sin ningún enriquecimiento. No sobrescribir
otros idiomas ni guardar fallback con una etiqueta de idioma incorrecta. La lectura elige el idioma
disponible según `lang` y sus fallbacks; no es traducción automática.
Wikipedia guarda texto, Wikidata, enlace y fecha por especie/idioma. Créditos/licencias son columnas
simples del enriquecimiento; las condiciones municipales comunes permanecen en el adaptador.
Solo se guardan imágenes con créditos y condiciones reconocidas; no hay cola de imágenes pendientes.
Pl@ntNet no persiste observaciones: no añadir tablas sin implementar un flujo que las utilice.

Tablas del prototipo archivado (no confundir con la migración inicial nueva):

- `trees` — árboles importados de Valencia Open Data. `external_id` (= `idarbol`) único; nombres
  científico/común (es/ca), distrito, barrio, lat/lon; `source` y `imported_at`.
- `species` — enriquecimiento cultural por especie, clave = nombre binomial normalizado (único);
  `wikidata_id`, `wikipedia_lang`, `wikipedia_url`, `description`, `cultural_extract`,
  `image_url`, `source`, `fetched_at`.
- `users` — tabla de ejemplo del scaffold, sin uso todavía.

**Procedencia mínima**: guardar referencias de origen de plantas y enriquecimientos, heredando
lo común sin duplicar tablas/metadatos. Las inserciones deben ser idempotentes sobre su clave natural.

### Decisión de reinicio de la base de prueba

Durante la preparación de esta PR, su autor decidió sustituir las migraciones experimentales por
una inicial limpia, tras indicar en la sesión de trabajo que nadie más las utilizaba y que los
pocos datos de prueba podían recuperarse mediante importación. Codex propuso el procedimiento y,
tras la indicación expresa del autor de borrar y recrear, ejecutó el reset contra la base de
`DATABASE_URL`, seguido de `db:migrate`. Fue una decisión del autor, no una aprobación del equipo.

La base no tenía datos de aplicación al inicio de la tarea; antes del reset ya se había cargado
una muestra de prueba de 13 plantas/5 especies y su Wikipedia. Se eliminaron las tablas de
aplicación existentes y `drizzle.__drizzle_migrations`, incluida la tabla de aplicación `users`.
Los DROP estaban limitados a nombres conocidos: `data_sources`, `import_runs`, `source_records`,
`species_names`, `species_descriptions`, `species_media`, `plant_locations`, `species`, `users`,
y, si existían, `trees`, `plant_names`, `species_enrichments`. No se eliminaron la base Neon,
los roles PostgreSQL ni las cuentas de Neon. No se registró un recuento previo de filas de `users`.

Se descartaron los SQL/snapshots locales intermedios, que no se habían publicado; el tag del
prototipo no conserva esos archivos ni los datos borrados. Se generó la nueva `0000_plant_catalog`
y su snapshot/journal. Tras aplicarla se comprobaron cinco tablas vacías y una entrada de migración;
posteriormente se volvió a importar/enriquecer la muestra. El motivo fue simplificar el modelo
de una base de desarrollo desechable antes de compartir su primera migración.

Las herramientas temporales de reset se retiraron. Los cambios futuros requieren migraciones
incrementales; esta decisión puntual no autoriza nuevos resets.

## Endpoints del prototipo archivado

- `GET /health` → `{ status: 'ok' }`
- `POST /trees/import?limit=200` — descarga N árboles del endpoint ArcGIS de Valencia y los inserta
  (idempotente). Devuelve `{ fetched, stored }`.
- `GET /trees?limit=200` — `{ total, returned, limit, trees }`.
- `GET /trees/:id` — árbol + su `species` (o `null`); 400 si el id no es numérico, 404 si no existe.
- `POST /species/enrich` — enriquece especies distintas de `trees` que aún no estén guardadas.
  Devuelve `{ totalSpecies, alreadyStored, enriched, notFound, failed }`.
- `GET /species` — `{ total, species }`.
- `GET /species/:id` — ficha completa: fila de catálogo + `profile` editorial + `enrichment` +
  `image` con créditos, `content` resuelto (editorial → Wikipedia) y `locations` paginadas por
  clave (`?afterLocationId=`, `?locationLimit=`, `?lang=`); 400 si el id no es numérico,
  404 si no existe.

Los `GET` no requieren parámetros para poder abrirlos en el navegador
(`http://localhost:3000/trees/1`).

## Integraciones externas

- **Valencia Open Data** (Arbolado): endpoint ArcGIS REST `MapServer/151/query`, sin API key,
  ~157k árboles; usar `resultRecordCount` para limitar y no pedir el inventario completo.
- **Wikipedia REST summary** (`/api/rest_v1/page/summary/{title}`): gratis, probar `es` y caer a
  `en`, con `User-Agent` descriptivo obligatorio por etiqueta de Wikimedia.
- **Wikidata**: el id llega en el propio summary (`wikibase_item`); no hace falta llamada aparte.
- Previstas: GBIF, Overpass/OSM, BDBCV, IDEV, AEMET.

Normalización del prototipo: los nombres de Valencia incluyen cultivares/sexo
(`"Morus alba 'Fruitless'"`, `"Phoenix dactylifera hembra"`); usar `toBinomialName()` antes de
buscar en Wikipedia. En el catálogo nuevo se conserva el original y se reconocen solo binomios
simples y calificadores conocidos (cultivar entre comillas, hembra/macho), sin identidad global.

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
  Bloqueos y sub-issues con `scripts/tickets.sh` (`link`, `parent`, `show`).
- Este checkout es el principal del repo: para trabajo en paralelo, usar worktrees en vez de
  ramas sin commitear en el árbol principal.
- No hacer `git push` ni abrir PRs sin que lo pida el usuario.
- El prototipo anterior se consulta mediante `archive/explore-open-data`; no restaurar una
  dependencia de la rama eliminada `explore_open_data`.

## Agent skills

### Issue tracker

GitHub Issues vía `gh` (repo inferido del remote). See `docs/agents/issue-tracker.md`.

### Triage labels

Cinco roles canónicos, con el mismo nombre como label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` en la raíz. See `docs/agents/domain.md`.
