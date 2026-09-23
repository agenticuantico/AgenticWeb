# Prompt maestro — Claude Code + UI UX Pro Max — AgentiCuantico

Copia este prompt en Claude Code desde la raíz de AgenticWeb después de instalar UI UX Pro Max.

---

Actúa como **Lead Creative Technologist + Senior Frontend Engineer + UI/UX Designer + Three.js/WebGL Engineer + Accessibility Engineer + Performance Engineer** para AgentiCuantico.

Tu misión es transformar el repositorio **AgenticWeb** en una experiencia web 3D inmersiva de nivel producto premium, manteniendo funcional la conversación real con la IA.

## 1. Primero analiza, después implementa

Antes de editar:
- inspecciona el repositorio completo y su arquitectura;
- lee `CLAUDE.md`;
- lee `design-system/agenticuantico/MASTER.md`;
- inspecciona `package.json`, `public/index.html`, `public/styles.css`, `public/brain-3d.js`, `public/avatar-3d.js`, `public/avatar-webgpu.js`, `public/premium-runtime.js`, `worker.js`, `wrangler.jsonc` y los scripts de experiencia/immersive existentes;
- identifica código duplicado, loops de animación duplicados, estilos que se pisan y funcionalidades ya operativas;
- no borres trabajo existente sin explicar por qué y sin conservar la funcionalidad equivalente.

## 2. Usa UI UX Pro Max

Si la skill está instalada, úsala como fuente de inteligencia de diseño.

Genera/consulta un sistema de diseño para:
**AI chatbot platform + autonomous agents + spatial computing + quantum-inspired neural interface + Three.js + immersive web experience**.

Persiste el resultado respetando:
`design-system/agenticuantico/MASTER.md`

No uses una plantilla genérica de SaaS. El sistema debe producir una identidad propia para AgentiCuantico.

## 3. Concepto visual

El usuario debe sentir que entró dentro del cerebro operativo de AgentiCuantico.

Construye:
- entorno negro profundo;
- cerebro/neural core 3D como protagonista;
- profundidad real;
- parallax;
- iluminación volumétrica simulada;
- conexiones neuronales;
- partículas;
- espectros/ondas de energía;
- señales que viajan por las conexiones;
- órbitas y campos sutiles;
- HUD científico minimalista;
- consola conversacional flotante;
- microinteracciones premium;
- estados visuales sincronizados con el estado real de la IA.

Evita:
- dashboard plano;
- muro de tarjetas;
- exceso de blur;
- exceso de glow;
- gradientes morado/rosa genéricos de “AI SaaS”;
- emojis como iconos;
- animaciones decorativas sin función.

## 4. Cerebro 3D

Implementa/evoluciona el cerebro con Three.js/WebGL.

Debe soportar:
- idle;
- listening;
- thinking;
- responding;
- speaking;
- error;
- offline.

Cada estado debe cambiar de forma visible pero elegante:
- intensidad;
- partículas;
- flujo de señales;
- pulsación;
- espectro;
- iluminación.

El estado debe conectarse a la actividad real de chat/voz. No inventes actividad autónoma.

Si no existe un modelo anatómico 3D adecuado localmente:
- conserva un fallback procedural de alta calidad;
- prepara una arquitectura para `.glb/.gltf`;
- no descargues assets externos sin revisar licencia y rendimiento.

No afirmes que existe computación cuántica real. Usa “quantum-inspired” o “visualización neuronal inspirada en sistemas cuánticos” mientras no exista un backend cuántico real.

## 5. Chat real

Preserva y mejora:
- streaming;
- Markdown;
- código;
- copiar;
- cancelar generación;
- adjuntos;
- imágenes;
- generación de imágenes si ya está conectada;
- micrófono;
- voz;
- historial;
- nueva conversación;
- errores;
- estados de carga.

La conversación debe seguir siendo usable aunque WebGL falle.

## 6. Agentes

Mantén la integración de agentes existente:
- AgentiQ;
- Programador;
- Diseñador 3D;
- Investigador;
- agentes personalizados/equipos si ya existen.

No simules agentes autónomos con animaciones. Cuando una acción sea solo visual, indícalo claramente. Cuando exista backend real, conecta el estado visual al resultado real.

## 7. Arquitectura

Mantén preferentemente:
- HTML/CSS/JavaScript existente;
- Cloudflare Worker;
- APIs existentes;
- Three.js para la capa 3D;
- módulos JS con responsabilidades claras.

No migres a React/Next.js solo por moda. Solo hazlo si el análisis demuestra que es necesario.

Consolida scripts visuales duplicados cuando sea seguro.

## 8. Rendimiento

Optimiza para Android y desktop:
- lazy loading de 3D;
- pixel ratio limitado;
- pausa al ocultarse la pestaña;
- menor carga en móviles;
- evitar loops duplicados;
- no bloquear el chat;
- fallback si WebGL no está disponible;
- respetar `prefers-reduced-motion`.

## 9. Accesibilidad

Verifica:
- teclado;
- focus visible;
- labels;
- contraste;
- touch targets;
- lectores de pantalla;
- reflow;
- textos largos;
- reduced motion;
- ningún significado crítico basado solo en color.

## 10. Responsive

Prueba:
- 375 px;
- 768 px;
- 1024 px;
- 1440 px.

En móvil, el cerebro sigue siendo protagonista, pero la consola de chat debe tener prioridad funcional.

## 11. Implementación

Trabaja por etapas:

### Fase A — Auditoría
Entrega primero:
- arquitectura actual;
- problemas;
- duplicados;
- funcionalidades que no deben romperse;
- plan técnico.

### Fase B — Design System
Alinea el código con `design-system/agenticuantico/MASTER.md`.

### Fase C — Neural Core
Implementa/refactoriza el cerebro 3D y sus estados.

### Fase D — Conversational Spatial UI
Integra chat, composer, attachments, voice y agent selector alrededor del cerebro.

### Fase E — Motion + Polish
Añade microinteracciones, espectros, señales y profundidad sin sacrificar rendimiento.

### Fase F — QA
Ejecuta checks de sintaxis/build/lint disponibles y revisa responsive, accesibilidad, reduced motion y fallbacks.

## 12. Regla final

No entregues una maqueta estática.

Entrega código funcional, integrado con la arquitectura existente, con la menor cantidad posible de regresiones.

Si una parte requiere credenciales, un asset externo, configuración de Cloudflare o un proveedor de modelo, deja la integración preparada y documenta exactamente qué falta.

Al terminar, devuelve:
1. archivos modificados;
2. funcionalidades implementadas;
3. checks ejecutados;
4. problemas restantes;
5. comandos exactos para probar localmente.

Empieza por la auditoría del repositorio y luego implementa.

---

## Objetivo visual resumido

**AgentiCuantico = una inteligencia artificial conversacional que el usuario explora como un espacio neuronal 3D vivo.**

No copies ChatGPT. Toma la claridad funcional de un chat moderno y conviértela en una interfaz espacial propia: cerebro 3D central + espectros + señales neuronales + HUD + consola conversacional + agentes reales + voz + archivos + imágenes + estados de IA.
