# Curaduría de fichas de POI

Criterio de aceptación y flujo de revisión para llenar la ficha de los POIs histórico-culturales
(NM-06) con descripción e imagen. Hoy la ficha completa existe para **13 de 347** POIs: son los que
tienen entrada en `CURATED_POIS` (`src/services/poiProfiles.ts`) y pasan por `npm run db:seed:pois`.
El resto muestra «Descripción no disponible». NM-09 es la UT que amplía esa lista; este documento es su
criterio, no la sustituye.

## 1. Qué se cura

Se cura primero lo que un visitante busca por su nombre:

1. **`monumento`** (225 POIs): bienes con nombre propio reconocible (Torres de Serrans, Llotja…).
2. **`recurso-turistico`** (122 POIs) después, porque sus nombres del geoportal traen prefijo de ruta
   (`10-MUSEO DE BELLAS ARTES`). Antes de curarlos hay que limpiar ese prefijo en el import
   (`displayName`), no en la lista curada.

Orden dentro de cada categoría: primero lo que ya está en el centro histórico y aparece en la primera
pantalla del mapa, porque es donde se nota la ficha vacía.

## 2. Criterio de título

El título de Wikipedia se elige **a mano** y se escribe tal cual en `CURATED_POIS`:

- Artículo de la Wikipedia en `es` (idioma por defecto).
- Si en `es` no existe o es una **desambiguación**, se usa el artículo en `ca` con prefijo `ca:`.
  Caso real ya en la lista:
  `{ sourceName: "L'ALMOINA. CENTRE ARQUEOLÒGIC", wikipedia: "ca:Centre Arqueològic de l'Almoina" }`.
- Los demás idiomas (`ca`, `en`) **no** se escriben a mano: salen de los `langlinks` del artículo base.
  Si el `langlink` no existe, ese idioma se queda sin perfil y la lectura cae al fallback de idioma.

El emparejamiento con el catálogo es **por nombre exacto** del geoportal, sin mayúsculas ni espacios
sobrantes (`lower(trim(name)) = lower(trim(sourceName))`).

Cuando un POI no tiene artículo (ni en `es` ni en `ca`), la entrada puede ser **solo fotografía**:

```ts
{ sourceName: 'PLAÇA DE LA VIRGEN', image: 'File:Valencia - Plaza de la Virgen.jpg' }
```

Se verifica igual que el resto (licencia reutilizable, autor y atribución); si no pasa, no se guarda
nada y el POI conserva el marcador genérico. Una entrada solo-foto **no** crea descripción: la ficha
seguirá diciendo «Descripción no disponible», que es honesto, y la foto es el contenido curado.

La comprobación de licencia vive en `parseImageCredits` (`src/services/wikimedia.ts`): acepta
`CC BY`/`CC BY-SA` 1–4 y dominio público (`zero`/`mark` 1.0), incluidas las versiones portadas por
jurisdicción (`…/licenses/by-sa/3.0/es/`) y las URLs con `deed.<idioma>`, que son la misma licencia.
`by-nc`, `by-nd` y cualquier licencia sin autor o sin atribución quedan fuera.

Un mismo `sourceName` puede emparejar con **varios** `id` (el geoportal repite denominaciones reales
con `externalId` distinto): la siembra se aplica a todos, no solo al primero. No se debe deduplicar
por nombre.

## 3. Prohibido

- **Emparejar por parecido de nombre.** Ya se intentó y produjo casos falsos: `Palau de Montornés`
  acabó apuntando a `Montornès del Vallès` (otro municipio). Una descripción de otro monumento es peor
  que no tener descripción.
- **Escribir texto a mano sin fuente.** La descripción es un extracto de Wikipedia con su licencia y
  atribución; el contenido editorial propio es de NM-09, no de la seed.
- **Guardar una imagen sin licencia verificable.** La seed descarta la foto si `LicenseShortName` no es
  reutilizable o si falta la atribución; el POI se queda con `imageUrl = null` y eso es correcto
  (caso real: la Llotja, cuya foto de Commons es CC BY-NC).
- **Deduplicar POIs por nombre.** La fuente trae 8 denominaciones repetidas con `externalId` distinto
  (p. ej. `Església de la Mare de Déu del Carme (pares Carmelites)` dos veces). Son dos puntos con el
  mismo nombre, no un registro duplicado: fusionarlos borraría un bien real.

## 4. Revisión

Quien abre el PR de curación comprueba, para cada nombre añadido:

1. **Nombre oficial** del geoportal = `sourceName` (copiado, no reescrito).
2. **Categoría** coherente (`monumento` antes que `recurso-turistico`).
3. **Título de Wikipedia** correcto y sin desambiguación; si es en `ca`, con prefijo `ca:`.
4. **Foto con crédito** cuando la haya: autor, licencia y enlace verificables en Commons.

Y valida el lote con la herramienta de revisión:

```bash
npm run db:seed:pois -- --dry-run
```

Imprime `sourceName | ¿encontrado? | wikipedia | idiomas ya sembrados` y termina con
`Encontrados: N/M`; sale con código 1 si algún nombre no empareja. No descarga nada ni escribe en la
base. Después, la ejecución real (`npm run db:seed:pois`) debe terminar con `Sin coincidencia:` y
`Fallos de descarga:` vacíos.

## 5. Ritmo

- Lotes de **10–15 POIs por PR**, con la lista de `sourceName` añadidos en el cuerpo del PR.
- Una PR = una revisión = una ejecución de la seed; no se mezcla curación con cambios de esquema.
- Si un nombre no empareja, se corrige el `sourceName` (o se documenta que el bien no está en el
  geoportal), no se relaja la comparación.

## Preguntas abiertas

Para el dueño del producto, cada una con una recomendación:

1. **¿Se curan los `recurso-turistico` con su prefijo de ruta?** Recomendación: sí, pero limpiando el
   prefijo `N-` en `displayName` durante el import, no en la lista curada.
2. **¿Se aceptan fotos de `visitvalencia.com` o solo Wikimedia con licencia verificable?**
   Recomendación: solo Wikimedia con créditos verificables, como hoy; el resto exige revisión legal.
3. **¿Quién firma la revisión cuando no hay segunda persona?** Recomendación: el propio PR con la
   checklist de la sección 4 y la salida del `--dry-run` pegada en el cuerpo.
