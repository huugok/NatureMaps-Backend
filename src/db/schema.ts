import { sql } from 'drizzle-orm'
import { check, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Fuente externa de datos: quién la publica, con qué licencia y cuándo se descargó por última vez.
// `code` es el mismo valor que guardan species.source y plant_locations.source (texto, sin clave
// foránea porque esas columnas ya existen como texto libre). Una fila por fuente, no por descarga.
export const dataSources = pgTable('data_sources', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  license: text('license').notNull(),
  licenseUrl: text('license_url').notNull(),
  attribution: text('attribution').notNull(),
  logoUrl: text('logo_url'),
  lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('data_sources_code_unique').on(table.code),
  check('data_sources_text_check', sql`length(trim(${table.code})) > 0 and length(trim(${table.provider})) > 0 and length(trim(${table.name})) > 0 and length(trim(${table.url})) > 0 and length(trim(${table.license})) > 0 and length(trim(${table.licenseUrl})) > 0 and length(trim(${table.attribution})) > 0`),
])

// Names are matched within one source, not assumed to be global taxonomic IDs.
export const species = pgTable('species', {
  id: serial('id').primaryKey(),
  scientificName: text('scientific_name').notNull(),
  source: text('source').notNull(),
}, (table) => [
  uniqueIndex('species_source_name_unique').on(table.source, table.scientificName),
  check('species_name_check', sql`length(trim(${table.scientificName})) > 0 and length(trim(${table.source})) > 0`),
])

export const plantLocations = pgTable('plant_locations', {
  id: serial('id').primaryKey(),
  speciesId: integer('species_id').references(() => species.id, { onDelete: 'restrict' }),
  reportedScientificName: text('reported_scientific_name'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  district: text('district'),
  neighborhood: text('neighborhood'),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('plant_locations_source_external_unique').on(table.source, table.externalId),
  index('plant_locations_species_idx').on(table.speciesId),
  index('plant_locations_coordinates_idx').on(table.latitude, table.longitude),
  check('plant_locations_latitude_check', sql`${table.latitude} between -90 and 90`),
  check('plant_locations_longitude_check', sql`${table.longitude} between -180 and 180`),
  check('plant_locations_source_check', sql`length(trim(${table.source})) > 0 and length(trim(${table.externalId})) > 0 and length(trim(${table.sourceUrl})) > 0`),
])

// Names belong to the particular inventory entry: macho/hembra must not be mixed.
// The source is inherited from plant_locations; no duplicate source metadata.
export const plantNames = pgTable('plant_names', {
  id: serial('id').primaryKey(),
  plantLocationId: integer('plant_location_id').notNull().references(() => plantLocations.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  name: text('name').notNull(),
}, (table) => [
  uniqueIndex('plant_names_location_language_unique').on(table.plantLocationId, table.language),
  check('plant_names_nonempty_check', sql`length(trim(${table.name})) > 0 and length(trim(${table.language})) > 0`),
])

// One enrichment per species/provider/language. Keep text and photo credits here.
export const speciesEnrichments = pgTable('species_enrichments', {
  id: serial('id').primaryKey(),
  speciesId: integer('species_id').notNull().references(() => species.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('WIKIPEDIA'),
  language: text('language').notNull(),
  sourceUrl: text('source_url').notNull(),
  wikidataId: text('wikidata_id'),
  description: text('description'),
  extract: text('extract'),
  license: text('license'),
  licenseUrl: text('license_url'),
  imageUrl: text('image_url'),
  imageSourceUrl: text('image_source_url'),
  imageAuthor: text('image_author'),
  imageLicense: text('image_license'),
  imageLicenseUrl: text('image_license_url'),
  imageAttribution: text('image_attribution'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('species_enrichments_species_source_language_unique').on(table.speciesId, table.source, table.language),
  check('species_enrichments_text_check', sql`coalesce(length(trim(${table.extract})), 0) > 0 or coalesce(length(trim(${table.description})), 0) > 0`),
  check('species_enrichments_source_check', sql`length(trim(${table.source})) > 0 and length(trim(${table.language})) > 0 and length(trim(${table.sourceUrl})) > 0`),
  check('species_enrichments_image_check', sql`${table.imageUrl} is null or (${table.imageSourceUrl} is not null and ${table.imageAuthor} is not null and ${table.imageLicense} is not null and ${table.imageLicenseUrl} is not null and ${table.imageAttribution} is not null)`),
])

// Curated editorial ficha content, one row per species and language. It is
// written by the team (seed), not fetched: species_enrichments stays the
// Wikipedia-only table, with its own semantics and image credit checks.
// `family` is Latin and language-neutral, but it lives on the same row because
// it is seeded and read together with the localized editorial text.
// Photos never live here: they come from species_enrichments with credits.
export const speciesProfiles = pgTable('species_profiles', {
  id: serial('id').primaryKey(),
  speciesId: integer('species_id').notNull().references(() => species.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  description: text('description'),
  family: text('family'),
  flowering: text('flowering'),
  curiosity: text('curiosity'),
  sources: jsonb('sources'),
}, (table) => [
  uniqueIndex('species_profiles_species_language_unique').on(table.speciesId, table.language),
  check('species_profiles_text_check', sql`coalesce(length(trim(${table.description})), 0) > 0 or coalesce(length(trim(${table.curiosity})), 0) > 0`),
  check('species_profiles_sources_check', sql`${table.sources} is null or jsonb_typeof(${table.sources}) = 'array'`),
  check('species_profiles_language_check', sql`length(trim(${table.language})) > 0`),
])

// Puntos de interés histórico-culturales del mapa (NM-06, PA 2859-2861). Una
// fila por elemento del geoportal municipal; la descripción y la imagen se
// enriquecen desde Wikidata/Wikimedia con sus créditos, como en species_enrichments.
// `source` repite el patrón de plant_locations (código de data_sources, sin FK).
export const pois = pgTable('pois', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  // Clasificación propia del POI ('monumento', 'recurso-turistico'), no el valor bruto de la fuente.
  category: text('category').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  imageSourceUrl: text('image_source_url'),
  imageAuthor: text('image_author'),
  imageLicense: text('image_license'),
  imageLicenseUrl: text('image_license_url'),
  imageAttribution: text('image_attribution'),
  // Dirección corta si la fuente la trae; el mapa siempre tiene las coordenadas.
  address: text('address'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  sourceUrl: text('source_url').notNull(),
  // Documento oficial de la fuente (fichas de patrimonio en PDF) y ficha Wikidata.
  infoUrl: text('info_url'),
  wikidataId: text('wikidata_id'),
  wikipediaUrl: text('wikipedia_url'),
  enrichedAt: timestamp('enriched_at', { withTimezone: true }),
  importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('pois_source_external_unique').on(table.source, table.externalId),
  index('pois_coordinates_idx').on(table.latitude, table.longitude),
  check('pois_latitude_check', sql`${table.latitude} between -90 and 90`),
  check('pois_longitude_check', sql`${table.longitude} between -180 and 180`),
  check('pois_text_check', sql`length(trim(${table.source})) > 0 and length(trim(${table.externalId})) > 0 and length(trim(${table.name})) > 0 and length(trim(${table.category})) > 0 and length(trim(${table.sourceUrl})) > 0`),
  check('pois_image_check', sql`${table.imageUrl} is null or (${table.imageSourceUrl} is not null and ${table.imageAuthor} is not null and ${table.imageLicense} is not null and ${table.imageLicenseUrl} is not null and ${table.imageAttribution} is not null)`),
])

// Contenido curado de la ficha del POI (NM-06), una fila por POI e idioma. Se
// siembra desde Wikipedia con títulos elegidos a mano (seedPoiProfiles), no se
// adivina por nombre: un monumento con la descripción de otro sería peor que no
// tener descripción. NM-09 sustituirá estos textos por contenido editorial propio.
// La foto no vive aquí: va en `pois` con sus créditos verificados.
export const poiProfiles = pgTable('poi_profiles', {
  id: serial('id').primaryKey(),
  poiId: integer('poi_id').notNull().references(() => pois.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  description: text('description').notNull(),
  source: text('source').notNull().default('WIKIPEDIA'),
  sourceUrl: text('source_url').notNull(),
  license: text('license'),
  licenseUrl: text('license_url'),
}, (table) => [
  uniqueIndex('poi_profiles_poi_language_unique').on(table.poiId, table.language),
  check('poi_profiles_text_check', sql`length(trim(${table.description})) > 0 and length(trim(${table.language})) > 0 and length(trim(${table.sourceUrl})) > 0`),
])
