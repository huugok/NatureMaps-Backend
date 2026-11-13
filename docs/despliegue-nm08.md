# Despliegue de NM-08 (contenido de flora y zonas verdes)

Pasos para que las zonas verdes y los artículos dejen de estar solo en local y
queden en la base compartida de Neon, visibles en la app desplegada.

Son tres cosas distintas y hay que hacerlas en este orden: **datos → backend →
frontend**. Desplegar solo los datos no hace que se vean: el backend que está
ahora en producción todavía no tiene los endpoints nuevos.

## 0. Antes de tocar nada: comprobar

```bash
npm run deploy:nm08 -- --check
```

No escribe nada. Imprime el host de la base (para asegurarse de que es Neon y
no otra), cuántas zonas y artículos hay ya, y cuántos ejemplares tienen zona
asignada. Si falla aquí, el problema es `DATABASE_URL` en `.env`, no el código.

## 1. Datos en Neon

```bash
npm run deploy:nm08
```

Hace los tres pasos seguidos, y los tres son idempotentes (se puede repetir sin
duplicar nada):

| Paso | Comando que lanza | Qué hace |
| --- | --- | --- |
| Migraciones | `npm run db:migrate` | crea `green_areas`, `editorial_articles` y añade `plant_locations.green_area_id` |
| Zonas verdes | `npm run import:zonas-verdes` | descarga los 807 polígonos del geoportal y calcula a qué zona pertenece cada ejemplar |
| Artículos | `npm run db:seed:editorial` | carga los 9 artículos en castellano, valenciano e inglés (27 filas) |

El paso de zonas verdes es el lento: descarga los polígonos y recorre todo el
arbolado por páginas para cruzarlo. Con el inventario completo tarda varios
minutos. No interrumpirlo a medias; si se corta, se vuelve a lanzar y continúa.

Al terminar imprime el recuento y comprueba que ningún artículo apunte a un
grupo de zona verde que no se haya importado (si lo hubiera, sale con error).

### Por qué este paso se puede hacer antes de mergear

La migración solo **añade**: dos tablas nuevas y una columna que admite nulos.
El backend que está ahora en producción consulta columnas explícitas, así que no
se entera de la columna nueva y sigue funcionando igual. Es decir: se puede
desplegar los datos primero y mergear después, sin ventana de error.

## 2. Backend

Mergear la PR de `feat/contenido-flora-zonas-verdes` en el repo del backend y
volver a desplegar el servicio. Hasta que esto no esté, los endpoints nuevos
(`/zonas-verdes`, `/zonas-verdes/:grupo`, `/articulos`, `/articulos/:slug`)
devuelven 404 y el frontend mostrará su aviso de «no se han podido cargar».

Comprobación rápida una vez desplegado, sustituyendo por la URL real del
backend:

```bash
curl "https://<backend>/zonas-verdes?destacadas=1" | head -c 300
curl "https://<backend>/articulos?lang=es" | head -c 300
```

## 3. Frontend

Mergear la PR de `feat/contenido-flora-zonas-verdes` en el repo del frontend.
Vercel reconstruye solo. No hay variables nuevas que configurar: las páginas
nuevas usan la misma `VITE_API_URL` que el resto de la app.

Qué mirar en la app desplegada:

- `/descubre` lista los artículos; cada uno abre en `/descubre/:slug`.
- `/zona/jardin-del-turia` abre la ficha de una zona verde.
- En el mapa, el botón del árbol enciende los contornos de parques y jardines.
- Alejando el mapa, las plantas de un mismo parque se agrupan en un marcador.

## Volver atrás

Los datos no hace falta deshacerlos: si se revierten los merges, las tablas
nuevas se quedan ahí sin que nadie las consulte y la columna nueva queda a nulo.
No estorban al resto de la aplicación.

Si aun así hubiera que vaciarlas, es `delete from editorial_articles` y
`delete from green_areas` (el `on delete set null` de la clave ajena deja los
ejemplares intactos). No borrar las tablas: habría que rehacer la migración.
