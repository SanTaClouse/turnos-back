# Turnos por WhatsApp - API Documentation

API para gestionar turnos de múltiples empresas de forma simple, rápida y eficiente.

## 🚀 Quick Start

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Ejecutar en desarrollo
npm run start:dev

# Build para producción
npm run build
npm run start:prod
```

## 📊 Architecture

```
Tenant (Empresa)
├── Availability (Reglas de disponibilidad por día)
├── Appointment (Turnos reservados)
├── Client (Clientes que reservan)
└── BlockedSlot (Horarios bloqueados)
```

---

## 🔌 Endpoints

### 1. TENANTS - Configurar Negocio

#### POST /tenants
Crear un nuevo tenant (empresa)

```json
{
  "name": "Barbería Juan",
  "whatsapp_number": "+541234567890"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Barbería Juan",
  "whatsapp_number": "+541234567890",
  "created_at": "2026-04-11T10:30:00Z"
}
```

#### GET /tenants
Obtener todos los tenants

#### GET /tenants/:id
Obtener un tenant específico

#### PATCH /tenants/:id
Actualizar un tenant

#### DELETE /tenants/:id
Eliminar un tenant

---

### 2. AVAILABILITY - Configurar Disponibilidad

#### POST /availability
Crear regla de disponibilidad para un día específico

```json
{
  "tenant_id": "uuid",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "12:00",
  "slot_duration": 30
}
```

**day_of_week:** 0=domingo, 1=lunes, 2=martes, ..., 6=sábado

**Response (201):**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "12:00",
  "slot_duration": 30
}
```

#### GET /availability/:tenantId
Obtener todas las reglas de disponibilidad de un tenant

#### DELETE /availability/:id
Eliminar una regla de disponibilidad

---

### 3. AVAILABILITY/SLOTS - 🔥 El Core

#### GET /availability/slots?tenantId=X&date=2026-04-15

Obtener TODOS los horarios disponibles para una fecha

**Query Params:**
- `tenantId`: ID del tenant
- `date`: Fecha en formato YYYY-MM-DD

**Response (200):**
```json
["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
```

**Process:**
1. ✅ Obtiene reglas de disponibilidad del día
2. ✅ Genera slots (ej: 09:00, 09:30, 10:00, ...)
3. ✅ Filtra turnos ocupados
4. ✅ Filtra horarios bloqueados
5. ✅ Devuelve slots disponibles

**Este es tu producto** 💥

---

### 4. APPOINTMENTS - Reservar y Gestionar Turnos

#### POST /appointments
Crear nueva reserva

```json
{
  "tenant_id": "uuid",
  "date": "2026-04-15",
  "time": "09:30",
  "client_phone": "+541234567890",
  "client_name": "Juan García"
}
```

**Validaciones:**
- ✅ Horario disponible
- ✅ Crea o encuentra cliente por teléfono
- ✅ UNIQUE constraint: un turno por tenant/date/time

**Response (201):**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "client_id": "uuid",
  "date": "2026-04-15",
  "time": "09:30",
  "status": "pending",
  "created_at": "2026-04-11T10:30:00Z"
}
```

**Errores:**
- `400` - Slot not available
- `409` - Appointment already exists for this slot

#### GET /appointments?tenantId=X
Obtener todos los turnos de un tenant

**Response (200):**
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "client": {
      "id": "uuid",
      "name": "Juan García",
      "phone": "+541234567890"
    },
    "date": "2026-04-15",
    "time": "09:30",
    "status": "pending"
  }
]
```

#### GET /appointments/:id
Obtener un turno específico

#### PATCH /appointments/:id/confirm
Confirmar un turno

**Response (200):**
```json
{
  "id": "uuid",
  "status": "confirmed",
  "...": "..."
}
```

#### PATCH /appointments/:id/cancel
Cancelar un turno (libera el horario)

---

### 5. BLOCKED-SLOTS - Bloquear Horarios

#### POST /blocked-slots
Bloquear un horario (admin)

```json
{
  "tenant_id": "uuid",
  "date": "2026-04-15",
  "time": "10:00",
  "reason": "Almuerzo"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "date": "2026-04-15",
  "time": "10:00",
  "reason": "Almuerzo"
}
```

#### GET /blocked-slots?tenantId=X
Obtener todos los horarios bloqueados

#### DELETE /blocked-slots/:id
Eliminar un bloqueo

---

### 6. WHATSAPP WEBHOOK

#### POST /appointments/webhook
Recibir mensajes de WhatsApp

**WhatsApp envía (POST):**
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
                "from": "+541234567890",
                "text": {"body": "Hola"}
              }
            ],
            "contacts": [
              {
                "profile": {"name": "Juan"},
                "wa_id": "541234567890"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Tu API responde (200):**
```json
{
  "success": true
}
```

**Verificación del webhook (GET):**
```
GET /appointments/webhook?mode=subscribe&verify_token=TOKEN&challenge=CHALLENGE
```

Response: `CHALLENGE`

---

## 📋 Estados de Turno

```
pending    → Turno reservado (no confirmado)
confirmed  → Turno confirmado por el cliente
cancelled  → Turno cancelado (libera el horario)
```

---

## 🔒 Multi-Tenant

TODOS los endpoints filtran por `tenant_id`. Esto garantiza:
- ✅ Datos aislados por empresa
- ✅ Escalabilidad SaaS
- ✅ Seguridad

**Siempre incluye `tenant_id` en tus requests**

---

## 🗄️ Base de Datos

```sql
tenant
├── id (uuid)
├── name (varchar)
├── whatsapp_number (varchar)
└── created_at (timestamp)

availability
├── id (uuid)
├── tenant_id (uuid, FK)
├── day_of_week (int)
├── start_time (time)
├── end_time (time)
└── slot_duration (int)

appointment
├── id (uuid)
├── tenant_id (uuid, FK)
├── client_id (uuid, FK)
├── date (date)
├── time (time)
├── status (varchar)
├── created_at (timestamp)
└── UNIQUE(tenant_id, date, time) ← Previene doble reserva

client
├── id (uuid)
├── tenant_id (uuid, FK)
├── name (varchar)
├── phone (varchar)
├── email (varchar, nullable)
├── picture (varchar, nullable)
├── auth0_id (varchar, nullable)
├── created_at (timestamp)
└── UNIQUE(tenant_id, phone)

blocked_slot
├── id (uuid)
├── tenant_id (uuid, FK)
├── date (date)
├── time (time)
├── reason (varchar, nullable)
└── UNIQUE(tenant_id, date, time)
```

---

## 🚨 Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `400 Bad Request` | Campos faltantes | Verifica que envíes todos los campos requeridos |
| `409 Conflict` | Slot ya reservado | El horario fue ocupado, obtén slots disponibles de nuevo |
| `404 Not Found` | Recurso no existe | Verifica el ID |
| `500 Internal Server Error` | Error en servidor | Revisa los logs |

---

## 📝 Ejemplo Completo (Flujo Web)

```javascript
// 1. Crear tenant
POST /tenants
{ "name": "Barbería", "whatsapp_number": "+541234567890" }
→ { "id": "tenant_uuid" }

// 2. Crear reglas de disponibilidad
POST /availability
{
  "tenant_id": "tenant_uuid",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "slot_duration": 30
}

// 3. Usuario quiere agendar el lunes 15 de abril
GET /availability/slots?tenantId=tenant_uuid&date=2026-04-15
→ ["09:00", "09:30", "10:00", ..., "16:30"]

// 4. Usuario selecciona 10:00
POST /appointments
{
  "tenant_id": "tenant_uuid",
  "date": "2026-04-15",
  "time": "10:00",
  "client_phone": "+549123456789",
  "client_name": "Carlos"
}
→ { "id": "appointment_uuid", "status": "pending" }

// 5. Cliente confirma por WhatsApp
PATCH /appointments/appointment_uuid/confirm
→ { "id": "appointment_uuid", "status": "confirmed" }
```

---

## 🔧 Desarrollo

```bash
# Dev con hot reload
npm run start:dev

# Tests
npm test
npm run test:watch
npm run test:cov

# E2E tests
npm run test:e2e

# Lint
npm run lint

# Format
npm run format
```

---

## 📚 Más Información

- [WhatsApp Webhook Setup](./WHATSAPP_WEBHOOK_GUIDE.md)
- [Schema DBML](./backschema/schema.md)
