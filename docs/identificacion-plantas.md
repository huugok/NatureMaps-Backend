# Identificar plantas (Pl@ntNet)

## 1. Preparar

```bash
git clone https://github.com/huugok/NatureMaps-Backend.git
cd NatureMaps-Backend
git switch feat/plantnet-identificacion   # hasta que se mergee a main
npm install
cp .env.example .env
```

## 2. Rellenar `.env`

Pide la clave de Pl@ntNet del equipo por privado y completa:

```
DATABASE_URL='cadena_de_neon'
PLANTNET_API_KEY=clave_del_equipo
PLANTNET_API_URL=https://my-api.plantnet.org/v2/identify
PLANTNET_PROJECT=all
```

- `PLANTNET_API_KEY` sin comillas ni espacios; `DATABASE_URL` entre comillas simples.
- Nunca subas `.env` a Git ni pegues la clave en chats.

## 3. Arrancar

```bash
npm run dev
```

Debe salir `Server running on port 3000`. Déjalo abierto.

## 4. Identificar

Abre <http://localhost:3000/probar>, sube de 1 a 5 fotos (JPG o PNG), elige qué parte de la
planta se ve en cada una y pulsa **Identificar**.

Alternativa por terminal (cambia la ruta de la foto):

```bash
curl -X POST -F "images=@foto.jpg" -F "organs=leaf" "http://localhost:3000/plants/identify?lang=es"
```

`organs`: `leaf`, `flower`, `fruit`, `bark` o `auto`.

## Si falla

- **Error 500 / "PLANTNET_API_KEY no configurada"**: revisa `.env` y reinicia `npm run dev`.
- **No conecta**: el servidor no está arrancado.
- **Error 429**: cuota diaria agotada (compartida por todo el equipo).
- **`curl: (26)`**: no encuentra la foto; revisa la ruta. Si está en OneDrive y solo en la nube, cópiala a una carpeta local.

Tambien hay un identificar.html en public con el que probar la identificacion, solo hay que arrancar antes el backend
