import 'dotenv/config'

// Corrige los nombres de plantas guardados con la codificación rota («CiprÃ©s comÃºn»
// → «Ciprés común»). Se puede repetir: no hace nada si no queda nada que corregir.
//   npm run repair:nombres -- --check   solo cuenta, sin escribir
//   npm run repair:nombres              aplica la corrección

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

const apply = !process.argv.includes('--check')

// Import dinámico: la base de datos lee DATABASE_URL al cargarse.
const { repairStoredNames } = await import('../services/nameRepair.js')

const host = (() => {
  try { return new URL(process.env.DATABASE_URL!).hostname } catch { return '' }
})()
console.log(`Base de datos: ${host || '(desconocida)'}${apply ? '' : '  [--check: no se escribe nada]'}`)

const result = await repairStoredNames({ apply })
const labels: Record<keyof typeof result, string> = {
  plantNames: 'Nombres comunes',
  reportedScientificNames: 'Nombres científicos del inventario',
  speciesNames: 'Especies',
}
for (const key of Object.keys(result) as Array<keyof typeof result>) {
  const r = result[key]
  console.log(`${labels[key]}: ${r.rows} con marca rota, ${r.repairable} valores corregibles` +
    (apply ? `, ${r.updated} actualizados, ${r.skipped} sin tocar` : ''))
}
process.exit(0)
