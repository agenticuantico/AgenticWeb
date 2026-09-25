# AgentiCuantico — Neural Workspace

Frontend público de **AgentiCuantico**: una aplicación responsive para conversar con IA, seleccionar agentes especializados, crear equipos, utilizar herramientas y explorar un Neural Core 3D.

## Experiencia

- **Responsive mobile-first:** navegación lateral en desktop y drawer táctil en teléfonos.
- **Neural Chat:** conversación real mediante `/v1/public/chat`; no hay respuestas simuladas.
- **Voz:** micrófono mediante Web Speech API cuando el navegador lo soporta; salida de voz configurable. Para una voz neural más natural existe `/v1/public/tts`, preparado para un proveedor TTS compatible.
- **Idiomas:** español Argentina/España, inglés EE. UU./Reino Unido, portugués Brasil, francés, italiano, alemán, japonés y coreano.
- **Preferencia de voz:** perfiles femenina/masculina. En el fallback del navegador se trata como preferencia porque los navegadores no garantizan el género de cada voz disponible.
- **Adjuntos:** texto/código e imágenes, con límites para evitar cargas excesivas.
- **Neural Core:** visualización Three.js + GLB y fallback procedural.

## Agent Studio

Incluye perfiles base para:

- Asistente virtual
- Programación / CodeQ
- Marketing / MarketQ
- UI/UX / UXQ
- Diseño gráfico / PixelQ
- Ilustración 3D / 3DQ
- Research / ResearchQ

Cada agente puede definir nombre, rol, habilidades, conocimientos e instrucciones. Los agentes creados desde la interfaz se guardan localmente en el dispositivo y, si existe una sesión válida, también pueden sincronizarse con el backend.

## Team Builder

Permite crear un grupo de hasta 10 agentes y asignar un objetivo. La conversación puede enviar el equipo activo al backend para que el motor use sus roles como contexto y entregue una única respuesta coordinada.

Los equipos locales funcionan sin cuenta en el dispositivo. La sincronización persistente del backend requiere autenticación y está sujeta a las reglas del servicio.

## Toolbox

- **CodQ:** análisis de repositorios permitidos mediante `/v1/public/codex`.
- **File Lab:** adjuntos.
- **Vision:** contexto para imágenes cuando el proveedor/modelo activo lo soporte.
- **3D Studio:** GLB/GLTF, Three.js y WebGL.
- **Research:** preparado para flujos de investigación verificables.
- **FlowQ:** espacio preparado para automatización multi-step.

Las herramientas que no tengan un endpoint real no se presentan como ejecutadas.

## Arquitectura

```
Usuario
  ↓
Neural Workspace
  ├─ Chat
  ├─ Voice
  ├─ Agent Studio
  ├─ Team Builder
  ├─ Toolbox
  └─ Neural Core 3D
  ↓
Cloudflare Worker
  ├─ /v1/public/chat
  ├─ /v1/public/tts
  ├─ /v1/public/agents
  ├─ /v1/user/agents
  ├─ /v1/user/teams
  └─ /v1/public/codex
  ↓
Motor configurado (Qwen / Workers AI / otro proveedor)
```

El frontend no contiene claves de modelos. Los secretos deben permanecer en Cloudflare/GitHub Secrets.

## 3D

El modelo principal utiliza **glTF 2.0**, preferentemente `.glb` para entregar el modelo binario en un único archivo. Three.js dispone de `GLTFLoader` para cargar glTF/GLB y admite extensiones de compresión y materiales. El pipeline genera:

`public/assets/AgentiCuantico_brain_PBR.glb`

Si WebGL o el modelo no puede utilizarse, `public/brain-3d.js` genera una representación procedural.

## Responsive y accesibilidad

La interfaz utiliza viewport correcto, CSS Grid/Flexbox, breakpoints y controles táctiles. También contempla `prefers-reduced-motion`, foco de controles, etiquetas ARIA y tamaños adaptados a pantallas pequeñas.

## Deployment

El deployment objetivo es **Cloudflare Workers + Assets** mediante:

`.github/workflows/cloudflare.yml`

El workflow genera el GLB, valida Wrangler y despliega Worker + assets.

La publicación real en `https://agenticuantico.dev.ar` depende de que Cloudflare esté autenticado y de que los secrets requeridos estén configurados en GitHub Actions.

## Repositorio del cerebro

El backend/operaciones más amplias de AgentiCuantico se mantienen en:

https://github.com/agenticuantico/AgentiCuantico
