# Espacio de trabajo GitHub desde el chat

## Propósito
El chat de AgenticWeb será la interfaz para solicitar lectura de código, análisis, creación de cambios y apertura de pull requests mediante AgentiCuantico.

## Reglas de seguridad
- El navegador no almacena tokens de GitHub.
- El frontend muestra estado, permisos, presupuesto, aprobación y trazabilidad.
- Las operaciones de escritura se presentan como una propuesta antes de ejecutarse.
- El backend valida el repositorio permitido y el SHA esperado.
- Las respuestas deben ocultar secretos, variables sensibles y datos internos.

## Funciones previstas
- Vincular cuenta mediante OAuth o GitHub App.
- Seleccionar repositorio y rama autorizados.
- Consultar archivos e incidencias.
- Solicitar cambios en una rama aislada.
- Revisar diff y aprobar la apertura de un pull request.
- Consultar el historial de tareas y cancelar ejecuciones activas.

## Nota
Los contratos de frontend no implican que el flujo esté operativo todavía. Se necesita implementar la API backend, autenticación, persistencia, UI del chat y pruebas de extremo a extremo.
