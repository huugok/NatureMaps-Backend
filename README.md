# Nature MAPS — Backend

API Express + TypeScript, PostgreSQL (Neon) y Drizzle ORM para un catálogo botánico de Valencia.
Guarda plantas con especie, nombres por idioma, coordenadas e identificador; importa inventario
municipal y conserva el enriquecimiento Wikipedia y la identificación Pl@ntNet.

## Fuentes de datos y estado

| Fuente | Uso implementado |
|---|---|
| Valencia Open Data — Arbolado / Arbratge | Importación paginada de plantas: nombres es/ca, coordenadas, distrito/barrio e identificador municipal. |
| Wikipedia | Búsqueda por nombre científico base: idioma explícito es/en o fallback es → en; descripción, extracto y enlace al artículo. El Wikidata ID se toma de esta respuesta, sin consulta independiente a Wikidata. |
| Wikimedia Commons / archivos de Wikipedia | Foto del artículo y consulta de autor/licencia; se publica solo cuando se obtienen créditos y condiciones reutilizables reconocidas. |
| Pl@ntNet | Integración existente para identificar fotos; se conserva, pero sus resultados todavía no se guardan como observaciones. |

El mapa consulta nuestro catálogo en PostgreSQL; las APIs externas se usan desde el backend para
importar, enriquecer o identificar. No hay búsqueda general implementada en todos los proveedores.

Pendiente, fuera de esta PR: GBIF para taxonomía/sinónimos; OpenStreetMap/Overpass para contexto
geográfico; BDBCV para biodiversidad regional (acceso automatizado y condiciones por confirmar).
También quedan la persistencia de reconocimientos/observaciones y la sincronización de cambios
del inventario. Son líneas previstas, no integraciones ya disponibles ni fechas comprometidas.

## Preparación

```powershell
npm.cmd install
```

Copia `.env.example` a `.env` y completa `DATABASE_URL` localmente desde **Connect** de Neon.
`PORT` es opcional (3000 por defecto). No publiques `.env`.
En PowerShell usa `npm.cmd` si la política bloquea `npm.ps1`.

## Comprobar la conexión

```powershell
node docs/check-db.mjs
```

Carga `.env` y ejecuta `SELECT 1 AS ok, current_database() AS database`. No requiere servidor ni
tablas y no modifica datos. Devuelve la base conectada; ante fallo termina con código 1 y un
mensaje sin credenciales. Tiempo de espera máximo: 20 segundos.

## Modelo y migración actual

El catálogo tiene **cuatro tablas**, además de `users`:

| Tabla | Contenido |
|---|---|
| `species` | Identidad interna y nombre científico base por fuente. |
| `plant_locations` | Planta, coordenadas, especie, nombre original y referencia municipal. |
| `plant_names` | Nombres comunes por ejemplar e idioma. |
| `species_enrichments` | Texto Wikipedia, Wikidata ID, idioma, enlace y foto opcional con créditos. |

El esquema está en `src/db/schema.ts`. La [guía del modelo](docs/data-model.md) explica relaciones,
normalización, límites y organización del código.

Solo hay una migración inicial: `0000_plant_catalog.sql`, generada desde el esquema actual.
El reinicio de la base de desarrollo ya se completó. Para una instalación nueva usa una base vacía;
los siguientes cambios de esquema se aplican mediante migraciones incrementales.

Detén el servidor con `Ctrl+C`. Desde la raíz:

```powershell
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run db:migrate
npm.cmd run dev
```

`db:migrate` aplica solo migraciones pendientes a la base indicada por `DATABASE_URL`.
Repetirlo sin cambios pendientes no borra datos. Arrancar el servidor no crea tablas ni importa datos.

## Recargar inventario y Wikipedia

Con el servidor arrancado, en otra terminal:

```powershell
curl.exe -X POST "http://localhost:3000/trees/import?limit=20&offset=0"
curl.exe -X POST "http://localhost:3000/species/enrich?limit=20"
Invoke-RestMethod "http://localhost:3000/trees?limit=20&lang=es"
Invoke-RestMethod "http://localhost:3000/species?lang=es"
```

| Endpoint | Función |
|---|---|
| `GET /health` | Comprueba HTTP; no consulta la base. |
| `POST /trees/import?limit=20&offset=0` | Importa una página (1–200 registros), sin duplicar plantas existentes. |
| `GET /trees?limit=20&offset=0&lang=es` | Lista ligera para el mapa: nombres, especie, coordenadas e IDs. |
| `GET /trees/:id?lang=ca` | Ficha con nombres disponibles, procedencia y especie enriquecida. |
| `POST /species/enrich?limit=20` | Wikipedia para especies pendientes; admite `lang=es`/`lang=en` y `afterId`. Sin `lang`, conserva el fallback es → en. |
| `GET /species?lang=es` | Nombres distintos por especie y enriquecimiento disponible. |
| `POST /plants/identify` | Integración Pl@ntNet existente; ver su guía. |

Importación: `stored` cuenta plantas nuevas, `excluded` posiciones `Falta`, `skipped` plantas ya
guardadas y `failed` registros inválidos.
Una página con errores puede guardar otras filas y devolver `status: failed` aunque el HTTP sea 200.
`nextOffset` indica la siguiente página y `null` el final. Repetir conserva los datos existentes;
no sincroniza cambios municipales. El ID interno es independiente del identificador municipal.

Enriquecimiento: devuelve `totalSpecies`, `alreadyStored`, `enriched`, `notFound`, `failed`,
`nextAfterId`. Sin `lang`, omite especies con cualquier enriquecimiento Wikipedia y usa es → en
como fallback. Con `lang=es` o `lang=en`, busca solo esa edición y omite únicamente especies que
ya tienen ese idioma. `alreadyStored` cuenta las completadas para ese modo; `language` indica
el idioma solicitado cuando es explícito. Una edición inexistente cuenta como `notFound`, sin
guardar otro idioma en su lugar. Repetir no duplica ni sobrescribe los textos existentes.

Para añadir inglés aunque ya exista español:

```bash
curl -X POST "http://localhost:3000/species/enrich?lang=en&limit=20"
```

Si `nextAfterId` no es `null`, continúa con `afterId` y el mismo `lang`. Para leer inglés, usa
`GET /species?lang=en` o `GET /trees/:id?lang=en`; si falta, la lectura conserva su fallback de
idioma. Se descargan artículos originales de Wikipedia: no se traducen automáticamente textos.
No se necesita migración; cada idioma ocupa una fila de `species_enrichments`.

Los campos anteriores `description`, `culturalExtract`, `wikipediaUrl`, `wikipediaLang`,
`wikidataId`, `imageUrl` siguen disponibles. `culturalExtract` es un alias del extracto enciclopédico.
`enrichment` contiene texto y fuente; `image`, foto y créditos. Sin créditos reconocidos, `imageUrl`
es `null`; un fallo de imagen no descarta el texto.

Pl@ntNet y la página `/probar` se conservan. El reconocimiento todavía no se guarda como
observación. Consulta [la guía de identificación](docs/identificacion-plantas.md).

## Desarrollo y comandos

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run test:catalog
```

El build comprueba TypeScript y compila a `dist/`. Las pruebas ejecutan todas las migraciones,
SQL y HTTP con PGlite y servicios ficticios; no cargan `.env`, no usan Neon ni prueban disponibilidad
de APIs externas. No hay linter ni comando `npm test`.

| Comando | Efecto |
|---|---|
| `node docs/check-db.mjs` | SELECT de conexión, sin cambios. |
| `npm.cmd run db:generate -- --name=nombre_del_cambio` | Genera SQL y snapshot locales desde el esquema; no modifica Neon. |
| `npm.cmd run db:migrate` | Aplica SQL pendiente a la base configurada. |
| `npm.cmd run db:studio` | Abre Drizzle Studio. |
| `npm.cmd run db:push` | Solo prototipado; no usar para este cambio versionado. |

Principio: cambiar esquema → generar/revisar migración → comprobar localmente → aplicar → cargar datos.
SQL y `drizzle/meta/` se versionan juntos.
