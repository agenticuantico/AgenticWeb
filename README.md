# AgentiCuantico — Neural Intelligence

Experiencia web 3D inmersiva con Neural Core, chat de IA y arquitectura preparada para proveedores Qwen/modelos propios.

Frontend público de **AgentiCuantico**, servido como una única experiencia web.

## Fuente única de la interfaz

La aplicación principal vive exclusivamente en:

- `public/index.html`
- `public/styles.css`
- `public/brain-3d.js`
- `public/neural-core-ui.js`
- `public/assets/background/quantum-world.svg`
- `public/assets/AgentiCuantico_brain_PBR.glb` (generado durante el deployment)

No se mantienen versiones antiguas de la homepage ni interfaces paralelas.

## Arquitectura

```
Browser
  ↓
AgentiCuantico Neural Core
  ├─ Three.js / GLB / procedural fallback
  ├─ chat + estados neuronales
  ├─ voz del navegador
  └─ archivos compatibles
  ↓
Cloudflare Worker
  ↓
Qwen configurado en backend
```

Los secretos y credenciales permanecen en Cloudflare/GitHub Secrets. El nombre del proveedor/modelo no forma parte de la UI pública.

## 3D

El cerebro se genera con `scripts/generate_brain_glb.py` durante el deployment y se publica como:

`/assets/AgentiCuantico_brain_PBR.glb`

Si WebGL o el GLB no puede utilizarse, `public/brain-3d.js` proporciona un fallback procedural.

## Deployment

El deployment oficial es **Cloudflare Workers + Assets** mediante:

`.github/workflows/cloudflare.yml`

El workflow genera el GLB, valida la aplicación y despliega `worker.js` con `wrangler.jsonc`.

No se utiliza un segundo workflow de GitHub Pages para publicar una copia alternativa del sitio.

## API

La UI utiliza:

`/v1/public/chat`

El frontend nunca contiene tokens de modelos.

## Estado

### Implementado

- Neural Core UI
- cerebro 3D
- GLB generado en deployment
- fallback procedural
- fondo espacial/partículas
- chat
- estados neuronales
- voz del navegador
- selección de idioma y género cuando existen voces compatibles
- drag & drop
- validación de archivos
- integración con backend Qwen

### Ready for Backend

- STT/TTS propio
- pipeline PDF/documentos
- análisis de vídeo
- análisis de audio
- RAG documental
- multimodalidad avanzada end-to-end

### No disponible

Cualquier capacidad que no esté conectada al backend no se presenta como funcional en la interfaz.

## Cerebro operativo

Repositorio separado:

https://github.com/agenticuantico/AgentiCuantico
