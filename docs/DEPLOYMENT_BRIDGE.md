# AgentiCuantico Neural Core — deployment

AgenticWeb publica una única aplicación: **AgentiCuantico Neural Core**.

## Flujo actual

```
Browser
  ↓
https://agenticuantico.dev.ar
  ↓
Cloudflare Worker + Assets
  ↓
/v1/public/chat
  ↓
Qwen configurado en el Worker
```

La interfaz no expone el nombre del proveedor/modelo.

## Frontend

La fuente publicada es exclusivamente `public/`.

El deployment genera:

`public/assets/AgentiCuantico_brain_PBR.glb`

con `scripts/generate_brain_glb.py` antes de ejecutar Wrangler.

## Cloudflare

El workflow oficial es:

`.github/workflows/cloudflare.yml`

Utiliza los secretos de GitHub para Cloudflare y el token de IA. Las claves privadas no se escriben en HTML, CSS ni JavaScript público.

## Chat

La ruta pública utilizada por la UI es:

`POST /v1/public/chat`

La UI solamente recibe la respuesta de conversación y estados de error. No se muestra información interna del proveedor.

## Veracidad funcional

Una función se considera implementada solamente cuando existe la conexión real correspondiente. Las capacidades aún no conectadas al backend se presentan como **READY FOR BACKEND** y no se simulan.

## Dominio

El dominio objetivo es:

`https://agenticuantico.dev.ar`

El repositorio ya no contiene una segunda publicación de GitHub Pages ni una homepage alternativa.
