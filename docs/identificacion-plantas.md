# Identificar plantas (Pl@ntNet)

## 1. Preparar

Si ya tienes el repositorio abierto, ejecuta los comandos desde su raíz. Para una copia nueva:

```bash
git clone https://github.com/huugok/NatureMaps-Backend.git
cd NatureMaps-Backend
```

Instala las dependencias y crea `.env` solo si todavía no existe:

```bash
npm install
if [ ! -f .env ]; then cp .env.example .env; fi
```

## 2. Rellenar `.env`

Pide la clave de Pl@ntNet del equipo por privado y completa:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
PLANTNET_API_KEY=tu_clave
PLANTNET_API_URL=https://my-api.plantnet.org/v2/identify
PLANTNET_PROJECT=all
```

- Sustituye los valores de ejemplo localmente y conserva los demás ajustes de tu `.env`.
- `PLANTNET_API_KEY` es obligatoria para identificar. La URL y el proyecto son opcionales:
  sus valores predeterminados son los indicados arriba.
- Nunca subas `.env` a Git ni pegues la clave en chats.

## 3. Arrancar

```bash
npm run dev
```

Debe salir `Server running on port 3000` si no has cambiado `PORT`. Déjalo abierto.
Si modificas `.env`, reinicia el servidor. Las URLs siguientes usan el puerto 3000;
ajústalo si has configurado otro.

## 4. Identificar

Abre <http://localhost:3000/probar>, sube de 1 a 5 fotos de la misma planta (JPG o PNG,
máximo 10 MB por imagen), elige qué parte de la planta se ve en cada una y pulsa **Identificar**.
Esta página sirve `public/identificar.html`; requiere el backend arrancado.

Alternativa en otra terminal, usando `POST /plants/identify`:

```bash
curl -X POST -F "images=@foto.jpg" -F "organs=leaf" "http://localhost:3000/plants/identify?lang=es&nb-results=5"
```

`foto.jpg` debe existir en la carpeta actual; puedes sustituirla por una ruta absoluta.
Envía `multipart/form-data`, no JSON. `curl -F` configura el tipo de contenido automáticamente.

- `images`: de 1 a 5 archivos. Para varios, repite `-F "images=@..."`.
- `organs`: `leaf`, `flower`, `fruit`, `bark` o `auto`. Si lo envías, incluye un valor por
  imagen en el mismo orden; si omites todos, se usa `auto`.
- `lang`: idioma de respuesta, por defecto `es` (por ejemplo `en` o `ca`).
- `nb-results`: número de candidatos, entre 1 y 10; por defecto 5.

La respuesta incluye `bestMatch`, `results` con especies y puntuaciones (`score`), y
`remainingIdentificationRequests` cuando el proveedor lo comunica. El resultado no se guarda
automáticamente en el catálogo ni como observación.

## Si falla

- **Error 500 / "PLANTNET_API_KEY no está configurada en el servidor"**: completa la clave y reinicia `npm run dev`.
- **No conecta**: el servidor no está arrancado.
- **Error 400**: comprueba formato/tamaño de archivos y que haya un `organs` por imagen si lo envías.
- **Error 415**: envía los archivos como `multipart/form-data` con `-F`.
- **Error 429**: se ha alcanzado el límite de solicitudes de Pl@ntNet.
- **Error 502**: el proveedor rechazó la clave o devolvió otro error; revisa la configuración.
- **Error 504**: no se pudo contactar con Pl@ntNet dentro del tiempo de espera.
- **`curl: (26)`**: no encuentra la foto; revisa la ruta. Si está en OneDrive y solo en la nube, cópiala a una carpeta local.
