# Informe de Auditoría y Análisis Estático - App Ezeiza

**Fecha:** Actualidad
**Archivo Analizado:** `index.js`
**Estado General:** Estable, con oportunidades de optimización en escalabilidad.

## 1. Seguridad

| Categoría | Estado | Observaciones |
|-----------|--------|---------------|
| **Headers HTTP** | ✅ Aprobado | Se utiliza `helmet` correctamente. La Content Security Policy (CSP) está configurada para permitir scripts de `unpkg.com` (probablemente para Leaflet/Mapas) y conexiones WebSocket. |
| **SSL/TLS** | ✅ Aprobado | Lógica condicional correcta para levantar servidor HTTPS si existen certificados en variables de entorno. |
| **Sesiones** | ✅ Aprobado | `express-session` configurado con `httpOnly: true`. La flag `secure` depende de `NODE_ENV`, lo cual es correcto. |
| **Inyección NoSQL** | ⚠️ Precaución | Se parsea `userApp` a `parseInt` antes de consultar, lo cual mitiga riesgos básicos, pero se debe asegurar que `processCartData` maneje datos malformados. |

## 2. Rendimiento y Escalabilidad

| Componente | Hallazgo | Recomendación |
|------------|----------|---------------|
| **WebSockets & MongoDB** | ⚠️ Cuello de botella potencial | Actualmente, se abre un `changeStream` de MongoDB **por cada cliente conectado**. Si hay 100 usuarios, habrá 100 conexiones de monitoreo a la BD. | **Solución:** Implementar un patrón Singleton o un "Watcher Global" en el servidor que emita a una sala de Socket.io, en lugar de crear un watcher por socket. |
| **Polling (Fallback)** | ✅ Aprobado | El sistema tiene un fallback inteligente: si falla el Change Stream, cambia a `setInterval` (polling) cada 10s. |
| **Archivos Estáticos** | ✅ Aprobado | Se sirven correctamente desde `src/views/publics`. |

## 3. Calidad de Código

- **Manejo de Errores:** Existen bloques `try/catch` en las funciones asíncronas críticas dentro del socket.
- **Modularización:** La lógica de base de datos y utilidades está separada (`src/db/connection`, `src/utils/dashboardHelpers`), lo cual facilita el mantenimiento.
- **Logs:** Se utiliza `morgan` para logs HTTP, útil para depuración.

## 4. Pruebas de Lógica (Simuladas)

### Escenario A: Conexión de Cliente
1. **Input:** Cliente conecta vía Socket.io y emite `request_dashboard_data` con ID de app.
2. **Proceso:** Servidor valida ID, consulta MongoDB, procesa métricas de zonas.
3. **Output:** Emite evento `dashboard_update` con JSON estructurado.
4. **Resultado:** ✅ Comportamiento esperado.

### Escenario B: Caída de Base de Datos
1. **Evento:** Pérdida de conexión con MongoDB durante el `watch`.
2. **Manejo:** El evento `error` del stream cierra el stream y activa el intervalo de polling.
3. **Resultado:** ✅ Resiliencia alta. El usuario sigue recibiendo datos (aunque más lento).

## 5. Recomendaciones Finales

1. **Optimizar Watchers:** Mover el `cardsCollection.watch()` fuera del evento `connection` del socket para que sea una sola instancia global compartida.
2. **Validación de Entorno:** Agregar una validación al inicio (`process.env`) para asegurar que `SESSION_SECRET` y `MONGO_URI` existan antes de arrancar.
3. **Compresión:** Agregar middleware `compression` para reducir el tamaño de las respuestas JSON y estáticos.