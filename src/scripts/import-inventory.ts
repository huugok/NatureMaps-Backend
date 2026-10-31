import 'dotenv/config'
import { CatalogError } from '../services/catalogError.js'

// Descarga el inventario de arbolado de València completo, de 200 en 200, y registra la fuente
// con su licencia y la fecha de descarga. Se puede repetir: no duplica plantas.
//   npm run import:arbolado
//   npm run import:arbolado -- --offset=4000      (reanudar tras un fallo)
//   npm run import:arbolado -- --limit=100        (páginas más pequeñas, 1-200)

function option(name: string, fallback: number, min: number, max: number) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))
  if (arg === undefined) return fallback
  const text = arg.slice(name.length + 3)
  if (!/^\d+$/.test(text) || Number(text) < min || Number(text) > max) {
    console.error(`--${name} debe ser un entero entre ${min} y ${max}`)
    process.exit(1)
  }
  return Number(text)
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

// Import dinámico: la base de datos lee DATABASE_URL al cargarse, así que va después de la comprobación.
const { importAllValenciaInventory } = await import('../services/inventoryImport.js')

const limit = option('limit', 200, 1, 200)
const startOffset = option('offset', 0, 0, 10_000_000)
let nextOffset: number | null = startOffset
const started = new Date()

try {
  const totals = await importAllValenciaInventory({
    limit,
    offset: startOffset,
    onPage: (page) => {
      nextOffset = page.nextOffset
      console.log(`offset ${page.offset}: descargados ${page.fetched}, nuevos ${page.stored}, `
        + `excluidos ${page.excluded}, ya guardados ${page.skipped}, inválidos ${page.failed}`)
    },
  })
  console.log(`\nTerminado. Páginas: ${totals.pages}. Descargados: ${totals.fetched}. Nuevos: ${totals.stored}. `
    + `Excluidos (Falta): ${totals.excluded}. Ya guardados: ${totals.skipped}. Inválidos: ${totals.failed}.`)
  console.log(`Descarga iniciada: ${started.toISOString()}. Fuente registrada en data_sources.`)
} catch (error) {
  // El mensaje de CatalogError no lleva credenciales ni SQL; cualquier otro error se resume.
  console.error(error instanceof CatalogError ? error.message : 'Fallo inesperado durante la importación')
  if (nextOffset !== null) console.error(`Para reanudar: npm run import:arbolado -- --offset=${nextOffset}`)
  process.exit(1)
}
