# AgentiCuántico — plan de evolución incremental

Esta rama mantiene la aplicación estática actual como base. No reemplaza la portada, el chat, la voz ni las rutas existentes y no publica cambios en producción.

## Experiencia colaborativa en tiempo real
- El chat sigue siendo el centro de mando: el usuario conversa por texto o voz y el agente presenta el plan, el paso activo, los resultados y la siguiente decisión.
- Las tareas largas se muestran como actividad en vivo (plan, ejecución, archivos, vista previa y registro), con pausa, reanudación y cancelación.
- Las acciones con impacto externo requieren confirmación explícita; publicar, comprar, enviar, borrar o modificar cuentas no se ejecuta por inferencia.
- El compositor conserva el historial y los modos actuales; los estados de escucha, razonamiento, ejecución y voz se anuncian de forma accesible.

## Estudio creativo
Añadir al chat una herramienta de creación con dos flujos distintos:
1. **Imagen**: generar desde texto, editar una imagen adjunta, variar estilo y tamaño, previsualizar y descargar.
2. **Vídeo**: generar clips cuando exista un proveedor habilitado; mostrar duración, resolución, límites y coste antes de iniciar.

La interfaz debe usar adaptadores de proveedor en backend. No se debe prometer que un modelo o repositorio de GitHub es gratuito, estable o apto para producción sin comprobar licencia, hardware, cuotas y condiciones. Los modelos locales/de código abierto pueden ser una opción, pero requieren recursos de ejecución. Nunca exponer claves API en el navegador.

## CEO Agent y agentes especialistas
- CEO Agent: interpreta el objetivo, descompone tareas, asigna agentes y consolida resultados.
- Especialistas iniciales: desarrollo, diseño, investigación, navegador, seguridad y contenido.
- Cada tarea guarda objetivo, agente, estado, eventos, artefactos y resultado verificable.
- Aprendizaje operativo: usar evaluaciones y memoria de proyecto autorizada; no auto-modificar modelos ni permisos por sí solo.
- Trabajo continuo 24/7: requiere un worker/backend persistente, cola de tareas, base de datos, límites de uso, monitorización y alertas. GitHub Actions programado no equivale a un ordenador autónomo permanente.

## Integraciones y seguridad
- GitHub: leer repositorios, proponer cambios en ramas y abrir PRs; nunca escribir directamente en main o producción por defecto.
- TinyFish: navegador aislado con permisos por tarea; credenciales y OTP se introducen en el sitio oficial del proveedor mediante OAuth o un flujo seguro, nunca en el chat ni en logs.
- Floot: usarlo como constructor cuando haya un proyecto accesible y se confirme el alcance; no duplicar el sitio existente.
- Imágenes/vídeo: credenciales solo del lado servidor, validación de archivos, límites de tamaño, moderación y cuotas.

## Criterios de aceptación
- La experiencia actual sigue funcionando en móvil y escritorio.
- El usuario puede hablar y escribir mientras ve el estado de la tarea actualizarse.
- Puede solicitar generar/editar imágenes y, si hay proveedor disponible, vídeos.
- Se muestra una vista previa antes de aplicar cambios.
- Las acciones sensibles requieren aprobación específica.
- Las pruebas se ejecutan en esta rama y la publicación queda pendiente de aprobación humana.

## Inventario técnico verificado en la rama
La revisión del código existente encontró componentes reutilizables que deben integrarse y probarse antes de crear duplicados:
- `assets/js/companion/call.js`: página de llamada manos libres; solicita permiso de micrófono, controla silencio activando/desactivando la pista de audio y permite finalizar la llamada. La llamada tiene gestión de cuota y estados propios.
- `assets/js/chat/voice.js`: salida de voz, selección de voz y eventos `ac-speech` para sincronización labial; la voz española prioriza síntesis del servidor y puede quedar solo en texto si el servicio no responde.
- `assets/js/chat/avatar-call.js`: ventana flotante arrastrable, ampliable y cerrable que aloja el avatar.
- `assets/js/chat/avatar.js` y `agent-avatar.js`: rig visual con estados, visemas y gestos de brazos/manos; respeta la preferencia de movimiento reducido.
- `assets/js/chat/recorder.js`: grabación de notas de voz con medidor, transcripción opcional y liberación de recursos.

### Brechas que siguen abiertas (no marcarlas como terminadas)
1. Unificar la llamada manos libres con el chat principal, conservando contexto e historial y permitiendo minimizar/restaurar sin perder la sesión.
2. Probar en Android real los estados de micrófono silenciado/escuchando y la reproducción de audio; revisar permisos, interrupciones y limpieza de pistas.
3. Confirmar si el avatar humanoide GLB es el personaje final o si el rig 2D por capas sigue siendo la representación activa; validar gestos en móvil y accesibilidad.
4. Implementar el estudio creativo conectado a un proveedor real de imágenes y, por separado, uno de vídeo; mostrar disponibilidad, cuotas y costos reales.
5. Implementar ejecución de tareas persistentes con cola, almacenamiento de eventos, reintentos, límites, alertas y controles de pausa/cancelación. No afirmar 24/7 hasta desplegar y monitorizar esa infraestructura.
6. Ejecutar pruebas automatizadas y pruebas manuales de móvil/escritorio; revisar la vista previa antes de cualquier publicación.

Este inventario es una inspección de código, no una certificación de funcionamiento en producción. Cada punto requiere pruebas de integración y evidencia reproducible.
