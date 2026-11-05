# UT 924 — Procedencia de plantas y contenidos

RF23, RNF6. Rama `feat/ut-924-source-provenance`, independiente desde `main`.

## Datos guardados

| Contenido | Entidad responsable | Fecha o versión | Enlace y asociación |
|---|---|---|---|
| Ejemplar y sus nombres | Ajuntament de València, identificado por `VALENCIA_ARBOLADO` en el adaptador | `plant_locations.imported_at` | `source_url` por ejemplar; `species_id` lo asocia a su especie. |
| Texto Wikipedia | Wikimedia Foundation como entidad operadora; autoría en el historial del artículo | `species_enrichments.fetched_at` | `source_url` por especie e idioma; licencia conservada. |
| Foto Commons | Wikimedia Foundation como entidad operadora; fotógrafo en los créditos | `species_enrichments.fetched_at`, consulta de los créditos | `image_source_url`; autor, licencia y atribución conservados. |
| Referencia editorial | `provider` en el JSON; las referencias antiguas se reconocen por el dominio exacto | `date` + `dateType`, o `version` | `species_profiles.sources`, asociado a especie e idioma. |

Wikipedia y Commons son operados por [Wikimedia Foundation](https://www.wikimedia.org/). La entidad no sustituye la autoría ni las licencias.

No se crean tablas ni se cambia el esquema. El seed guarda los metadatos normalizados en el JSON existente. Los GET también interpretan las referencias antiguas con «Consulta 25/10/2026», sin reescribirlas. No se ha ejecutado el seed contra la base compartida.

## Contrato API aditivo

`GET /trees`, `/trees/:id`, `/species`, `/species/:id` incluyen `provenance: SourceReference[]`. Las ubicaciones de la ficha incluyen también `importedAt` y su propia `provenance`.

```json
{
  "name": "Arbolado — Arbratge",
  "provider": "Ajuntament de València",
  "url": "https://opendata.vlci.valencia.es/es/dataset/arbratge-arbolado",
  "date": "2026-10-31T18:43:15.147Z",
  "dateType": "imported",
  "version": null,
  "scope": "inventory",
  "description": "Fuente de los datos: Ajuntament de València – Dades Obertes. Campos normalizados por Nature MAPS."
}
```

`dateType`: `imported` (importación), `retrieved` (recuperación de texto/créditos), `consulted` (consulta editorial), o `null`. `scope`: `inventory`, `editorial`, `image`. Se usa ISO 8601. No se inventa una fecha de publicación, revisión o versión. Los campos desconocidos son `null`.

Un ejemplar conserva su enlace individual. La fuente de inventario de una especie enlaza al conjunto de datos y lleva la última fecha de importación de sus ejemplares, calculada sobre todos ellos, sin depender de la página de ubicaciones. Las especies sin texto también conservan la fuente de su inventario; las del seed sin ubicaciones tienen sus referencias editoriales. Pl@ntNet sigue siendo una identificación efímera con atribución propia, sin nuevas tablas de observaciones.

## Comprobaciones

`npm run build` y `npm run test:catalog`. La suite usa PostgreSQL aislado (PGlite), comprueba el SQL real, los GET y el seed repetido, las referencias antiguas y las fechas inválidas. No consume cuota de Pl@ntNet ni escribe en Neon.

Auditoría SELECT inicial (05/11/2026): 67 538 ejemplares, ninguno sin código de fuente, enlace o fecha de importación; 265 especies, ninguna sin inventario, enriquecimiento o referencias editoriales; 6 perfiles y 18 referencias editoriales. La comprobación HTTP posterior usa únicamente GET.
