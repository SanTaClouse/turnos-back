# Turnos por WhatsApp — API

API REST multi-tenant para gestión de turnos, diseñada para ser consumida desde WhatsApp Business API, aplicaciones web y reservas manuales.

Cada negocio (tenant) configura sus servicios, profesionales/recursos, y horarios de disponibilidad. Los clientes reservan turnos a través de WhatsApp o web, y el sistema asigna automáticamente el recurso disponible.

## Stack

- **Runtime**: Node.js
- **Framework**: NestJS 11
- **Base de datos**: PostgreSQL + TypeORM
- **Documentación**: Swagger/OpenAPI (auto-generada)
- **Integración**: WhatsApp Business Cloud API

## Requisitos

- Node.js >= 18
- PostgreSQL >= 14
- Cuenta de WhatsApp Business API (para integración)

## Instalación

```bash
git clone <repo-url>
cd turnos-por-wsp
npm install
```

Crear archivo `.env` en la raíz:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_NAME=turnos_db

WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu_token_secreto

PORT=3000
```

```bash
npm run start:dev
```

La API levanta en `http://localhost:3000`.
Documentación Swagger en `http://localhost:3000/api/docs`.

---

## Modelo de datos

```
tenant
  ├── service          (corte, tintura, consulta...)
  │     └── duration_minutes, buffer_minutes
  ├── resource         (profesional, sillón, cancha...)
  │     └── services   (many-to-many: qué servicios ofrece cada recurso)
  ├── availability     (horarios por recurso por día de semana)
  ├── blocked_slot     (bloqueos por recurso o globales, con soporte de rangos)
  └── appointment      (turno: vincula client + service + resource)

client (nivel plataforma, no por tenant)
  └── tenant_client    (many-to-many: un teléfono puede usar varios negocios)
```

Esquema completo en `backschema/schema.md`.

---

## Endpoints

### Tenants — `/tenants`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/tenants` | Crear empresa |
| `GET` | `/tenants` | Listar empresas |
| `GET` | `/tenants/:id` | Obtener empresa por ID |
| `PATCH` | `/tenants/:id` | Actualizar empresa |
| `DELETE` | `/tenants/:id` | Eliminar empresa |

```json
// POST /tenants
{
  "name": "Barbería Juan",
  "slug": "barberia-juan",
  "whatsapp_number": "+541234567890",
  "timezone": "America/Argentina/Buenos_Aires",
  "currency": "ARS",
  "locale": "es-AR"
}
```

Campos opcionales con defaults: `timezone` (America/Argentina/Buenos_Aires), `currency` (ARS), `locale` (es-AR).

El `slug` es único y se usa para la URL pública del negocio (ej: `tuapp.com/barberia-juan`).

---

### Services — `/services`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/services` | Crear servicio |
| `GET` | `/services?tenantId=X` | Listar servicios activos |
| `GET` | `/services/:id` | Obtener servicio |
| `PATCH` | `/services/:id` | Actualizar servicio |
| `PATCH` | `/services/:id/deactivate` | Desactivar servicio |

```json
// POST /services
{
  "tenant_id": "uuid-del-tenant",
  "name": "Corte de pelo",
  "duration_minutes": 30,
  "buffer_minutes": 10
}
```

`buffer_minutes` es el tiempo de preparación/limpieza entre turnos. Un servicio de 30 min con 10 min de buffer ocupa 40 min en total en la agenda del recurso.

---

### Resources — `/resources`

Un recurso es cualquier entidad que realiza un servicio: un profesional, un sillón, una cancha, un consultorio.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/resources` | Crear recurso |
| `GET` | `/resources?tenantId=X` | Listar recursos activos |
| `GET` | `/resources/:id` | Obtener recurso |
| `PATCH` | `/resources/:id/services` | Asignar servicios al recurso |
| `PATCH` | `/resources/:id/deactivate` | Desactivar recurso |

```json
// POST /resources
{
  "tenant_id": "uuid-del-tenant",
  "name": "Peluquero Carlos",
  "service_ids": ["uuid-servicio-corte", "uuid-servicio-tintura"]
}
```

```json
// PATCH /resources/:id/services — reasignar servicios
{
  "service_ids": ["uuid-servicio-corte", "uuid-servicio-barba"]
}
```

---

### Availability — `/availability`

Define cuándo trabaja cada recurso. Se configura por día de semana.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/availability` | Crear regla de disponibilidad |
| `GET` | `/availability/slots?tenantId=X&serviceId=Y&date=YYYY-MM-DD` | Obtener horarios disponibles |
| `GET` | `/availability/:tenantId` | Listar reglas de una empresa |
| `DELETE` | `/availability/:id` | Eliminar regla |

```json
// POST /availability
{
  "tenant_id": "uuid-del-tenant",
  "resource_id": "uuid-del-recurso",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "slot_duration": 30
}
```

- `day_of_week`: 0 = domingo, 1 = lunes, ..., 6 = sábado
- `slot_duration`: granularidad del horario en minutos. Con 30, los turnos posibles son 09:00, 09:30, 10:00, etc.

#### Consultar horarios disponibles (endpoint core)

```
GET /availability/slots?tenantId=X&serviceId=Y&date=2026-04-21
```

Respuesta:

```json
[
  { "slot": "09:00", "resource_ids": ["uuid-carlos", "uuid-maria"] },
  { "slot": "09:30", "resource_ids": ["uuid-carlos"] },
  { "slot": "10:00", "resource_ids": ["uuid-maria"] },
  { "slot": "10:30", "resource_ids": ["uuid-carlos", "uuid-maria"] }
]
```

Cada slot indica qué recursos están libres en ese horario. El sistema:

1. Busca todos los recursos que ofrecen el servicio solicitado
2. Para cada recurso, genera los posibles horarios de inicio según su disponibilidad
3. Verifica que el servicio completo (duración + buffer) quepa en la ventana de disponibilidad
4. Descarta horarios que se solapan con turnos existentes o bloqueos
5. Devuelve solo los horarios donde al menos un recurso está disponible

---

### Appointments — `/appointments`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/appointments` | Crear turno |
| `GET` | `/appointments?tenantId=X` | Listar turnos de una empresa |
| `GET` | `/appointments/:id` | Obtener turno |
| `PATCH` | `/appointments/:id/confirm` | Confirmar turno |
| `PATCH` | `/appointments/:id/cancel` | Cancelar turno (libera horario) |
| `POST` | `/appointments/webhook` | Webhook de WhatsApp |

```json
// POST /appointments
{
  "tenant_id": "uuid-del-tenant",
  "service_id": "uuid-del-servicio",
  "date": "2026-04-21",
  "time": "10:00",
  "client_phone": "+541234567890",
  "client_name": "Juan García",
  "resource_id": "uuid-recurso-preferido"
}
```

`resource_id` es **opcional**. Si no se envía, el sistema asigna automáticamente el primer recurso disponible para ese servicio y horario.

**Flujo de creación:**

1. Valida que el servicio exista y esté activo
2. Busca los recursos que pueden realizar el servicio
3. Consulta disponibilidad considerando duración completa + buffer
4. Verifica que el horario solicitado esté libre (sin solapamiento con turnos existentes)
5. Asigna recurso (preferido si está libre, o el primer disponible)
6. Busca o crea el cliente por teléfono (a nivel plataforma)
7. Crea el turno con `end_time` calculado automáticamente

**Estados del turno:** `pending` → `confirmed` | `cancelled`

**Campos adicionales del turno:**
- `source`: origen de la reserva (`whatsapp`, `web`, `manual`)
- `notes`: texto libre para comentarios del cliente o negocio
- `end_time`: calculado automáticamente como `time + duration_minutes + buffer_minutes`

---

### Blocked Slots — `/blocked-slots`

Permite bloquear horarios por recurso específico o para todo el negocio. Soporta bloqueos puntuales y rangos.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/blocked-slots` | Crear bloqueo |
| `GET` | `/blocked-slots?tenantId=X` | Listar bloqueos |
| `DELETE` | `/blocked-slots/:id` | Eliminar bloqueo |

**Bloquear un rango de horas para un recurso:**

```json
{
  "tenant_id": "uuid",
  "resource_id": "uuid-carlos",
  "date": "2026-04-25",
  "start_time": "12:00",
  "end_time": "14:00",
  "reason": "Almuerzo"
}
```

**Vacaciones de un profesional (rango de días completos):**

```json
{
  "tenant_id": "uuid",
  "resource_id": "uuid-carlos",
  "date": "2026-05-01",
  "end_date": "2026-05-07",
  "reason": "Vacaciones"
}
```

**Feriado — bloquear todo el negocio:**

```json
{
  "tenant_id": "uuid",
  "date": "2026-05-25",
  "reason": "Feriado nacional"
}
```

- `resource_id` null → bloquea **todos** los recursos del tenant
- `start_time` y `end_time` null → bloquea el **día completo**
- `end_date` null → bloquea solo la fecha indicada en `date`

---

## Flujo de reserva desde WhatsApp

```
Cliente: "Hola, quiero sacar turno"
Bot:     "¿Qué servicio necesitás?"
         → GET /services?tenantId=X
         1. Corte de pelo (30 min) — $3500
         2. Tintura (90 min) — $12000
         3. Corte + barba (45 min) — $5000

Cliente: "1"
Bot:     → GET /availability/slots?tenantId=X&serviceId=corte&date=2026-04-21
         "Horarios disponibles para Corte de pelo el lunes 21/04:"
         1. 09:00
         2. 09:30
         3. 10:30
         4. 11:00

Cliente: "2"
Bot:     → POST /appointments { tenant_id, service_id, date: "2026-04-21",
           time: "09:30", client_phone: "+5491155551234" }
         "Tu turno para Corte de pelo es el lunes 21/04 a las 09:30.
          Te vamos a confirmar por este medio."

Negocio: → PATCH /appointments/:id/confirm
Bot:     → Notifica al cliente: "Tu turno fue confirmado."
```

---

## Conceptos clave

### Servicios simultáneos

El sistema soporta múltiples turnos en el mismo horario si hay múltiples recursos.

Una barbería con 3 sillones puede atender 3 cortes a las 10:00 simultáneamente. Cada sillón es un `resource`, y al crear un turno el sistema asigna automáticamente uno que esté libre.

Si el recurso A está ocupado de 10:00 a 10:40, los recursos B y C siguen disponibles para ese mismo horario.

### Servicios de distinta duración

Un servicio de 90 minutos bloquea el rango completo del recurso. Si la granularidad (`slot_duration`) es de 30 minutos y se reserva una tintura a las 10:00:

- El recurso queda ocupado de 10:00 a 11:30 (90 min de servicio)
- O de 10:00 a 11:40 si tiene 10 min de buffer

El endpoint `GET /availability/slots` ya descarta horarios donde el servicio completo no entra. Si la disponibilidad termina a las 17:00 y el servicio dura 90 min, el último slot posible es 15:30.

### Validación de solapamiento

La base de datos tiene un constraint `UNIQUE(resource_id, date, time)` como red de seguridad contra duplicados exactos. Sin embargo, la validación real de solapamiento entre turnos de distinta duración se hace en la lógica del backend (`AppointmentsService.create`), que verifica que el rango completo `[time, end_time)` no se solape con ningún turno existente del mismo recurso.

### Clientes a nivel plataforma

Un cliente se identifica por su número de teléfono de forma global. Si Juan (+5491155551234) reserva en "Barbería Carlos" y luego en "Dentista López", es el mismo registro de cliente vinculado a ambos tenants mediante la tabla `tenant_client`.

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_USERNAME` | Usuario de la BD | `postgres` |
| `DB_PASSWORD` | Contraseña de la BD | `secreto` |
| `DB_NAME` | Nombre de la BD | `turnos_db` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token de verificación del webhook | `mi_token_123` |
| `PORT` | Puerto de la API | `3000` |

## Scripts

```bash
npm run start:dev     # Desarrollo con hot-reload
npm run start:prod    # Producción
npm run build         # Compilar TypeScript
npm run test          # Tests unitarios
npm run test:e2e      # Tests end-to-end
npm run lint          # Linter
npm run format        # Prettier
```

## Documentación interactiva

Con el servidor corriendo, abrir `http://localhost:3000/api/docs` para la UI de Swagger donde se pueden probar todos los endpoints directamente desde el navegador.

---

## Pendientes para producción

**Core**
- [ ] Flujo conversacional completo de WhatsApp (procesamiento de mensajes entrantes)
- [ ] Autenticación y autorización (JWT / API keys por tenant)
- [ ] Rate limiting
- [ ] Migraciones de BD (desactivar `synchronize: true`)

**Negocio**
- [ ] Notificaciones automáticas (recordatorios de turno por WhatsApp)
- [ ] Expiración de turnos pendientes no confirmados
- [ ] Ventana máxima de reserva anticipada
- [ ] Política de cancelación configurable por tenant
- [ ] Integración con MercadoPago (cobro de seña/turno)

**Infraestructura**
- [ ] Caché de slots disponibles (Redis)
- [ ] Dashboard web para administración del negocio
- [ ] Docker
- [ ] CI/CD
# turnos-back
