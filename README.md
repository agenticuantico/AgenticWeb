# AgenticWeb — Frontend

Interfaz pública y autenticada de AgentiCuantico.

## Separación del sistema

- **AgenticWeb**: presentación, navegación, contenido público y futura sesión/chat.
- **AgentiCuantico**: cerebro operativo separado, responsable de dominio, orquestación, proveedores, seguridad, integraciones y skills.
- **Contrato**: la comunicación entre frontend y backend debe pasar por APIs explícitas; no se publican secretos, prompts privados ni datos internos.

Repositorio del cerebro operativo: https://github.com/agenticuantico/AgentiCuantico

## Contenido del dominio

La portada incluye un visor del dominio público `https://agenticuantico.dev.ar`. El dominio sigue siendo la fuente de verdad de su contenido público; AgenticWeb lo presenta mediante una incrustación controlada y ofrece un enlace directo cuando las políticas del navegador o del servidor impiden el embebido.

El frontend **no** acepta URLs arbitrarias para el visor, evitando convertirlo en un proxy abierto.

## Despliegue

El repositorio incluye un workflow de GitHub Pages en `.github/workflows/pages.yml`. Una vez habilitado Pages para el repositorio, cada push a `main` publica la interfaz estática.

## Principios

- El cerebro/backend permanece separado.
- No se incluyen secretos, credenciales, prompts privados ni datos internos.
- Toda autorización se valida en el servidor.
- La web debe ofrecer accesibilidad, rendimiento, SEO técnico y degradación segura.

## Módulos previstos

- Landing y contenido SEO.
- Autenticación y gestión de sesión.
- Chat con streaming y fuentes.
- Avatar 3D con fallback 2D.
- Panel administrativo protegido por RBAC.
- Suscripciones con Mercado Pago y PayPal mediante backend seguro.
