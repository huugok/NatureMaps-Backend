import 'dotenv/config'
import { CatalogError } from '../services/catalogError.js'

// Seed del contenido de las fichas de POI (NM-06), idempotente:
//   npm run db:seed:pois
//   npm run db:seed:pois -- --dry-run   (solo comprueba nombres e idiomas, sin red)
//
// Requiere los POIs importados (`npm run import:pois`). Los títulos de Wikipedia
// están elegidos a mano en `src/services/poiProfiles.ts`; aquí solo se ejecuta.
// Los textos son extractos de Wikipedia con su licencia y atribución, no
// contenido editorial propio: NM-09 los sustituirá.

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

const { dryRunCuratedPois, formatDryRun, seedPoiProfiles } = await import('../services/poiProfiles.js')

try {
  // `--dry-run` propone la lista curada contra el catálogo: no descarga ni escribe.
  if (process.argv.includes('--dry-run')) {
    const rows = await dryRunCuratedPois()
    console.log(formatDryRun(rows))
    process.exit(rows.every((row) => row.found) ? 0 : 1)
  }
  const summary = await seedPoiProfiles()
  console.log(`Curados: ${summary.total}. Encontrados en el catálogo: ${summary.matched}.`)
  console.log(`Perfiles guardados: ${summary.profiles}. Fotos con licencia verificada: ${summary.images}.`)
  if (summary.missing.length > 0) console.warn(`Sin coincidencia: ${summary.missing.join(', ')}`)
  if (summary.failed.length > 0) console.warn(`Fallos de descarga: ${summary.failed.join(', ')}`)
  if (summary.missing.length > 0 || summary.failed.length > 0) {
    console.warn('Revisa los nombres de CURATED_POIS o vuelve a ejecutar la seed.')
  }
} catch (error) {
  console.error(error instanceof CatalogError ? error.message : 'Fallo inesperado durante la seed')
  process.exit(1)
}
