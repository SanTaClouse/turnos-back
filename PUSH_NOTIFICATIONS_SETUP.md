# Configuración de Notificaciones Push

## Requisitos

Las notificaciones push requieren claves VAPID (Voluntary Application Server Identification). Estos son estándares para Web Push Notifications.

## Generar Claves VAPID

1. Instala la herramienta `web-push`:
```bash
npm install -g web-push
```

2. Genera las claves:
```bash
web-push generate-vapid-keys
```

Esto te dará una salida como:
```
Public Key: ...
Private Key: ...
```

## Configuración en el Servidor

### 1. Variables de Entorno

Agrega las siguientes variables a tu `.env` o en Render:

```env
VAPID_PUBLIC_KEY=<tu-clave-publica>
VAPID_PRIVATE_KEY=<tu-clave-privada>
VAPID_SUBJECT=mailto:admin@turno1min.app
```

### 2. Frontend (Vercel)

También necesitas la clave pública en el frontend:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<tu-clave-publica>
```

## Flujo de Notificaciones

1. **Subscripción** - Admin abre la app y presiona el botón de habilitar notificaciones
2. **Almacenamiento** - Frontend envía la suscripción al backend via `POST /notifications/subscribe`
3. **Notificación** - Cuando se crea un turno, backend envía push a todas las suscripciones del tenant
4. **Icono** - Asegúrate de que existan `/public/icon-192x192.png` y `/public/badge-72x72.png`

## Instalación de web-push (Backend)

Ya está instalado en `package.json`. Si no, instala:

```bash
npm install web-push
npm install --save-dev @types/web-push
```

## Pruebas

Para probar en desarrollo:

1. Abre la app en `http://localhost:3001/admin/agenda`
2. Presiona el botón de campana (arriba a la derecha)
3. Autoriza las notificaciones
4. Crea un nuevo turno desde la app
5. Deberías recibir una notificación push en tu navegador

## Solución de Problemas

### "Push notifications not supported"
- Asegúrate de estar usando HTTPS (requiere certificado en production)
- En desarrollo local, funciona con HTTP
- El navegador debe soportar Service Workers y Push API (Chrome, Firefox, Edge)

### "Notification permission denied"
- Usuario debe permitir notificaciones en el navegador
- Puede cambiar la configuración en las preferencias del navegador

### "Error sending push"
- Verifica que VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY están configuradas
- Verifica que VAPID_SUBJECT es un email válido

### Suscripciones expiradas
- El servidor automáticamente limpia las suscripciones que devuelven 410 (Gone)
- Cuando el usuario cierra la app, la suscripción puede cambiar

## URLs de Iconos

Los iconos que se muestran en la notificación deben estar en:
- `/public/icon-192x192.png` - Icono principal
- `/public/badge-72x72.png` - Badge pequeño

Si no existen, usa los mismos que ya tienes en el manifest.
