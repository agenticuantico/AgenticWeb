# Ordenador autónomo de AgentiCuántico — foco de producto y ejecución

## Objetivo

Convertir el ordenador virtual en el espacio de trabajo principal del CEO Agent: una sesión de cómputo remota real, visible y controlable por la persona, no una animación ni una maqueta de escritorio. El chat y la voz son el mando; el ordenador es el entorno donde se ejecutan las tareas.

## Estado comprobado en AgenticWeb

La rama ya contiene una capa visual propia de escritorio (assets/js/chat/computer-desktop.js) con ventanas, barra de tareas, reloj y aplicaciones de Navegador, Archivos, Tareas y Actividad. agent-browser.js conecta esa interfaz con endpoints /api/agent/browser/*, muestra capturas reales, eventos de puntero, pasos, archivos, aprobaciones y modo de control manual. También hay un panel de acceso desde el chat (computer-panel.js).

Importante: esa implementación actual es un navegador remoto automatizado dentro de una carcasa de escritorio. No demuestra todavía que exista un sistema operativo remoto de propósito general con terminal, procesos, instalación/ejecución de aplicaciones o acceso a un escritorio Linux/Windows completo. La interfaz debe decirlo con claridad hasta que se implemente esa capa real.

## Arquitectura objetivo

1. CEO Agent / planificador
   - Recibe instrucciones del chat o de la voz, conserva el contexto de la conversación y crea un plan verificable.
   - Decide si una tarea necesita navegador, terminal, archivos o una combinación.
   - Asigna subtareas a especialistas (desarrollo, investigación, diseño, QA y seguridad) y consolida resultados.
   - Expone cada paso, herramienta, agente asignado, resultado y error en Actividad.

2. Computer Runtime aislado
   - Crear una sesión efímera por usuario/tarea en un contenedor o microVM aislado.
   - Runtime Linux inicial recomendado por portabilidad; navegador Chromium y terminal disponibles dentro de la sesión.
   - Directorios separados: /workspace para archivos del usuario, /tmp efímero y almacenamiento persistente explícitamente autorizado.
   - Límites de CPU, RAM, disco, tiempo, red y procesos; destruir o suspender sesiones al vencer el tiempo.
   - No montar secretos, repositorios privados ni credenciales en el entorno salvo autorización de alcance limitado.

3. Pantalla y control interactivo
   - Transmitir frames reales del escritorio mediante WebRTC cuando esté disponible; fallback eficiente por capturas incrementales.
   - Canal de entrada autenticado para mouse, teclado, scroll, portapapeles y redimensionamiento.
   - Mantener coordenadas normalizadas y asociadas al frame mostrado para evitar clics desplazados.
   - El usuario puede tomar el control, devolverlo al agente, pausar, reanudar, minimizar y restaurar sin perder la sesión.
   - En móvil: controles táctiles, teclado virtual, botones accesibles y vista adaptable; no simular acciones que no llegaron al runtime.

4. Aplicaciones del escritorio
   - Navegador: pestañas, barra de direcciones, navegación, descargas y permisos por dominio.
   - Archivos: árbol de /workspace, vista previa segura, carga y descarga con límites de tamaño y tipos.
   - Terminal: comandos visibles, salida en vivo, cancelación y límites; comandos destructivos o con efectos externos requieren aprobación.
   - Editor: edición de archivos con diff, vista previa y opción de revertir.
   - Actividad: historial auditable y exportable de acciones y artefactos.
   - GitHub: trabajar en ramas, mostrar diffs, ejecutar pruebas y abrir PR; nunca publicar en main por defecto.

5. Servicios persistentes
   - Cola de trabajos, almacenamiento de sesiones/eventos, reintentos idempotentes, heartbeat, recuperación y limpieza.
   - Worker persistente para tareas largas; los cron de GitHub Actions no sustituyen un runtime 24/7.
   - Observabilidad: latencia, sesiones activas, fallos, consumo por usuario y alertas.
   - Cuotas por plan y límites globales para impedir abuso o costes inesperados.

## Seguridad y aprobaciones

- OAuth o perfiles de navegador aislados para iniciar sesión. Nunca pedir contraseñas, códigos OTP ni tarjetas en el chat.
- Credenciales cifradas en un vault del servidor; el agente no recibe el valor en texto plano y los logs deben redactarlo.
- Confirmación explícita antes de comprar, pagar, enviar mensajes, publicar, postularse, borrar datos, cambiar permisos o desplegar.
- Mostrar el destino, resumen de la acción y consecuencias antes de pedir aprobación.
- Aprobación vinculada a una sola acción y con vencimiento; no reutilizar un consentimiento antiguo.
- Lista de dominios permitidos/bloqueados, protección SSRF, aislamiento de red y escaneo de archivos.
- Botón global Detener que cancela el agente y los procesos de la sesión.

## Plan de implementación

### F0 — Inventario y contrato de runtime
- Documentar endpoints actuales de navegador, estados, eventos, archivos y aprobaciones.
- Definir interfaz común ComputerSession: create, status, stream, input, exec, files, pause, resume, stop, destroy.
- Mantener el navegador remoto existente como adaptador inicial, sin romper compatibilidad.

### F1 — Sesión real de escritorio
- Provisionar runtime aislado por usuario.
- Abrir un escritorio remoto real con Chromium y terminal.
- Implementar stream de pantalla y canal de entrada con autenticación, expiración y reconexión.
- Integrar el ciclo de vida con la barra de tareas y el botón Detener.

### F2 — Herramientas de trabajo
- Conectar navegador, terminal, archivos y editor al mismo /workspace.
- Añadir diff/preview antes de aplicar cambios y rollback.
- Conectar GitHub mediante permisos mínimos y ramas de trabajo.

### F3 — CEO Agent y agentes especialistas
- Planificar y delegar tareas con contratos de entrada/salida.
- Ejecutar pruebas y revisión de seguridad antes de devolver resultados.
- Permitir trabajos en cola y reanudables, con límites y auditoría.

### F4 — Operación continua
- Desplegar workers persistentes, cola, base de datos, monitorización y alertas.
- Probar recuperación ante caída de red, reinicio del runtime y vencimiento de sesión.
- Declarar disponibilidad 24/7 solo después de pruebas y monitorización reales.

## Criterios de aceptación

- El agente y la persona ven la misma pantalla real; los clics y teclas se reflejan en el runtime y sus resultados.
- La persona puede alternar entre control del agente y control manual, sin perder contexto.
- Navegador, terminal y archivos operan sobre el mismo espacio de trabajo aislado.
- Cada tarea deja pasos, eventos, diffs y artefactos verificables.
- Detener cancela de verdad la ejecución y libera recursos.
- Pruebas en Android móvil y escritorio: rotación, pérdida/recuperación de red, teclado, toque, minimización, restauración y sesión vencida.
- Las acciones externas sensibles siempre se detienen antes de ejecutarse hasta recibir aprobación específica.
- Ninguna funcionalidad se presenta como completa si solo existe su representación visual.

## Prioridad inmediata

Antes de añadir más decoración al escritorio, verificar el contrato y disponibilidad real de los endpoints del navegador; después definir y conectar el primer runtime remoto general con pantalla + teclado/mouse + terminal. La carcasa visual existente se reutiliza, no se duplica.