# Flower MAP — Open Data Sources

## 1. Purpose

Flower MAP is a multilingual botanical tourism application focused on Valencia.

The application should combine several types of external data:

- locations of trees and plants;
- botanical species information;
- biodiversity observations;
- parks and green areas;
- pedestrian map data;
- cultural and historical information;
- climate and seasonal information;
- openly licensed plant images.

The application should not depend on a single data provider. Data from several sources should be normalized and stored in the Flower MAP database.

---

# 2. Primary Data Sources

## 2.1 Valencia Open Data — Ajuntament de València

**System:** Portal de Datos Abiertos del Ayuntamiento de València / VLCi Open Data

**Priority:** HIGH

This should be one of the main sources for the initial Flower MAP dataset.

### Relevant datasets

#### Arbolado / Arbratge — Tree Inventory

Official municipal tree inventory for Valencia.

Possible uses:

- initial tree locations;
- geographic coordinates;
- species information;
- creation of botanical Points of Interest;
- displaying known trees on the map;
- generating routes through areas with interesting vegetation.

Available formats include:

- GeoJSON
- JSON
- KMZ
- SHP
- ArcGIS MapServer

The dataset is published under **CC BY 4.0**.

#### Arbolado Protegido Municipal

Municipal inventory of protected trees.

Possible uses:

- special botanical POIs;
- historical or monumental tree routes;
- culturally important trees;
- high-priority tourist content.

#### Jardines y Espacios Verdes

Information about parks, gardens and other green spaces in Valencia.

Possible uses:

- park locations;
- grouping plants by park;
- route generation;
- botanical tourism destinations.

### Flower MAP role

Valencia Open Data should provide the **official municipal geographic layer**.

Example:

```text
Tree
  species
  coordinates
  municipality data
       |
       v
Flower MAP Plant Location
```

---

# 2.2 Banco de Datos de Biodiversidad de la Comunitat Valenciana — BDBCV

**System:** Banco de Datos de Biodiversidad de la Comunitat Valenciana

**Organization:** Generalitat Valenciana

**Priority:** HIGH

BDBCV contains biodiversity records for the Valencian Community.

It is particularly relevant because it already works with geographically referenced observations of species.

Users and researchers can submit biodiversity observations, including observations with GPS coordinates.

### Possible uses

- occurrence records for plant species;
- regional flora information;
- validation of whether a species occurs in the Valencia region;
- comparison with Flower MAP user observations;
- information about native and wild species;
- identification of biodiversity-rich locations.

### Important architectural similarity

The BDBCV observation model is conceptually similar to the planned Flower MAP crowdsourcing model:

```text
User
  |
  v
Plant observation
  |
  +-- Species
  +-- GPS coordinates
  +-- Date
  +-- Observation information
```

Flower MAP can implement a similar observation model while keeping its own application database.

---

# 2.3 Generalitat Valenciana Open Data / IDEV

**Systems:**

- Dades Obertes Generalitat Valenciana
- Infraestructura de Datos Espaciales Valenciana — IDEV

**Priority:** MEDIUM-HIGH

These systems provide regional environmental and geographic datasets.

### Relevant datasets

Examples include:

- Microrreservas de Flora de la Comunitat Valenciana
- Habitats 1:10,000
- Habitats 1:50,000
- protected natural areas
- biodiversity-related geographic layers

Common formats include:

- WMS
- WFS
- CSV
- GeoPackage

### Possible uses

- natural habitat information;
- protected flora areas;
- routes outside the city centre;
- ecological context;
- distinguishing urban ornamental vegetation from natural Valencian flora.

---

# 2.4 GBIF — Global Biodiversity Information Facility

**System:** GBIF

**Priority:** HIGH

GBIF is a global infrastructure containing biodiversity occurrence records from museums, herbaria, research institutions, citizen-science systems and other publishers.

GBIF provides REST APIs for searching occurrence records.

### Possible uses

- species occurrence records;
- geographic coordinates;
- scientific names;
- taxonomy;
- observation dates;
- source institution;
- links to media;
- validation of species distribution.

### Important APIs

Use:

- GBIF Species API for taxonomy;
- GBIF Occurrence API for observations;
- GBIF occurrence downloads for larger datasets.

The Flower MAP backend should use GBIF primarily as an **external biodiversity and taxonomy source**, rather than copying the entire GBIF database.

Example:

```text
Flower MAP species
       |
       v
Scientific name
       |
       v
GBIF taxonomy lookup
       |
       +--> accepted scientific name
       +--> taxonomic classification
       +--> occurrence records
```

Media licensing must be checked per record before using GBIF images.

---

# 2.5 OpenStreetMap

**System:** OpenStreetMap

**API:** Overpass API

**Priority:** HIGH

OpenStreetMap should provide the geographic context needed for walking routes.

Overpass API allows querying selected OpenStreetMap objects by:

- geographic area;
- object type;
- tags;
- proximity.

### Relevant map objects

Possible OSM objects include:

```text
parks
gardens
botanical gardens
pedestrian streets
footways
paths
squares
viewpoints
museums
monuments
tourist attractions
```

### Possible uses

- map background;
- pedestrian network;
- botanical route generation;
- finding parks and gardens;
- finding cultural POIs near plants;
- connecting botanical and cultural locations.

Important:

**Overpass API is a data query API, not a routing engine.**

A separate routing engine or service may be required for optimal walking-route calculation.

---

# 2.6 Wikidata

**System:** Wikidata

**API:** Wikidata Query Service

**Technology:** SPARQL

**Priority:** MEDIUM-HIGH

Wikidata can provide structured information that connects botanical entities with multilingual and cultural information.

### Possible uses

For a plant species:

- scientific name;
- common names;
- names in multiple languages;
- taxonomic family;
- geographic origin;
- links to related entities;
- links to Wikimedia Commons images.

Example:

```text
Jacaranda mimosifolia
        |
        +--> scientific name
        +--> family
        +--> native region
        +--> Spanish label
        +--> English label
        +--> Valencian label
        +--> image references
```

Wikidata should primarily be used as a **structured enrichment source**.

Flower MAP should not assume that every Wikidata statement is botanically complete or sufficient by itself.

---

# 2.7 Wikimedia Commons

**System:** Wikimedia Commons

**Priority:** MEDIUM

Wikimedia Commons can provide openly licensed images of plants, botanical gardens, parks and cultural objects.

### Possible uses

- default plant images;
- images for botanical descriptions;
- images of landmarks included in routes;
- historical images.

Important:

Image licenses must be checked individually.

The Flower MAP database should store image attribution information together with the image reference.

Example:

```text
image_url
source
author
license
attribution_text
```

---

# 2.8 AEMET OpenData

**System:** AEMET OpenData

**Organization:** Agencia Estatal de Meteorología

**Priority:** MEDIUM

AEMET provides meteorological and climatological information through a REST API.

An API key is required.

### Possible uses

- temperature;
- rainfall;
- climate information;
- seasonal context;
- current weather;
- weather-aware route recommendations.

Example feature:

```text
"It is September and this species normally flowers in late summer.
Current conditions in Valencia are warm and dry."
```

Weather data should be treated separately from botanical seasonality data.

---

# 3. Recommended MVP Data Sources

The first Flower MAP prototype should avoid integrating every possible external source.

Recommended MVP:

```text
1. Valencia Open Data
       |
       +--> trees
       +--> protected trees
       +--> parks and green areas

2. GBIF
       |
       +--> taxonomy
       +--> biodiversity observations

3. OpenStreetMap
       |
       +--> map
       +--> parks
       +--> paths
       +--> cultural POIs

4. BDBCV
       |
       +--> Valencian biodiversity
       +--> regional occurrence information
```

These four systems are sufficient for a meaningful first version.

Additional sources can be added later:

```text
Wikidata
Wikimedia Commons
Generalitat Valenciana / IDEV
AEMET
```

---

# 4. Proposed Flower MAP Data Model

External records should not be used directly as the application's internal data model.

Data should be normalized into Flower MAP entities.

## Species

Represents a botanical species.

Example fields:

```text
id
scientific_name
common_name_es
common_name_ca
common_name_en
family
description
origin
flowering_period
cultural_information
gbif_taxon_id
wikidata_id
```

---

## PlantLocation

Represents a known location where a plant or tree exists.

Example fields:

```text
id
species_id
latitude
longitude
source
source_record_id
location_type
verified
```

Possible sources:

```text
VALENCIA_OPEN_DATA
BDBCV
GBIF
FLOWER_MAP
```

---

## Observation

Represents a user observation.

Example fields:

```text
id
species_id
user_id
latitude
longitude
photo
observed_at
recognition_confidence
verification_status
```

An observation is different from a species.

One species may have many observations:

```text
Species
Jacaranda mimosifolia
       |
       +-- Observation 1
       +-- Observation 2
       +-- Observation 3
       +-- Observation 4
```

---

## BotanicalPOI

Represents a location worth visiting.

Examples:

- protected tree;
- unusual tree;
- flowering location;
- botanical garden;
- historical garden;
- plant-related cultural location.

Example fields:

```text
id
name
species_id
latitude
longitude
poi_type
description
cultural_context
tourist_interest_score
```

---

# 5. Data Source Strategy

Flower MAP should distinguish between three categories of data.

## A. Authoritative data

Examples:

```text
Valencia Open Data
Generalitat Valenciana
BDBCV
```

Use for:

- official locations;
- protected trees;
- parks;
- habitats;
- regional biodiversity.

---

## B. Scientific and community biodiversity data

Examples:

```text
GBIF
Flower MAP user observations
```

Use for:

- species occurrences;
- distribution;
- observations;
- supporting evidence for plant locations.

---

## C. Enrichment data

Examples:

```text
Wikidata
Wikimedia Commons
AEMET
```

Use for:

- multilingual names;
- images;
- cultural connections;
- climate;
- additional descriptive context.

---

# 6. Data Provenance

Every imported record should preserve its source.

Do not merge external records without provenance.

Recommended fields:

```text
source
source_record_id
source_url
imported_at
last_updated_at
license
```

This makes it possible to:

- update datasets later;
- detect duplicates;
- attribute external sources;
- remove incorrect records;
- distinguish official data from user observations.

---

# 7. Duplicate Detection

Several sources may describe the same plant or location.

For example:

```text
Valencia Open Data
        +
GBIF observation
        +
Flower MAP user photo
        |
        v
possibly the same physical tree
```

The system should therefore not automatically create a new permanent map object for every observation.

Possible duplicate detection criteria:

```text
same or compatible species
+
small geographic distance
+
similar location
+
observation date
```

User observations should initially remain observations rather than automatically becoming authoritative plant locations.

---

# 8. Suggested Data Flow

```text
                     Valencia Open Data
                            |
BDBCV --------------------- |
                            |
GBIF ---------------------- | ---> Data ingestion
                            |           |
IDEV ---------------------- |           v
                                    Normalization
                                         |
                                         v
                                 Flower MAP Database
                                         |
                  +----------------------+-------------------+
                  |                      |                   |
                  v                      v                   v
              Species              Plant Locations      Botanical POIs
                  |                      |                   |
                  +----------------------+-------------------+
                                         |
                                         v
                                  Flower MAP API
                                         |
                   +---------------------+------------------+
                   |                     |                  |
                   v                     v                  v
                 Map              Plant Search          Routes
```

User-generated data follows a separate flow:

```text
User photo
    |
    v
Plant recognition
    |
    v
Species candidate
    |
    +-- confidence score
    |
    v
GPS location
    |
    v
User Observation
    |
    v
Validation / duplicate detection
    |
    v
Map
```

---

# 9. Implementation Principle

Flower MAP should **not attempt to build a complete independent botanical database from scratch**.

Instead, it should act as an integration layer:

```text
OPEN DATA
    +
BIODIVERSITY DATA
    +
MAP DATA
    +
USER OBSERVATIONS
    +
AI
    +
CULTURAL CONTENT
    |
    v
FLOWER MAP
```

The value of Flower MAP is not merely identifying a plant.

Its main value is answering questions such as:

- What interesting plants are near me?
- What is this plant?
- Where else can I see it?
- What is worth seeing today or this season?
- Can you build me a botanical walking route?
- Why is this plant interesting in the context of Valencia?
- Can you explain it in my language?