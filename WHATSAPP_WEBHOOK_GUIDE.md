# WhatsApp Business API - Webhook Setup Guide

Esta guía te muestra cómo configurar y probar los webhooks de WhatsApp Business API con tu API de turnos.

## 1. Endpoint del Webhook

La API tiene un endpoint para recibir mensajes de WhatsApp:

```
POST /appointments/webhook
```

## 2. Validación del Webhook (GET request)

WhatsApp Business API envía un GET request para validar el webhook:

```
GET /appointments/webhook?mode=subscribe&verify_token=YOUR_VERIFY_TOKEN&challenge=CHALLENGE_STRING
```

**Qué hace:**
- Tu API debe responder con el `challenge` si el `verify_token` coincide
- El token debe estar en tu `.env` como `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

**Respuesta esperada:**
```
200 OK
{challenge}
```

## 3. Configurar WhatsApp Business API

### Pasos:
1. Ve a [Facebook Developers](https://developers.facebook.com)
2. Crea una app de WhatsApp Business
3. Ve a **Configuration** → **Webhooks**
4. Configura:
   - **Callback URL**: `https://tudominio.com/appointments/webhook`
   - **Verify Token**: El mismo valor que en `.env` (WHATSAPP_WEBHOOK_VERIFY_TOKEN)
5. Suscríbete a eventos: `messages`, `message_status`, `read_receipts`

## 4. Flujo de Mensaje Entrante

Cuando WhatsApp envía un mensaje:

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "type": "text",
                "from": "1234567890",
                "text": {
                  "body": "Hola, quiero agendar turno"
                }
              }
            ],
            "contacts": [
              {
                "profile": {
                  "name": "Juan"
                },
                "wa_id": "1234567890"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Tu API:**
1. Recibe el mensaje
2. Parsea el contenido
3. Procesa la solicitud (crear turno, confirmar, etc.)
4. Responde a WhatsApp

## 5. Estructura de Flujos en WhatsApp

Tu WhatsApp bot podría seguir este flujo:

```
Usuario: "Hola"
Bot: "¿Qué servicio necesitas?" (Button List con servicios)

Usuario: "Servicio A"
Bot: "¿Qué día?" (Date Picker)

Usuario: "2026-04-15"
Bot: "¿Qué horario?" (Button List con slots disponibles)
  → GET /availability/slots?tenantId=X&date=2026-04-15
  → Response: ["09:00", "09:30", "10:00", ...]

Usuario: "09:30"
Bot: Crea el turno
  → POST /appointments {
      tenant_id: "X",
      date: "2026-04-15",
      time: "09:30",
      client_phone: "+1234567890",
      client_name: "Juan"
    }
  → Response: { id, status: "pending", ... }
Bot: "¡Turno confirmado! #12345"
```

## 6. Testing Local (ngrok)

Para probar localmente con WhatsApp:

```bash
# 1. Instala ngrok
npm install -g ngrok

# 2. Inicia tu API
npm run start:dev

# 3. En otra terminal, expone tu puerto
ngrok http 3000

# 4. Verás algo como: https://abc123.ngrok.io
# Usa esa URL como tu Callback URL en WhatsApp

# 5. Configura el verify token en .env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto

# 6. WhatsApp Bot hace GET a:
# https://abc123.ngrok.io/appointments/webhook?mode=subscribe&verify_token=mi_token_secreto&challenge=TEST_CHALLENGE
```

## 7. Variables de Entorno Necesarias

```env
# WhatsApp
WHATSAPP_API_TOKEN=tu_access_token_aqui
WHATSAPP_PHONE_ID=tu_phone_id_aqui
WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu_verify_token_secreto
```

## 8. Próximos Pasos

- [ ] Implementar lógica de procesamiento de mensajes en `WhatsappService`
- [ ] Crear conversación flow (states, menus, etc.)
- [ ] Enviar mensajes back a WhatsApp
- [ ] Manejo de errores y logging
- [ ] Testing end-to-end

## 9. Recursos

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Webhook Events Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example)
- [Testing with ngrok](https://ngrok.com/docs)
