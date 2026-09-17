# Frontend integration contract

`AgenticWeb` consume exclusivamente respuestas públicas y filtradas del backend privado.

## Requisitos
- No almacenar secretos en el navegador.
- No llamar directamente a proveedores de modelos o pagos desde el cliente.
- Gestionar estados `queued`, `running`, `awaiting_approval`, `completed`, `failed` y `cancelled`.
- Mostrar fuentes y advertencias cuando existan.
- Aplicar autorización del lado servidor para cada acción protegida.
- Implementar estados de error y degradación accesible.

## Integración futura
La URL del backend debe configurarse mediante variables de entorno públicas que solo contengan un endpoint proxy seguro; las credenciales permanecen exclusivamente en el backend.
