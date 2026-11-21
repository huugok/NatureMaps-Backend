# Carga de periodos de floración

La migración `0005_lowly_veda` crea `species_flowering_periods`. No trae meses precargados porque
el inventario municipal y Wikipedia no ofrecen un calendario fiable para todos los taxones.
La tabla requiere meses (1–12), región y referencia para cada periodo.

## Cargar una fuente en lote

Prepara un fichero JSON con un array de objetos con estos campos:

```json
[
  {
    "scientificName": "nombre científico exacto de species.scientific_name",
    "startMonth": 3,
    "endMonth": 5,
    "region": "Valencia",
    "sourceName": "nombre de la fuente",
    "sourceUrl": "https://enlace-a-la-referencia"
  }
]
```

Los meses del ejemplo son ilustrativos: cada periodo debe rellenarse desde la fuente indicada.
Una especie puede tener varias filas. Si el periodo cruza diciembre, `startMonth` puede ser mayor
que `endMonth` (por ejemplo, noviembre–febrero). No se debe fabricar un periodo para los casos sin
referencia; quedarán fuera del filtro mensual.

Guarda el fichero, por ejemplo, como `data/flowering-periods.json`, y ejecuta:

```powershell
npm.cmd run import:floracion -- --file=data/flowering-periods.json
```

El importador valida todos los meses, URLs y nombres antes de escribir. Los nombres se enlazan por
coincidencia científica exacta sin corregir erratas ni adivinar sinónimos. Un nombre no reconocido
hace que falle el lote completo. Volver a importar la misma fila actualiza su referencia sin
duplicarla.

## Cobertura de este catálogo

En la base consultada hay 370 nombres distintos de `VALENCIA_ARBOLADO`, incluidos seis registros
identificados solo hasta género (`Genus sp.`). Estos no pueden recibir una fenología específica de
especie hasta identificarlos. También hay nombres que parecen contener erratas o variantes; deben
reconciliarse con revisión taxonómica antes de intentar emparejarlos con fuentes externas.

Una fuente ibérica puede cubrir algunas especies silvestres, pero no se debe asumir que cubre todas
las ornamentales del inventario urbano. Para afirmar cobertura completa hace falta medir cuántos
nombres del catálogo aparecen en las fuentes y revisar manualmente los no emparejados.

## Carga inicial: observaciones de Phenobase

Se puede ejecutar `npm run report:floracion` para hacer una simulación de cobertura y
`npm run report:floracion -- --apply` para cargarla. El script consulta los registros públicos con
el rasgo `flower present` dentro de la caja geográfica definida en el script, recorre todas las
páginas con `search_after` y cruza los nombres científicos localmente por coincidencia exacta. No
envía el catálogo de especies a Phenobase. La carga guarda cada mes observado como un periodo de un
solo mes y etiqueta la región y la procedencia `Phenobase / iNaturalist`.

Estos registros son evidencia de floración observada ese mes y zona, no una temporada completa ni
una garantía de que la especie florezca todos los años en esos meses. Las especies sin coincidencia
exacta o sin observaciones quedan sin datos; no se completan mediante aproximaciones taxonómicas.
Phenobase solicita citar tanto el agregador como los conjuntos de origen incluidos en cada descarga.
La referencia almacenada apunta al portal y la atribución resumida identifica iNaturalist.

## Imágenes para especies con floración

`npm run enrich:floracion:imagenes` busca solo especies con al menos un periodo en
`species_flowering_periods` que todavía no tengan imagen. Consulta Wikipedia en español e inglés y
guarda una foto solo cuando Wikimedia permite verificar autor, atribución y licencia reutilizable.
No reemplaza imágenes existentes ni añade fotos a especies sin floración registrada. El proceso es
secuencial y acepta `--limit=200` y `--after-id=0` para reanudar lotes grandes.
