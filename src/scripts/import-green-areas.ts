import 'dotenv/config'
import { CatalogError } from '../services/catalogError.js'

// Importa las zonas verdes del geoportal de València (NM-08) y recalcula a qué
// zona pertenece cada ejemplar del inventario. Idempotente.
//   npm run import:zonas-verdes
//
// Ejecutar después de `npm run import:arbolado` (o volver a ejecutarlo cuando
// se importen ejemplares nuevos): el cruce árbol → zona se calcula aquí.
// Los artículos se cargan aparte con `npm run db:seed:editorial`.

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

// Import dinámico: la base de datos lee DATABASE_URL al cargarse.
const { importValenciaGreenAreas } = await import('../services/greenAreaImport.js')

try {
  const result = await importValenciaGreenAreas()
  console.log(`Descargados ${result.fetched} polígonos, guardadas ${result.stored} zonas (${result.featured} parques y jardines), inválidos ${result.invalid}.`)
  console.log(`Arbolado: ${result.plants.scanned} ejemplares revisados, ${result.plants.inside} dentro de una zona verde, ${result.plants.updated} actualizados.`)
  console.log(`Fuente registrada: ${result.source}. Descarga: ${result.downloadedAt}.`)
} catch (error) {
  console.error(error instanceof CatalogError ? error.message : 'Fallo inesperado durante la importación')
  process.exit(1)
}
