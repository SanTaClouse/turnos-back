# 🔥 Guía Visual - Endpoint Core: GET /availability/slots

Este es el **corazón de tu API**. Aquí te muestro exactamente cómo usarlo en Swagger.

---

## ✅ Parámetros Requeridos

### 1. `tenantId` (ID de la Empresa)
- **Formato:** UUID (identificador único)
- **Ejemplo correcto:** `550e8400-e29b-41d4-a716-446655440000`
- **Qué hacer si lo no tienes:**
  - Primero crea una empresa con POST /tenants
  - El response te dará el tenantId

### 2. `date` (Fecha)
- **Formato:** `YYYY-MM-DD` (año-mes-día)
- **Ejemplo correcto:** `2026-04-15`
- **Ejemplo INCORRECTO:** 
  - ❌ `15/04/2026` (formato europeo)
  - ❌ `04-15-2026` (formato americano)
  - ❌ `2026/04/15` (con barras)
  - ❌ `2026-4-15` (sin ceros)

---

## 📖 Paso a Paso en Swagger

### PASO 1: Abre Swagger
```
http://localhost:3000/api/docs
```

### PASO 2: Busca el Endpoint
- Haz scroll hasta "Availability"
- Click en `GET /availability/slots`

### PASO 3: Click en "Try it out"
![try-it-out]

### PASO 4: Completa los Parámetros

**Campo 1: `tenantId`**
```
550e8400-e29b-41d4-a716-446655440000
```

**Campo 2: `date`**
```
2026-04-15
```

![parámetros]

### PASO 5: Click "Execute"

### PASO 6: Ver Respuesta

**Respuesta correcta (200 OK):**
```json
[
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30"
]
```

---

## 🚨 Errores Comunes y Soluciones

### ERROR 1: Formato de Fecha Incorrecto

**Entrada incorrecta:**
```
date: "15-04-2026"
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Formato de fecha inválido. Debe ser YYYY-MM-DD (ej: 2026-04-15). Recibido: \"15-04-2026\""
}
```

**Solución:**
✅ Usa: `2026-04-15`

---

### ERROR 2: Fecha No Válida

**Entrada incorrecta:**
```
date: "2026-02-30"
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Fecha no válida: \"2026-02-30\". Por favor verifica que la fecha exista (ej: no usar 2026-02-30)"
}
```

**Solución:**
✅ Febrero no tiene 30 días, usa: `2026-02-28`

---

### ERROR 3: tenantId Vacío

**Entrada:**
```
tenantId: ""
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "tenantId es requerido y no puede estar vacío"
}
```

**Solución:**
✅ Proporciona un tenantId válido

---

### ERROR 4: tenantId No Existe

**Entrada correcta pero tenantId no existe:**
```
tenantId: "invalid-uuid-xxx"
date: "2026-04-15"
```

**Respuesta (200 OK con lista vacía):**
```json
[]
```

**Por qué:** Ese tenant no tiene reglas de disponibilidad o no existe.

**Solución:**
1. Primero crea la empresa: `POST /tenants`
2. Luego crea reglas: `POST /availability`
3. Luego obtén slots: `GET /availability/slots`

---

### ERROR 5: "QueryFailedError: la sintaxis de entrada no es válida"

**Si ves este error:**
```
QueryFailedError: la sintaxis de entrada no es válida para tipo integer: «NaN»
```

**Causa:** Ingresaste la fecha en formato incorrecto.

**Solución:**
✅ **IMPORTANTE:** Usa formato `YYYY-MM-DD`

---

## 📋 Checklista Antes de Hacer Request

- [ ] ¿Creé una empresa primero? (`POST /tenants`)
- [ ] ¿Creé reglas de disponibilidad? (`POST /availability`)
- [ ] ¿El tenantId es un UUID válido?
- [ ] ¿La fecha está en formato `YYYY-MM-DD`?
- [ ] ¿La fecha es válida? (ej: no 2026-02-30)
- [ ] ¿Estoy usando la fecha correcta en el body?

---

## 💡 Ejemplos Reales

### Ejemplo 1: Barbería Abierta de Lunes a Viernes

**Setup:**
```bash
# 1. Crear empresa
POST /tenants
{
  "name": "Barbería El Corte",
  "whatsapp_number": "+541234567890"
}
# Response: { "id": "a1b2c3d4-..." }

# 2. Crear disponibilidad para Lunes
POST /availability
{
  "tenant_id": "a1b2c3d4-...",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "slot_duration": 30
}

# 3. Crear disponibilidad para Martes
POST /availability
{
  "tenant_id": "a1b2c3d4-...",
  "day_of_week": 2,
  "start_time": "09:00",
  "end_time": "17:00",
  "slot_duration": 30
}
```

**Luego obtener slots:**
```bash
# Lunes 15 de abril (day_of_week = 1)
GET /availability/slots?tenantId=a1b2c3d4-...&date=2026-04-14
Response: ["09:00", "09:30", "10:00", ..., "16:30"]

# Martes 15 de abril (day_of_week = 2)
GET /availability/slots?tenantId=a1b2c3d4-...&date=2026-04-15
Response: ["09:00", "09:30", "10:00", ..., "16:30"]

# Domingo 12 de abril (day_of_week = 0, sin disponibilidad)
GET /availability/slots?tenantId=a1b2c3d4-...&date=2026-04-12
Response: []
```

---

### Ejemplo 2: Con Turnos Ya Reservados

**Después de reservar un turno:**
```bash
POST /appointments
{
  "tenant_id": "a1b2c3d4-...",
  "date": "2026-04-14",
  "time": "10:00",
  "client_phone": "+541111111111",
  "client_name": "Juan"
}
```

**Al obtener slots de nuevo:**
```bash
GET /availability/slots?tenantId=a1b2c3d4-...&date=2026-04-14
Response: ["09:00", "09:30", "10:30", "11:00", ...] 
# Nota: "10:00" desapareció porque está reservado
```

---

## 🧮 Cómo Funciona Internamente

```
GET /availability/slots?tenantId=X&date=2026-04-14

1. Validar parámetros
   ✓ tenantId no vacío
   ✓ date en formato YYYY-MM-DD
   ✓ date es una fecha válida

2. Calcular day_of_week
   2026-04-14 = Martes = day_of_week 2

3. Obtener reglas de disponibilidad
   SELECT * FROM availability 
   WHERE tenant_id = X AND day_of_week = 2

4. Generar slots (ej: 09:00, 09:30, 10:00, ...)
   Basado en start_time, end_time, slot_duration

5. Filtrar turnos ocupados
   SELECT * FROM appointment 
   WHERE tenant_id = X AND date = '2026-04-14' 
   AND status != 'cancelled'

6. Filtrar horarios bloqueados
   SELECT * FROM blocked_slot 
   WHERE tenant_id = X AND date = '2026-04-14'

7. Retornar slots - ocupados - bloqueados
   ["09:00", "09:30", "10:30", "11:00", ...]
```

---

## 🔐 Rate Limiting (Futuro)

Cuando implementes autenticación, este endpoint NO tendrá restricción especial porque es el más llamado por apps/web:

```
GET /availability/slots → SIN LÍMITE (llamadas frecuentes)
POST /appointments → LIMITADO (crear reservas)
```

---

## 📞 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Formato de fecha inválido" | Usa `YYYY-MM-DD` |
| "Fecha no válida" | La fecha no existe (ej: 2026-02-30) |
| "QueryFailedError: NaN" | Formato de fecha incorrecto |
| Lista vacía `[]` | No hay slots disponibles o no hay reglas configuradas |
| 404 Not Found | El endpoint es `/availability/slots` (con `/`) |
| 500 Internal Error | Error del servidor, revisa logs |

---

**¡Ahora sí está claro cómo usar el endpoint core! 🚀**

Próxima vez que uses Swagger para GET /availability/slots:
1. tenantId: `550e8400-e29b-41d4-a716-446655440000`
2. date: `2026-04-15`
3. ¡Execute!
