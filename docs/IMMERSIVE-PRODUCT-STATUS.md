# AgentiCuantico — experiencia inmersiva

Esta rama reúne la capa visual inmersiva y la base de media/voz del producto.

## Experiencia
- UI full-screen centrada en el Neural Core.
- Chat flotante, HUD y estados visuales.
- WebGL/Three.js procedural con degradación segura.
- Responsive móvil y reducción de movimiento.
- Voz opcional del navegador.
- Reconocimiento de voz cuando el navegador lo soporta.
- Cancelación de generación en curso.
- Historial local + sincronización autenticada.

## Media
- Upload real de imágenes, video, audio, PDF y archivos compatibles.
- Cloudflare R2 como almacenamiento.
- Límite actual: 100 MB por archivo.
- Imágenes pequeñas se pueden enviar al modelo para visión.
- Los archivos quedan asociados a la sesión y no se simula una subida.

## Generación
- Imagen: Cloudflare Workers AI mediante el binding `AI` y `CF_IMAGE_MODEL`.
- Video: queda preparado como capacidad de proveedor, pero no se inventa un endpoint si el proveedor/modelo no está configurado. Hugging Face documenta text-to-video mediante Inference Providers y modelos como Wan/LTX/Hunyuan; la integración de producción debe usar su cliente oficial o un worker/sidecar que gestione el trabajo asíncrono. citeturn0search0turn0search2

## Cloudflare
Crear el bucket antes de desplegar:

```bash
npx wrangler r2 bucket create agenticuantico-uploads
```

La configuración ya contiene:

```json
"r2_buckets": [
  { "binding": "UPLOADS", "bucket_name": "agenticuantico-uploads" }
]
```

## Proveedores
La arquitectura conserva fallback:
1. Hugging Face Inference Providers si hay `HF_TOKEN`.
2. Cloudflare Workers AI.
3. El frontend nunca recibe tokens de proveedor.

GitHub, Cloudflare y Hugging Face se tratan como integraciones de infraestructura, no como identidades falsas de agentes.

## Estado
Esta rama está pensada para revisión y pruebas antes de tocar `main`.
