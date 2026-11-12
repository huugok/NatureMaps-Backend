import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { db } from './index.js'
import type { RouteTheme } from '../services/routeGenerator.js'
import { generateRoute } from '../services/routeGenerator.js'

// Seed del catálogo de rutas predefinidas (`npm run db:seed:routes`): doce
// rutas —cuatro por longitud (corta 1–3 km, media 4–7 km, larga 8+ km), con
// los tres contenidos (botánica, cultural, mixta) y, en cada longitud, una
// ruta recta— calculadas una vez con Valhalla y guardadas tal cual en la
// tabla `routes`. Idempotente: cada ejecución regenera y actualiza la fila por
// nombre, así que repetirla tras mejorar el generador refresca el catálogo.
// Requiere DATABASE_URL y VALHALLA_URL (motor de rutas); no es parte de tests.

type LengthCategoryInternal = 'corta' | 'media' | 'larga'

interface RouteDefinition {
  name: string
  theme: RouteTheme
  lengthCategory: LengthCategoryInternal
  start: { latitude: number, longitude: number }
  targetDistance: number
  description: string
  /** Forma pedida; por defecto, anillo. */
  shape?: 'circular' | 'lineal'
}

// Distancias objetivo centradas en su categoría para que el resultado medido
// por Valhalla quepa con margen (corta 1–3 km, media 4–7 km, larga 8+ km).
const TARGETS: Record<LengthCategoryInternal, number> = { corta: 2000, media: 5500, larga: 9500 }

// Inicios icónicos acordados: casco antiguo (cortas), Jardín del Turia (medias)
// y Ciudad de las Artes y las Ciencias (largas).
const PLAZA_VIRGEN = { latitude: 39.4699, longitude: -0.3763 }
const JARDIN_TURIA = { latitude: 39.4630, longitude: -0.3660 }
const CIUDAD_ARTES = { latitude: 39.4548, longitude: -0.3534 }

const DEFINITIONS: RouteDefinition[] = [
  { name: 'Azahar y sombra del Carmen', theme: 'botanica', lengthCategory: 'corta',
    start: PLAZA_VIRGEN, targetDistance: TARGETS.corta,
    description: 'Un paseo corto por el casco antiguo entre naranjos y árboles veteranos del inventario municipal, alrededor de la Plaza de la Virgen.' },
  { name: 'Monumentos del casco antiguo', theme: 'cultural', lengthCategory: 'corta',
    start: PLAZA_VIRGEN, targetDistance: TARGETS.corta,
    description: 'Los monumentos y recursos turísticos más señalados del centro histórico, en un recorrido corto a pie alrededor de la Plaza de la Virgen.' },
  { name: 'Historia bajo los árboles', theme: 'mixta', lengthCategory: 'corta',
    start: PLAZA_VIRGEN, targetDistance: TARGETS.corta,
    description: 'Plantas del inventario municipal y patrimonio histórico alternados en un recorrido corto por el corazón de Valencia.' },
  { name: 'Verde del Turia', theme: 'botanica', lengthCategory: 'media',
    start: JARDIN_TURIA, targetDistance: TARGETS.media,
    description: 'Un anillo por los jardines del antiguo cauce del Turia entre las especies más representativas de su arbolado.' },
  { name: 'Patrimonio a un paso del río', theme: 'cultural', lengthCategory: 'media',
    start: JARDIN_TURIA, targetDistance: TARGETS.media,
    description: 'Monumentos y recursos turísticos próximos al jardín del Turia, recorridos en un paseo de tarde.' },
  { name: 'Del jardín a la ciudad', theme: 'mixta', lengthCategory: 'media',
    start: JARDIN_TURIA, targetDistance: TARGETS.media,
    description: 'Árboles del Turia y patrimonio histórico en una ruta media que va del jardín al norte de la ciudad.' },
  { name: 'De las Artes a la Malvarrosa', theme: 'botanica', lengthCategory: 'larga',
    start: CIUDAD_ARTES, targetDistance: TARGETS.larga,
    description: 'Un recorrido largo desde la Ciudad de las Artes hasta la fachada marítima entre palmeras, ficus y el arbolado de la playa.' },
  { name: 'Ronda del sureste', theme: 'cultural', lengthCategory: 'larga',
    start: CIUDAD_ARTES, targetDistance: TARGETS.larga,
    description: 'Los hitos histórico-culturales del sureste de la ciudad, del antiguo cauce al mar, en una gran vuelta.' },
  { name: 'Ciencia, mar y vegetación', theme: 'mixta', lengthCategory: 'larga',
    start: CIUDAD_ARTES, targetDistance: TARGETS.larga,
    description: 'La ruta más larga del catálogo: arbolado del eje sureste y patrimonio monumental junto a la Ciudad de las Artes y las Ciencias.' },
  // Rutas rectas: una por longitud. Van en una dirección, sin cerrar el anillo;
  // el tema rota para que cada conjunto tenga su propia variedad.
  { name: 'Del Mercado al Puerto', theme: 'cultural', lengthCategory: 'corta', shape: 'lineal',
    start: PLAZA_VIRGEN, targetDistance: TARGETS.corta,
    description: 'Una tirada recta desde la Plaza de la Virgen hacia el mercado y el puerto, parando en los monumentos y recursos turísticos del recorrido.' },
  { name: 'Ribera del Turia', theme: 'mixta', lengthCategory: 'media', shape: 'lineal',
    start: JARDIN_TURIA, targetDistance: TARGETS.media,
    description: 'Un paseo recto siguiendo el cauce del Turia, con el arbolado de los jardines y los hitos del patrimonio histórico en la misma dirección.' },
  { name: 'Avenida de la Marina', theme: 'botanica', lengthCategory: 'larga', shape: 'lineal',
    start: CIUDAD_ARTES, targetDistance: TARGETS.larga,
    description: 'La ruta recta por la avenida de la Marina hasta el mar, entre el arbolado urbano y las palmeras de la playa.' },
]

async function seedRoutes() {
  // Las 9 rutas se generan de tres en tres: cada una pide muchos tramos a
  // Valhalla y en serie la seed tarda media hora.
  const results: string[] = []
  const queue = [...DEFINITIONS]
  const workers = Array.from({ length: 3 }, async () => {
    for (let definition = queue.shift(); definition; definition = queue.shift()) {
      const generated = await generateRoute({
        start: definition.start,
        targetDistance: definition.targetDistance,
        content: definition.theme,
        ...(definition.shape ? { shape: definition.shape } : {}),
      })
      const values = {
        name: definition.name,
        theme: generated.theme,
        shape: generated.shape,
        lengthCategory: definition.lengthCategory,
        distanceMeters: generated.distanceMeters,
        durationSeconds: generated.durationSeconds,
        startLatitude: definition.start.latitude,
        startLongitude: definition.start.longitude,
        description: definition.description,
        stops: JSON.stringify(generated.stops),
        path: JSON.stringify(generated.path),
      }
      await db.execute(sql`
        insert into routes (name, theme, shape, length_category, distance_meters, duration_seconds,
          start_latitude, start_longitude, description, stops, path)
        values (${values.name}, ${values.theme}, ${values.shape}, ${values.lengthCategory},
          ${values.distanceMeters}, ${values.durationSeconds}, ${values.startLatitude}, ${values.startLongitude},
          ${values.description}, ${values.stops}::jsonb, ${values.path}::jsonb)
        on conflict (name) do update set theme = excluded.theme, shape = excluded.shape,
          length_category = excluded.length_category, distance_meters = excluded.distance_meters,
          duration_seconds = excluded.duration_seconds, start_latitude = excluded.start_latitude,
          start_longitude = excluded.start_longitude, description = excluded.description,
          stops = excluded.stops, path = excluded.path, generated_at = now()
      `)
      const km = (generated.distanceMeters / 1000).toFixed(1)
      const minutes = Math.round(generated.durationSeconds / 60)
      const objetivo = (definition.targetDistance / 1000).toFixed(1)
      results.push(`${definition.name} — ${km} km (objetivo ${objetivo}) · ${minutes} min · ${generated.shape} · ${generated.stops.length} paradas (${generated.theme})`)
    }
  })
  await Promise.all(workers)
  return results
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const results = await seedRoutes()
    console.log(`Catálogo de rutas sembrado: ${results.length} rutas`)
    for (const line of results) console.log(`  ${line}`)
    process.exit(0)
  } catch (error) {
    console.error('Seed de rutas fallida:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
