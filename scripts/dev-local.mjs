// Backend en local SIN base de datos (NM-08): PostgreSQL en memoria (PGlite)
// con todas las migraciones aplicadas y datos reales del Ajuntament de
// València descargados al arrancar. No lee ni escribe en Neon: todas las
// consultas del driver se desvían a la base en memoria, y al cerrar el proceso
// no queda nada. Sirve para probar una rama antes de migrar la base compartida.
//
//   npm run dev:local                    (6000 árboles del centro de València)
//   npm run dev:local -- --arboles=14000 (todo el centro: tarda más en arrancar)
//   npm run dev:local -- --arboles=0     (solo zonas verdes, POIs y artículos)
//   npm run dev:local -- --zona=campus   (Tarongers y Blasco Ibáñez en vez del centro)
//
// El arbolado se limita a una zona para que sus parques tengan flora con pocas
// descargas: el inventario completo son unos 160.000 ejemplares y descargarlo
// entero al arrancar no es viable. Fuera de la zona elegida los parques salen
// sin ejemplares, que es lo que se ve al abrir su ficha; no es un hueco de los
// datos municipales, sino de lo que se ha descargado aquí.
//
// Las zonas verdes, los POIs y los artículos sí son los de toda la ciudad.
//
// Necesita internet para descargar del geoportal. Si una descarga falla, el
// servidor arranca igualmente con lo que haya y lo avisa.
import { startFixtureDatabase } from '../tests/support/pglite.mjs'

function option(name, fallback, min, max) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))
  if (arg === undefined) return fallback
  const text = arg.slice(name.length + 3)
  if (!/^\d+$/.test(text) || Number(text) < min || Number(text) > max) {
    console.error(`--${name} debe ser un entero entre ${min} y ${max}`)
    process.exit(1)
  }
  return Number(text)
}

// Cajas WGS84 con los ejemplares que el inventario municipal tiene en cada una,
// comprobado contra la capa 151 del geoportal (2026-11-13).
const ZONAS = {
  centro: {
    caja: { west: -0.392, south: 39.472, east: -0.362, north: 39.484 },
    descripcion: 'centro: Botànic, Hespérides, Jardín del Turia, Viveros, Glorieta y Parterre (~14.000 ejemplares)',
  },
  // Ceñida a los jardines del campus: así el valor por defecto de --arboles los
  // descarga todos. Una caja mayor tiene más ejemplares de los que se bajan, y
  // como se cogen por orden del inventario, los jardines podrían quedarse sin
  // ninguno y su ficha saldría vacía.
  campus: {
    caja: { west: -0.350, south: 39.4735, east: -0.338, north: 39.4815 },
    descripcion: 'campus: Jardín Central de Tarongers y Albalat dels Tarongers (~4.100 ejemplares)',
  },
}

function zonaElegida() {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--zona='))
  if (arg === undefined) return 'centro'
  const nombre = arg.slice('--zona='.length)
  if (!Object.hasOwn(ZONAS, nombre)) {
    console.error(`--zona debe ser una de: ${Object.keys(ZONAS).join(', ')}`)
    process.exit(1)
  }
  return nombre
}

const trees = option('arboles', 6000, 0, 200_000)
const zona = zonaElegida()
const port = Number(process.env.PORT) || 3000
const PAGE = 200
const CENTRE = ZONAS[zona].caja

console.log('Base de datos en memoria: aplicando migraciones…')
// Fija DATABASE_URL a un valor ficticio y desvía el driver de Neon a PGlite
// antes de cargar la app, así que el .env real no se usa en ningún momento.
await startFixtureDatabase()

async function step(label, run) {
  process.stdout.write(`${label}… `)
  try {
    console.log(await run())
  } catch (error) {
    console.log(`FALLÓ (${error instanceof Error ? error.message : 'error desconocido'}). Se continúa sin estos datos.`)
  }
}

if (trees > 0) {
  const { importValenciaInventory } = await import('../src/services/inventoryImport.ts')
  await step(`Arbolado del ${ZONAS[zona].descripcion} — hasta ${trees}, de ${PAGE} en ${PAGE}`, async () => {
    let stored = 0
    for (let offset = 0; offset < trees; offset += PAGE) {
      const page = await importValenciaInventory(Math.min(PAGE, trees - offset), offset, CENTRE)
      stored += page.stored
      if (page.nextOffset === null) break
    }
    return `${stored} guardados`
  })
  const { seedProfiles } = await import('../src/db/seedProfiles.ts')
  await step('Fichas editoriales de especies', async () => `${(await seedProfiles()).profilesUpserted} fichas`)
}

const { importValenciaPois } = await import('../src/services/poiImport.ts')
await step('Puntos de interés', async () => `${(await importValenciaPois()).stored} guardados`)

const { importValenciaGreenAreas } = await import('../src/services/greenAreaImport.ts')
await step('Zonas verdes y cruce con el arbolado', async () => {
  const result = await importValenciaGreenAreas()
  return `${result.stored} zonas (${result.featured} parques y jardines), ${result.plants.inside} árboles dentro de una zona`
})

const { seedEditorial } = await import('../src/db/seedEditorial.ts')
await step('Artículos de flora y zonas verdes', async () => `${(await seedEditorial()).upserted} artículos`)

const { app } = await import('../src/app.ts')
app.listen(port, () => {
  console.log(`\nBackend local en http://localhost:${port} (base en memoria; Ctrl+C para cerrar y descartarla).`)
  console.log('Arranca el frontend con VITE_API_URL apuntando a esta dirección (es el valor por defecto).')
  if (trees > 0) {
    const otras = Object.keys(ZONAS).filter((nombre) => nombre !== zona)
    console.log(`\nSolo se ha descargado el arbolado del ${zona}: las fichas de parques de fuera saldrán sin`)
    console.log(`ejemplares. Para verlos ahí: npm run dev:local -- --zona=${otras[0]}`)
  }
})
