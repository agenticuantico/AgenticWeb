# Límites del frontend

La aplicación web:
- Consume únicamente endpoints públicos o de sesión autorizada.
- No contiene claves privadas, tokens de proveedores, prompts internos ni credenciales.
- No ejecuta herramientas del cerebro directamente desde el navegador.
- Presenta estados de tarea, fuentes y errores sin revelar información interna.
- Debe aplicar controles de accesibilidad, protección de sesión, CSP y políticas de contenido.

Las integraciones de pago y las operaciones administrativas sensibles se ejecutan en el backend, con verificación de webhooks, idempotencia y autorización en servidor.
