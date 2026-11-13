// Despliegue de los datos de NM-08 (contenido de flora y zonas verdes) sobre la
// base de datos real de Neon, en el orden correcto y de una sola vez:
//
//   npm run deploy:nm08             aplica los cambios
//   npm run deploy:nm08 -- --check  solo comprueba, sin escribir nada
//
// Los tres pasos son idempotentes: se puede volver a ejecutar sin duplicar
// nada. Lee DATABASE_URL de .env (la cadena de Neon), nunca la imprime.
import 'dotenv/config'
import { spawn } from 'node:child_process'

const CHECK_ONLY = process.argv.includes('--check')

const PASOS = [
  {
    nombre: 'Migraciones',
    comando: ['npm', 'run', 'db:migrate'],
    detalle: 'crea green_areas, editorial_articles y plant_locations.green_area_id',
  },
  {
    nombre: 'Zonas verdes',
    comando: ['npm', 'run', 'import:zonas-verdes'],
    detalle: 'descarga los polígonos del geoportal y cruza el arbolado (tarda unos minutos)',
  },
  {
    nombre: 'Artículos',
    comando: ['npm', 'run', 'db:seed:editorial'],
    detalle: 'carga los artículos en castellano, valenciano e inglés',
  },
]

function run(comando) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(comando[0], comando.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' })
    hijo.on('error', reject)
    hijo.on('close', (codigo) => (codigo === 0 ? resolve() : reject(new Error(`${comando.join(' ')} terminó con código ${codigo}`))))
  })
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (cadena de Neon, desde Connect).')
  process.exit(1)
}

// Comprobación previa: que la cadena es la de Neon y no una base local, para no
// desplegar por error contra otro sitio.
const host = (() => {
  try { return new URL(process.env.DATABASE_URL).hostname } catch { return '' }
})()
if (!host) {
  console.error('DATABASE_URL no es una URL válida.')
  process.exit(1)
}
if (host === 'localhost' || host === '127.0.0.1') {
  console.error(`DATABASE_URL apunta a ${host}: este comando es para la base de Neon. Para probar en local usa "npm run dev:local".`)
  process.exit(1)
}

console.log(`Base de datos: ${host}`)
console.log('Esta es la base compartida del equipo: los cambios los verán todos.\n')

// Import dinámico: el cliente lee DATABASE_URL al cargarse.
const { db } = await import('../src/db/index.js')
const { sql } = await import('drizzle-orm')

async function existe(tabla) {
  const { rows } = await db.execute(sql`select to_regclass(${`public.${tabla}`}) is not null as hay`)
  return rows[0]?.hay === true
}

async function cuenta(consulta) {
  try {
    const { rows } = await db.execute(consulta)
    return Number(rows[0]?.n ?? 0)
  } catch { return null }
}

async function estado() {
  const zonas = await existe('green_areas')
  const articulos = await existe('editorial_articles')
  return {
    zonas,
    articulos,
    nZonas: zonas ? await cuenta(sql`select count(*)::int as n from green_areas`) : null,
    nDestacadas: zonas ? await cuenta(sql`select count(*)::int as n from green_areas where featured`) : null,
    nArticulos: articulos ? await cuenta(sql`select count(*)::int as n from editorial_articles`) : null,
    nIdiomas: articulos ? await cuenta(sql`select count(distinct language)::int as n from editorial_articles`) : null,
    nPlantas: await cuenta(sql`select count(*)::int as n from plant_locations`),
    nAsignadas: await cuenta(sql`select count(*)::int as n from plant_locations where green_area_id is not null`),
  }
}

const antes = await estado().catch((error) => {
  console.error('\nNo se ha podido consultar la base de datos.')
  console.error(`Motivo: ${error?.cause?.message ?? error?.message ?? 'desconocido'}`)
  console.error('Revisa DATABASE_URL en .env: debe ser la cadena actual de Neon (Connect), con sslmode=require.')
  process.exit(1)
})
console.log('Estado actual:')
console.log(`  green_areas .......... ${antes.zonas ? `${antes.nZonas} zonas (${antes.nDestacadas} destacadas)` : 'la tabla no existe todavía'}`)
console.log(`  editorial_articles ... ${antes.articulos ? `${antes.nArticulos} artículos en ${antes.nIdiomas} idiomas` : 'la tabla no existe todavía'}`)
console.log(`  plant_locations ...... ${antes.nPlantas} ejemplares, ${antes.nAsignadas ?? 0} con zona verde asignada`)

if (CHECK_ONLY) {
  console.log('\nPasos que ejecutaría «npm run deploy:nm08»:')
  for (const paso of PASOS) console.log(`  ${paso.nombre}: ${paso.comando.join(' ')} — ${paso.detalle}`)
  console.log('\nComprobación terminada. No se ha escrito nada.')
  process.exit(0)
}

for (const [indice, paso] of PASOS.entries()) {
  console.log(`\n── ${indice + 1}/${PASOS.length} ${paso.nombre}: ${paso.detalle}`)
  await run(paso.comando)
}

const despues = await estado()
console.log('\n── Resultado')
console.log(`  green_areas .......... ${despues.nZonas} zonas (${despues.nDestacadas} destacadas)`)
console.log(`  editorial_articles ... ${despues.nArticulos} artículos en ${despues.nIdiomas} idiomas`)
console.log(`  plant_locations ...... ${despues.nAsignadas} de ${despues.nPlantas} ejemplares dentro de una zona verde`)

// Los artículos enlazan con zonas verdes por group_slug: si alguno apunta a un
// grupo que no se ha importado, la ficha de ese artículo saldría sin zona.
const huerfanos = await db.execute(sql`
  select distinct a.green_area_group as grupo from editorial_articles a
  where a.green_area_group is not null
    and not exists (select 1 from green_areas g where g.group_slug = a.green_area_group)
`)
if (huerfanos.rows.length > 0) {
  console.error(`\nAviso: estos artículos enlazan con grupos que no existen en green_areas: ${huerfanos.rows.map((f) => f.grupo).join(', ')}`)
  process.exit(1)
}

console.log('\nDespliegue terminado. Los artículos y las zonas verdes ya están en la base compartida.')
