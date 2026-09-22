# AgentiCuantico + Hugging Face + Cloudflare

## Arquitectura

- **AgenticWeb**: interfaz pública y Worker de Cloudflare.
- **Hugging Face Router**: inferencia Qwen cuando `HF_TOKEN` está configurado como secreto de Cloudflare.
- **AgentiCuantico**: cerebro privado con memoria, agentes, verificación y herramientas.
- El navegador nunca recibe `HF_TOKEN` ni secretos de infraestructura.

## Modelo

La configuración usa `Qwen/Qwen3.8-27B` como modelo principal y hace fallback a:

1. `Qwen/Qwen3.8-27B-FP8`
2. `Qwen/Qwen3.6-27B`

El Worker usa el sufijo `:fastest` para que Hugging Face seleccione un proveedor disponible.

## Secretos

No guardar tokens en Git. En Cloudflare Worker > Settings > Variables and Secrets crear:

- `HF_TOKEN` — **Secret**
- opcional: `HF_MODELS` — variable, por ejemplo `Qwen/Qwen3.8-27B,Qwen/Qwen3.8-27B-FP8`

El token es privado y el Worker solo lo usa en el servidor.

## Deploy

El repositorio incluye `.github/workflows/cloudflare.yml`. Requiere en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cada push a `main` despliega el Worker.

## Hugging Face Space

`AgentiCuantico/Qwen38-brain` no está disponible en la autenticación actualmente conectada, por lo que el Worker no inventa una URL de Space. La ruta activa usa el Router oficial de Hugging Face.

## Nota de costos

Hugging Face Spaces CPU Basic puede ser gratuito, pero la inferencia gestionada/proveedores de modelos no debe asumirse gratuita. Para evitar cargos inesperados, usar un Space/servidor propio o un runtime local cuando esté disponible.
