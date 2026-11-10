import 'dotenv/config'
import { CatalogError } from '../services/catalogError.js'

// Importa los POIs histórico-culturales del geoportal de València (NM-06):
// monumentos turísticos y recursos turísticos. Idempotente: cada ejecución
// refresca nombre, categoría y coordenadas; no toca el contenido curado.
//   npm run import:pois
//
// Después de importar, la seed de perfiles (`npm run db:seed:pois`) añade las
// descripciones e imágenes verificadas de los POIs curados.

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

// Import dinámico: la base de datos lee DATABASE_URL al cargarse.
const { importValenciaPois } = await import('../services/poiImport.js')

try {
  const result = await importValenciaPois()
  console.log(`Descargados ${result.fetched} POIs, guardados ${result.stored}, inválidos ${result.invalid}.`)
  console.log(`Fuentes registradas: ${result.sources.join(', ')}.`)
  console.log(`Descarga: ${result.downloadedAt}.`)
  if (result.stored !== result.fetched - result.invalid) {
    console.warn('Aviso: hay POIs que no se han podido guardar; revisa los duplicados de la fuente.')
  }
} catch (error) {
  console.error(error instanceof CatalogError ? error.message : 'Fallo inesperado durante la importación')
  process.exit(1)
}
