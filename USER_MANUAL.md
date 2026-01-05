# Manual de Usuario y Configuración - App Ezeiza

Este sistema es un dashboard de monitoreo en tiempo real para el estado de sensores/tarjetas en el aeropuerto, visualizando métricas por zonas (Checkin, Arribos, etc.) y ubicación en mapas.

## 1. Requisitos Previos

- **Node.js:** Versión 14 o superior.
- **MongoDB:** Instancia local o en la nube (Atlas). Para funcionalidad en tiempo real óptima, se requiere un Replica Set.
- **Navegador Web:** Chrome, Firefox o Edge actualizado.

## 2. Instalación

1. Clonar el repositorio o descargar el código fuente.
2. Abrir una terminal en la carpeta raíz `App_Ezeiza`.
3. Instalar las dependencias:
   ```bash
   npm install
   ```

## 3. Configuración (.env)

Cree un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Puerto del servidor (por defecto 3000)
PORT=3000

# Entorno (development o production)
NODE_ENV=development

# Secreto para firmar las sesiones (cadena aleatoria segura)
SESSION_SECRET=mi_secreto_super_seguro

# Cadena de conexión a MongoDB
MONGO_URI=mongodb://localhost:27017/nombre_base_datos

# (Opcional) Configuración SSL para HTTPS
# SSL_KEY_PATH=/ruta/a/privkey.pem
# SSL_CERT_PATH=/ruta/a/fullchain.pem
```

## 4. Ejecución

### Modo Desarrollo (con logs detallados)
```bash
npm start
# O si usa nodemon:
npx nodemon index.js
```

### Modo Producción
Asegúrese de establecer `NODE_ENV=production` en el archivo `.env`.
```bash
node index.js
```

## 5. Uso de la Aplicación

### Acceso
1. Navegue a `http://localhost:3000` (o el puerto configurado).
2. Si es la primera vez, deberá iniciar sesión (según la configuración de `authRoutes`).

### Dashboard Principal
- **Tarjetas de Estado:** Muestra contadores y porcentajes de ocupación.
- **Mapa:** Visualización geográfica de los sensores.
- **Actualización:**
    - Los datos se actualizan automáticamente sin recargar la página.
    - Si hay cambios en la base de datos, se reflejan instantáneamente (WebSockets).
    - Si la conexión es inestable, el sistema consultará datos cada 10 segundos automáticamente.

### Solución de Problemas Comunes

- **No se actualizan los datos en tiempo real:**
  - Verifique que su MongoDB esté configurado como Replica Set (necesario para Change Streams).
  - Revise la consola del navegador (F12) para ver errores de conexión WebSocket.

- **Error de Certificados SSL:**
  - Verifique que las rutas en `SSL_KEY_PATH` y `SSL_CERT_PATH` sean absolutas y correctas.