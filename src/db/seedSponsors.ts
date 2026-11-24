import { sql } from 'drizzle-orm'
import { db } from './index.js'

// Comercios patrocinadores del mapa. Coordenadas obtenidas de OpenStreetMap
// (Nominatim) y comprobadas en el centro de Valencia. Idempotente por nombre
// comercial: se puede repetir sin duplicar filas.
const STORES = [
  ['H&M', 'Carrer de Colón', 39.46866, -0.37240],
  ['El Corte Inglés', 'Carrer de Colón, 27', 39.46947, -0.37220],
  ['Primark', 'Passatge del Doctor Serra, 19', 39.46624, -0.37525],
  ['Zara Home', 'Carrer de Colón, 18', 39.46783, -0.37358],
  ['Mango', "Carrer de l'Arquebisbe Mayoral", 39.46824, -0.37890],
  ['Desigual', 'Carrer de Colón, 7', 39.46773, -0.37422],
  ['Decathlon City', 'Carrer de Ciril Amorós', 39.46861, -0.36813],
  ['MediaMarkt', 'Carrer de Colón', 39.46724, -0.37445],
  ['Fnac San Agustín', 'Carrer de Guillem de Castro, 9', 39.46825, -0.38056],
  ['Apple Store', 'Carrer de Colón, 25', 39.46908, -0.37231],
  ['Starbucks', 'Carrer de Colón', 39.46953, -0.37166],
  ['Lidl', 'Gran Via del Marqués del Túria', 39.46700, -0.36815],
] as const

await Promise.all(STORES.map(([name, address, latitude, longitude]) => db.execute(sql`
  insert into sponsors (name, business_name, address, latitude, longitude)
  values (${name}, ${name}, ${address}, ${latitude}, ${longitude})
  on conflict (business_name) do update set
    address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude
`)))

console.log(`Sembrados ${STORES.length} comercios patrocinadores`)
process.exit(0)
