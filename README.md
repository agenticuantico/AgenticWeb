# AgentiCuantico · sitio público

Sitio estático de **agenticuantico.dev.ar** con el diseño original: encabezado con orbe cuántico,
hero con la super inteligencia de cerebro dorado y red neuronal animada.

## Portada

* **Chat conversacional** (`#chat`): el mismo motor que `/app/` (`app/config.js`, `i18n.js`, `md.js`,
  `engine.js`, `voice.js`) montado por `app/embed.js` + `app/embed.css`. Streaming, Markdown, código con
  copiar, modos Rápido / Pensar / Agente (plan, pasos y archivos descargables) y modo demo automático.
  Cabecera compacta (avatar + nombre + estado + bandera de voz) pensada para 360 px. El botón ⤢ abre
  `/app/` y la conversación continúa ahí.
* **Voz solo femenina** con banderas: 🇦🇷 es-AR (principal), es-ES, en-US, pt-BR, it-IT, fr-FR, de-DE.
  Si el servidor anuncia `tts` en `/api/health` usa `POST /api/tts` (ElevenLabs); si no, la mejor voz
  femenina del navegador para ese idioma. El avatar y el cerebro 3D laten con el nivel de la voz.
* **Cerebro vivo 3D** (`#cerebro`): `media/cerebro.glb` (~1,1 MB) con `assets/brain3d.min.js`
  (three.js, carga diferida). Sin WebGL o con *reduced motion* muestra la imagen.
* **Equipo de agentes** (`#equipo`): lee `agents-status.json`, que actualiza el workflow
  `Agentes 24/7 (sitio)` (solo datos).

## Equipo de agentes 24/7

`.github/workflows/agentes-web.yml` corre 4 veces por día (y a mano). Usa GitHub Models con el
`GITHUB_TOKEN` del workflow, elige roles en rotación y abre PRs con etiqueta `agente/<rol>` limitadas a
rutas seguras (HTML de texto, CSS, `app/i18n.js`). No agrega scripts, no toca workflows ni `CNAME`.
**Auto-merge apagado**: cada PR se revisa y aprueba a mano (variable `AGENTS_AUTO_MERGE=true` lo activa).
El job `estado` actualiza `agents-status.json` en `main` y pide una reconstrucción de Pages.

## Páginas

| Ruta | Archivo |
| --- | --- |
| `/` | `index.html` (hero, chat conversacional embebido, cerebro 3D y equipo de agentes) |
| `/app/` | `app/index.html` (app de chat y agente) |
| `/planes` | `planes.html` |
| `/como-funciona` | `como-funciona.html` |
| `/nosotros` | `nosotros.html` |
| cualquier otra | `404.html` |

## Modo demostración y backend

Toda la comunicación con el servidor pasa por `assets/agentic-static.js`.
Arriba de ese archivo está la única constante a configurar:

```js
const API_BASE = "";   // vacío = modo demostración local
// const API_BASE = "https://api.agenticuantico.dev.ar";  // backend real
```

* **Vacío (por defecto):** ninguna llamada `/api/*` sale a la red. El chat responde en el
  navegador con información pública (qué es AgentiCuantico, cómo funciona, planes, agentes y
  contacto) y muestra ejemplos de código con el mismo formato del sitio original. Login,
  registro, integraciones y pagos muestran un aviso de "próximamente".
* **Con URL:** cada `/api/...` se envía a `API_BASE + /api/...` con cookies incluidas. El
  backend debe permitir CORS desde `https://agenticuantico.dev.ar`.

## Publicación (GitHub Pages)

1. Settings → Pages → Source: *Deploy from a branch* → `main` / root.
2. Dominio personalizado: `agenticuantico.dev.ar` (archivo `CNAME`).
3. DNS: registro `CNAME` de `agenticuantico.dev.ar` hacia `<usuario>.github.io`
   (o registros `A` del apex hacia las IP de GitHub Pages) y activar *Enforce HTTPS*.

La versión anterior del sitio quedó guardada en la rama `nueva-version`.

## Probar localmente

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

(Con `http.server` las rutas sin `.html`, como `/planes`, no resuelven; GitHub Pages sí las resuelve.)

Contacto: agenticuantico@gmail.com

## App de chat y agente (`/app/`)

Aplicación completa en `app/` (HTML + CSS + JS sin dependencias ni build):

* Barra lateral plegable (cajón en móvil) con **Nuevo chat**, **Buscar chats** (Ctrl K),
  **Tarea de agente**, **Proyectos** e historial agrupado en Hoy / Ayer / 7 días / 30 días.
* Saludo centrado y compositor redondeado con adjuntar (+), herramientas, dictado por voz,
  **modo voz** manos libres y enviar / detener.
* Selector de modo arriba: **AgentiCuántico Rápido**, **Razonamiento profundo** y **Agente**.
* Respuestas en streaming token a token con Markdown, tablas y bloques de código con botón
  copiar; por mensaje: copiar, me gusta / no me gusta, leer en voz alta, regenerar; editar el
  mensaje del usuario.
* **Modo Agente**: tarjeta de tarea con el plan paso a paso y fases (Pensando → Buscando →
  Escribiendo código → Verificando), panel lateral **Computadora del agente** (plan, terminal y
  archivos con vista previa) y tarjetas de entregables descargables.
* Compartir conversación por enlace, configuración (tema claro/oscuro/sistema, idioma ES/EN/PT,
  voz femenina por idioma con banderas, exportar o borrar datos, estado de conexiones), menú de cuenta,
  inicio de sesión por email/Google y planes Gratis / Pro / Empresa
  (Mercado Pago en ARS 15.600 / 46.800, PayPal en USD 10 / 30).
* Conversaciones guardadas en `localStorage` del navegador.

### Conexión con el servidor

`app/config.js` define `API_BASE` (por defecto `https://api.agenticuantico.dev.ar`). Al abrir la
app se hace `GET {API_BASE}/api/health` con 3 s de límite:

* **Responde OK** → chat por `/api/chat` (SSE), agente por `/api/agent/run` (SSE), cuenta por
  `/api/auth/*` y pagos por `/api/billing/*`. Configuración → Conexión muestra qué conector está
  activo según la respuesta de `/api/health`.
* **No responde / falla** → **modo demo** local (chip "modo demo"): FAQ, ejemplos de código,
  calculadora y un agente simulado con plan, pasos y archivos. Nunca muestra errores; si el
  servidor falla a mitad de una respuesta, la app sigue en modo demo.
* `/app/?demo=1` fuerza el modo demo. `/app/?mode=agent` abre en modo Agente y `/app/?q=texto`
  precarga el mensaje.
