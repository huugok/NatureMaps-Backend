# Nature MAPS — Backend

Backend del proyecto **Nature MAPS** (también referido como *Flower MAP* en la documentación de
diseño), una guía botánica turística multilingüe centrada en la ciudad de Valencia.

La aplicación combina datos abiertos oficiales (arbolado municipal, biodiversidad, parques y
jardines), reconocimiento de plantas mediante IA a través de una API externa, contenido cultural
propio y observaciones aportadas por los usuarios, para responder no solo a "¿qué planta es esta?"
sino también a "¿qué hay interesante que ver cerca y por qué es relevante para Valencia?".

## Índice

- [Descripción del proyecto](#descripción-del-proyecto)
- [Arquitectura y repositorios](#arquitectura-y-repositorios)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Base de datos](#base-de-datos)
- [Fuentes de datos abiertos](#fuentes-de-datos-abiertos)
- [Documentación adicional](#documentación-adicional)

## Descripción del proyecto

Valencia cuenta con unos 419 000 árboles (aproximadamente 148 000 gestionados directamente por el
Ayuntamiento) y un Jardín Botánico con cerca de 5 000 especies, además de un inventario de arbolado
publicado como datos abiertos. Nature MAPS aprovecha esta infraestructura de datos para ofrecer una
experiencia turística que combina:

- plantas cercanas a la ubicación del usuario;
- identificación de especies a partir de una foto;
- ficha de planta (nombre, foto, descripción botánica, datos de interés);
- búsqueda de plantas por nombre o criterios;
- visualización en mapa de los lugares donde se encuentra una especie;
- rutas botánicas configurables por tema, duración y longitud;
- estacionalidad (floración, mejor época de visita);
- contexto cultural, histórico y gastronómico de las plantas;
- contenido multilingüe;
- observaciones de usuarios (crowdsourcing) con nivel de confianza del reconocimiento;
- historial, favoritos y descripción en audio (fases posteriores al MVP).

El listado completo de requisitos funcionales y no funcionales está en
[docs/Nature_MAPS_Requisitos.pdf](docs/Nature_MAPS_Requisitos.pdf), y el planteamiento inicial del
producto en [docs/Lluvia_de_ideas.pdf](docs/Lluvia_de_ideas.pdf).

## Arquitectura y repositorios

El proyecto sigue una arquitectura de **monolito**, dividida en dos repositorios independientes para
separar responsabilidades entre Ingeniería de Software y Tecnologías Creativas:

- **Backend** (este repositorio): `github.com/huugok/NatureMaps-Backend`
- **Frontend**: `github.com/huugok/NatureMaps-Frontend`

Este backend actúa como **capa de integración y normalización** sobre varias fuentes de datos
externas (no pretende construir una base botánica completa desde cero). Cada registro importado
debe conservar su procedencia (fuente, identificador original, licencia) antes de incorporarse al
modelo de datos propio de la aplicación.

## Stack tecnológico

- **Node.js** con **TypeScript** (módulos ESM)
- **Express 5** como framework web
- **PostgreSQL** alojado en [Neon](https://neon.tech)
- **Drizzle ORM** (`drizzle-orm/neon-http`) y **Drizzle Kit** para el esquema y las migraciones
- **tsx** para el servidor de desarrollo con recarga en caliente

## Estructura del proyecto

```
src/
  index.ts          Punto de entrada de la aplicación Express (expone GET /health)
  db/
    index.ts          Cliente de Drizzle, conecta mediante DATABASE_URL
    schema.ts          Definición de tablas de Drizzle
  controllers/        Controladores de las rutas (por implementar)
  routes/               Definición de rutas de Express (por implementar)
  middlewares/          Middlewares de Express (por implementar)
  services/              Lógica de negocio e integraciones externas (por implementar)
docs/                    Documentación de planificación del proyecto
```

> El proyecto se encuentra en una fase inicial de scaffolding: los directorios `controllers`,
> `routes`, `middlewares` y `services` solo contienen un `.gitkeep` como marcador.

## Puesta en marcha

### Requisitos previos

- Node.js (versión compatible con TypeScript 7 / `@types/node` v26)
- Una base de datos PostgreSQL (se recomienda [Neon](https://neon.tech))

### Instalación

```bash
npm install
```

### Configuración

Copia el archivo de ejemplo y completa tus propias credenciales:

```bash
cp .env.example .env
```

### Ejecución en desarrollo

```bash
npm run dev
```

El servidor arrancará en el puerto indicado por la variable `PORT` (por defecto `3000`) y podrás
comprobar que está funcionando visitando `GET /health`.

## Variables de entorno

| Variable       | Descripción                                                        |
|----------------|---------------------------------------------------------------------|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (Neon), requiere `sslmode=require`. |
| `PORT`         | Puerto en el que escucha el servidor Express (por defecto `3000`).  |

Las credenciales nunca deben incluirse directamente en el código fuente; el archivo `.env` está
excluido del control de versiones (`.gitignore`).

## Scripts disponibles

| Comando               | Descripción                                                        |
|------------------------|----------------------------------------------------------------------|
| `npm run dev`          | Inicia el servidor de desarrollo con recarga en caliente.            |
| `npm run build`        | Compila el proyecto TypeScript a `dist/`.                            |
| `npm start`             | Ejecuta el servidor ya compilado (`dist/index.js`).                  |
| `npm run db:generate`  | Genera migraciones SQL a partir de `src/db/schema.ts`.               |
| `npm run db:migrate`    | Aplica las migraciones pendientes a la base de datos.                |
| `npm run db:push`       | Sincroniza el esquema directamente con la base de datos (sin migraciones, útil en desarrollo). |
| `npm run db:studio`     | Abre Drizzle Studio para explorar la base de datos.                  |

## Base de datos

La base de datos se aloja en **Neon** (PostgreSQL) y se gestiona mediante **Drizzle ORM**. El
esquema se define en [src/db/schema.ts](src/db/schema.ts) y la configuración de migraciones en
[drizzle.config.ts](drizzle.config.ts).

Flujo de trabajo recomendado al modificar el esquema:

1. Editar las tablas en `src/db/schema.ts`.
2. Ejecutar `npm run db:generate` para crear la migración correspondiente.
3. Ejecutar `npm run db:migrate` para aplicarla.

## Fuentes de datos abiertos

Según [docs/Flower MAP — Data Sources.md](<docs/Flower MAP — Data Sources.md>), las fuentes
principales previstas para el MVP son:

1. **Datos Abiertos del Ayuntamiento de València** — inventario de arbolado, arbolado protegido,
   jardines y espacios verdes (GeoJSON/JSON/KMZ, licencia CC BY 4.0).
2. **GBIF** (Global Biodiversity Information Facility) — taxonomía y registros de biodiversidad.
3. **OpenStreetMap** (Overpass API) — red peatonal, parques y puntos de interés cultural para la
   generación de rutas.
4. **BDBCV** (Banco de Datos de Biodiversidad de la Comunitat Valenciana) — observaciones de
   biodiversidad regional.

Como fuentes de enriquecimiento para fases posteriores: **Wikidata**, **Wikimedia Commons**, la
**Generalitat Valenciana / IDEV** y **AEMET** (datos meteorológicos).

Cada fuente debe integrarse conservando su procedencia (fuente, id original, licencia y fecha de
importación) y normalizarse hacia el modelo de datos propio de Nature MAPS (`Species`,
`PlantLocation`, `Observation`, `BotanicalPOI`), evitando duplicados entre fuentes distintas que
puedan describir el mismo árbol o planta.

## Documentación adicional

- [docs/Nature_MAPS_Requisitos.pdf](docs/Nature_MAPS_Requisitos.pdf) — requisitos funcionales y no
  funcionales completos.
- [docs/Lluvia_de_ideas.pdf](docs/Lluvia_de_ideas.pdf) — presentación del proyecto e historias de
  usuario.
- [docs/Flower MAP — Data Sources.md](<docs/Flower MAP — Data Sources.md>) — fuentes de datos
  abiertos y modelo de datos propuesto.
- [docs/preparacion-entorno-desarrollo.pdf](docs/preparacion-entorno-desarrollo.pdf) — notas sobre
  la preparación del entorno de desarrollo (repositorios, base de datos, control de versiones).
