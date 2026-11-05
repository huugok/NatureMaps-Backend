## UT 924 — Procedencia de plantas y especies

Las plantas ya guardaban la fuente, el enlace y la fecha de importación, pero la API no ofrecía un contrato uniforme con la entidad responsable y las referencias editoriales mantenían la fecha en texto libre. Ahora los GET de árboles y especies incluyen `provenance`, también por ubicación, con entidad, enlace, fecha y significado, versión si consta y ámbito del contenido.

Se reutilizan los datos existentes y las condiciones del adaptador municipal. La lectura reconoce referencias editoriales antiguas, y el seed guarda los campos estructurados en el JSON actual. No hay migración ni se ha ejecutado el seed en la base compartida. Se conservan los campos anteriores, créditos y licencias.

Validación: `npm run build` y `npm run test:catalog`, 23 tests correctos con PGlite. Se comprueban SQL/HTTP reales, plantas sin especie, fuentes editoriales antiguas, seed idempotente y fechas inválidas. SELECT de la base compartida: 67 538 plantas sin carencias de fuente/enlace/fecha; GET: 265 especies con al menos una referencia completa y una muestra de tres plantas. El frontend correspondiente se verificó con API real en es/va/en y pantallas de 320/402 px.

Contrato y semántica de fechas: `docs/source-provenance.md`. Frontend complementario: rama `feat/ut-924-source-provenance` en NatureMaps-Frontend. El backend es compatible con el cliente anterior y puede integrarse primero.
