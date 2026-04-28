# 🧪 Guía de Testing - Swagger UI

Esta guía te muestra cómo probar todos los endpoints usando **Swagger UI** (documentación interactiva).

## 🚀 Iniciar la API

```bash
npm run start:dev
```

Verás en consola:
```
✅ API ejecutando en http://localhost:3000
📚 Documentación Swagger en http://localhost:3000/api/docs
```

## 📖 Acceder a Swagger

1. Abre tu navegador
2. Ve a: `http://localhost:3000/api/docs`
3. ¡Verás todos los endpoints documentados en español!

---

## 📋 Flujo Completo de Testing

### PASO 1️⃣ - Crear una Empresa (Tenant)

**Endpoint:** `POST /tenants`

En Swagger:
1. Click en `Tenants` → `POST /tenants`
2. Click en "Try it out"
3. En el JSON, coloca:
```json
{
  "name": "Barbería El Corte",
  "whatsapp_number": "+541234567890"
}
```
4. Click "Execute"

**Respuesta esperada (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Barbería El Corte",
  "whatsapp_number": "+541234567890",
  "created_at": "2026-04-11T15:30:00Z"
}
```

📝 **Guarda el ID** - lo necesitarás en los próximos pasos

---

### PASO 2️⃣ - Crear Regla de Disponibilidad

**Endpoint:** `POST /availability`

1. Abre `Availability` → `POST /availability`
2. Click "Try it out"
3. Ingresa (reemplaza `tenant_id` con el ID de arriba):
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "slot_duration": 30
}
```

**Notas:**
- `day_of_week`: 0=domingo, 1=lunes, 2=martes, ..., 6=sábado
- `start_time` y `end_time` en formato HH:MM
- `slot_duration` en minutos (30, 60, 90, etc)

4. Execute

---

### PASO 3️⃣ - Obtener Horarios Disponibles (EL CORE!)

**Endpoint:** `GET /availability/slots`

1. Click en `Availability` → `GET /availability/slots`
2. Click "Try it out"
3. Completa los parámetros:
   - `tenantId`: El ID que guardaste en PASO 1
   - `date`: Una fecha futura (ej: `2026-04-14` - debe ser lunes!)

4. Execute

**Respuesta esperada:**
```json
[
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30"
]
```

✅ **¡Este es el core de tu producto!**

---

### PASO 4️⃣ - Crear Turno

**Endpoint:** `POST /appointments`

1. Click en `Appointments` → `POST /appointments`
2. Click "Try it out"
3. Ingresa:
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-04-14",
  "time": "10:30",
  "client_phone": "+541234567890",
  "client_name": "Juan García"
}
```

4. Execute

**Respuesta esperada (201):**
```json
{
  "id": "appointment-uuid-xxx",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_id": "client-uuid-xxx",
  "date": "2026-04-14",
  "time": "10:30",
  "status": "pending",
  "created_at": "2026-04-11T15:35:00Z"
}
```

📝 **Guarda el appointment ID**

---

### PASO 5️⃣ - Verificar que el Slot Ya No Está Disponible

1. Vuelve a `GET /availability/slots` con los mismos parámetros
2. Notarás que `10:30` **ya no aparece** en la lista

✅ **¡La lógica de concurrencia funciona!**

---

### PASO 6️⃣ - Confirmar Turno

**Endpoint:** `PATCH /appointments/:id/confirm`

1. Click en `Appointments` → `PATCH /appointments/{id}/confirm`
2. Click "Try it out"
3. En el parámetro `id`, coloca el appointment ID que guardaste en PASO 4
4. Execute

**Respuesta esperada:**
```json
{
  "id": "appointment-uuid-xxx",
  "status": "confirmed",
  "..."
}
```

---

### PASO 7️⃣ - Cancelar Turno (Libera el Slot)

**Endpoint:** `PATCH /appointments/:id/cancel`

1. Click en `Appointments` → `PATCH /appointments/{id}/cancel`
2. Click "Try it out"
3. Ingresa el appointment ID
4. Execute

**Resultado:** El status cambia a `cancelled`

---

### PASO 8️⃣ - Bloquear un Horario

**Endpoint:** `POST /blocked-slots`

1. Click en `Blocked Slots` → `POST /blocked-slots`
2. Click "Try it out"
3. Ingresa:
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-04-14",
  "time": "13:00",
  "reason": "Almuerzo"
}
```

4. Execute

---

### PASO 9️⃣ - Verificar que el Horario Bloqueado No Sale en Disponibles

1. Vuelve a `GET /availability/slots`
2. Verás que `13:00` ya no aparece (bloqueado)

✅ **¡Todo funciona correctamente!**

---

## 🎮 Casos de Uso Avanzados

### Test: Intentar Reservar un Slot Ocupado

1. Crea 2 turnos en el mismo horario:
   - Primer turno: 10:30 ✅ (debería funcionar)
   - Segundo turno: 10:30 ❌ (debería fallar con 409 Conflict)

**Respuesta esperada (409):**
```json
{
  "statusCode": 409,
  "message": "Appointment already exists for this slot"
}
```

---

### Test: Slots sin Disponibilidad

1. Crea una regla de disponibilidad para un día diferente (ej: domingo)
2. Intenta obtener slots para ese domingo: debería devolver `[]`

---

### Test: Multi-Tenant

1. Crea 2 empresas diferentes
2. Crea reglas y turnos para cada una
3. Verifica que los datos estén aislados (cada tenant solo ve sus datos)

---

## 🐛 Debugging

### Ver los Logs

Cuando ejecutas `npm run start:dev`, verás logs en consola:
```
[Nest] 12345 - 04/11/2026, 3:30:15 PM   LOG [NestFactory] Starting Nest application...
[Nest] 12345 - 04/11/2026, 3:30:15 PM   LOG [InstanceLoader] AppModule dependencies initialized...
```

### Ver Request/Response

El `WhatsappService` logea todos los webhooks para debugging:
```javascript
this.logger.debug('Incoming WhatsApp webhook:', JSON.stringify(body, null, 2));
```

---

## 🚀 Próximos Pasos

Después de testear en Swagger:

1. **Integración con WhatsApp:**
   - Configura ngrok: `ngrok http 3000`
   - Usa esa URL como Callback en WhatsApp Business

2. **Frontend:**
   - Crea una web app que consuma estos endpoints
   - Usa el formulario para agendar turnos

3. **Automatización:**
   - Implementa el flujo conversacional en WhatsApp
   - Confirmación automática de turnos

---

## 📞 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| API no inicia | Puerto 3000 en uso | Cambia PORT en .env |
| Error DB connection | PostgreSQL no corre | `pg_ctl start` o Docker |
| 400 Bad Request | Falta un parámetro | Revisa el JSON en Swagger |
| 409 Conflict | Slot ya reservado | Obtén slots nuevamente |
| 404 Not Found | ID no existe | Verifica el UUID |

---

**¡Listo para testear! Abre http://localhost:3000/api/docs** 🚀
