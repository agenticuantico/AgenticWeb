# AgentiCuantico · sitio público

Sitio estático de **agenticuantico.dev.ar** con el diseño original: encabezado con orbe cuántico,
hero con la super inteligencia de cerebro dorado y red neuronal animada, y chat
"AgentiCuantico · Super Inteligencia".

## Páginas

| Ruta | Archivo |
| --- | --- |
| `/` | `index.html` (hero + chat; "empezar a conversar" abre `/app/`) |
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
  voz Femenina/Masculina, exportar o borrar datos, estado de conexiones), menú de cuenta,
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
