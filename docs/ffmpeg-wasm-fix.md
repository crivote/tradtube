# Fix: ffmpeg.wasm — SharedArrayBuffer + carga de core

**Fecha:** 2026-05-25  
**Estado:** Pendiente de implementar  
**Archivos afectados:** `public/ffmpeg-worker.html`, `package.json`

---

## Diagnóstico

`AudioRecorder.jsx` usa un iframe (`/ffmpeg-worker.html`) para convertir WAV a Opus via ffmpeg.wasm, evitando el conflicto COEP/YouTube en la página principal.

El `netlify.toml` ya tiene los headers correctos para el iframe:

```toml
[[headers]]
  for = "/ffmpeg-worker.html"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "credentialless"
```

COOP + COEP activos → `SharedArrayBuffer` disponible en el iframe. Los headers **no son el problema**.

El problema está en `ffmpeg-worker.html`:

```javascript
// ROTO — ffmpeg.load() sin argumentos
const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
const ffmpeg = new FFmpeg();
await ffmpeg.load(); // ← busca worker.js en CDN cross-origin → falla
```

`ffmpeg.load()` sin argumentos intenta crear un `Worker` con `new URL("./worker.js", import.meta.url)`. Dentro del iframe cargando desde CDN, `import.meta.url` apunta a jsdelivr. El Worker cross-origin falla por política de seguridad del navegador.

Adicionalmente, `ffmpeg.load()` sin `coreURL` usa una URL de core por defecto que puede no tener `libopus` compilado.

---

## Solución

Dos cambios:

### 1. Copiar `worker.js` de ffmpeg a `public/` en build time

El Worker interno de ffmpeg debe servirse desde tu propio dominio. El archivo existe en `node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js` (5KB).

En `package.json`, modificar los scripts `dev` y `build` para copiar el archivo antes de arrancar:

```json
"scripts": {
  "copy-ffmpeg-worker": "cp node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js public/ffmpeg-core-worker.js",
  "dev": "npm run copy-ffmpeg-worker && vite",
  "build": "npm run copy-ffmpeg-worker && vite build",
  ...
}
```

**Nota:** Este cambio ya está aplicado en `package.json` y `public/ffmpeg-core-worker.js` ya existe.  
`public/ffmpeg-core-worker.js` no debe commitearse — añadir a `.gitignore`:

```
public/ffmpeg-core-worker.js
```

### 2. Reescribir `ffmpeg-worker.html`

Reemplazar el contenido completo de `public/ffmpeg-worker.html` con:

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>FFmpeg Worker</title></head>
<body>
<script type="module">
const BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm';
const FFMPEG_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js';

let ffmpeg = null;
let origin = '';

async function init() {
  const { FFmpeg } = await import(FFMPEG_URL);
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', () => {});
  ffmpeg.on('progress', ({ progress }) => {
    if (origin) {
      parent.postMessage({ type: 'progress', progress: Math.round(progress * 100) }, origin);
    }
  });

  await ffmpeg.load({
    classWorkerURL: '/ffmpeg-core-worker.js',   // worker local — mismo dominio
    coreURL:   `${BASE}/ffmpeg-core.js`,         // core desde CDN — credentialless lo permite
    wasmURL:   `${BASE}/ffmpeg-core.wasm`,
    workerURL: `${BASE}/ffmpeg-core.worker.js`,
  });

  parent.postMessage({ type: 'ready' }, origin || '*');
}

async function convert(wavBuffer) {
  await ffmpeg.writeFile('input.wav', new Uint8Array(wavBuffer));
  await ffmpeg.exec(['-i', 'input.wav', '-c:a', 'libopus', '-b:a', '96k', 'output.ogg']);
  const data = await ffmpeg.readFile('output.ogg');
  await ffmpeg.deleteFile('input.wav');
  await ffmpeg.deleteFile('output.ogg');
  return data;
}

init().catch(err => {
  parent.postMessage({ type: 'error', error: err.message || String(err) }, '*');
});

window.addEventListener('message', async (event) => {
  if (event.data.type !== 'convert') return;
  if (!origin) origin = event.origin;
  const { requestId, wavBuffer } = event.data;
  try {
    const output = await convert(wavBuffer);
    event.source.postMessage(
      { type: 'result', requestId, output },
      origin,
      [output.buffer]
    );
  } catch (err) {
    event.source.postMessage(
      { type: 'error', requestId, error: err.message || String(err) },
      origin
    );
  }
});
</script>
</body>
</html>
```

**Diferencias clave respecto al original:**

| | Original (roto) | Fix |
|---|---|---|
| `classWorkerURL` | no se pasa → CDN → falla | `/ffmpeg-core-worker.js` (local) |
| `coreURL` | no se pasa → default sin opus | `@ffmpeg/core-mt@0.12.10` con libopus |
| `wasmURL` | no se pasa | explícito, mismo paquete |
| `workerURL` | no se pasa | explícito, mismo paquete |
| `init()` error handling | ninguno | postMessage al padre si falla |
| limpieza de archivos FS | no | `deleteFile` tras cada conversión |
| progreso | señal existe en `AudioRecorder` pero nunca llega | `ffmpeg.on('progress')` → postMessage |

---

## Por qué `COEP: credentialless` permite cargar el core desde CDN

`credentialless` es menos restrictivo que `require-corp`: permite cargar recursos cross-origin sin que el servidor remoto necesite headers `Cross-Origin-Resource-Policy`. jsdelivr no envía esos headers, pero con `credentialless` no los necesita. Por eso el core (32MB WASM) puede cargarse desde CDN sin alojar los archivos en tu propio servidor.

El Worker interno (`classWorkerURL`) sí debe ser same-origin porque `new Worker(url)` siempre requiere mismo origen o un blob URL. Por eso se sirve desde `/ffmpeg-core-worker.js`.

---

## Progreso — conectar con `AudioRecorder.jsx`

El worker ya envía mensajes de progreso `{ type: 'progress', progress: 0-100 }`. En `AudioRecorder.jsx`, el handler de mensajes del iframe los ignora actualmente. Para conectar con la barra de progreso existente (`conversionProgress`), en el handler de mensajes añadir:

```javascript
} else if (msg.type === 'progress') {
  setConversionProgress(msg.progress);
}
```

Esto está en el bloque `if (msg.type === 'ready') { ... } else if (msg.type === 'result') { ... }` dentro de `getFfmpegIframe()`.

---

## Error handling de init fallido

El `init().catch` en el worker envía `{ type: 'error' }` sin `requestId` (porque no hay conversión en curso). En `AudioRecorder.jsx`, el handler actual solo procesa errores con `requestId`. Para capturar errores de carga del WASM, añadir al handler:

```javascript
} else if (msg.type === 'error' && !msg.requestId) {
  // Error de inicialización del worker — WASM no cargó
  setErrorMsg('Audio converter failed to load. Check your connection and try again.');
  setState(STATES.RECORDED); // volver al estado anterior para permitir reintento
}
```

---

## Verificación

Después de aplicar el fix, para verificar que funciona:

1. `npm run dev` — verificar que `public/ffmpeg-core-worker.js` existe antes de que Vite arranque
2. Abrir DevTools → Network en `/ffmpeg-worker.html` (inspeccionando el iframe)
3. Grabar audio, hacer trim, pulsar "Apply Trim & Convert"
4. Verificar en Network que se cargan:
   - `ffmpeg-core-worker.js` desde `localhost` (o tu dominio)
   - `ffmpeg-core.js`, `ffmpeg-core.wasm`, `ffmpeg-core.worker.js` desde `cdn.jsdelivr.net`
5. Verificar en Console del iframe que no hay errores de `SharedArrayBuffer` ni de Worker
6. Verificar que el blob resultante es reproducible con `<audio>`

---

## `.gitignore`

Añadir:

```
public/ffmpeg-core-worker.js
```

El archivo se regenera en cada `npm run dev` / `npm run build` desde `node_modules`. No tiene sentido commitearlo.
