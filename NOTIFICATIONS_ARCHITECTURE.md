# 🏗️ Arquitectura de Notificaciones - Event-Driven (Senior Level)

## El Problema Anterior (Acoplado)

```typescript
// ❌ MAL: AppointmentsService conoce de NotificationsService
appointments.service.ts:
  create() {
    // ... crear turno ...
    await this.notificationsService.notifyNewAppointment(appointment);
  }
```

**Problemas:**
- ❌ Acoplamiento fuerte
- ❌ Difícil agregar nuevos canales (email, WhatsApp)
- ❌ Mezcla de responsabilidades
- ❌ Complicado testear
- ❌ No escala

---

## La Solución: Event-Driven Architecture

```typescript
// ✅ BIEN: AppointmentsService emite eventos
appointments.service.ts:
  create() {
    // ... crear turno ...
    this.eventEmitter.emit('appointment.created', { appointment, tenant });
  }

// ✅ Los listeners manejan notificaciones
appointment.listener.ts:
  @OnEvent('appointment.created')
  async onAppointmentCreated(data) {
    // Enviar push, email, WhatsApp, etc.
    await this.notificationsService.notify({...});
  }
```

**Beneficios:**
- ✅ Desacoplado
- ✅ Fácil agregar listeners
- ✅ Una responsabilidad por clase
- ✅ Testeable
- ✅ Escala a SaaS

---

## Flujo Actual

### 1. Evento Emitido
```
Appointment creado
  ↓
EventEmitter.emit('appointment.created', {appointment, tenant})
  ↓
Sistema en espera de listeners
```

### 2. Listeners Reaccionan
```
appointment.listener.ts escucha 'appointment.created'
  ├── Notifica al admin (push)
  └── Notifica al cliente (email)
```

### 3. Historial Guardado
```
notification_log table
├── type: 'appointment.created'
├── channel: 'push'
├── sent: true/false
└── sent_at: timestamp
```

---

## Tabla de Notificaciones (notification_log)

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  appointment_id UUID,
  type VARCHAR, -- 'appointment.created', 'reminder.24h', etc.
  channel VARCHAR, -- 'push', 'email', 'whatsapp'
  title VARCHAR,
  body TEXT,
  sent BOOLEAN,
  error TEXT,
  read BOOLEAN, -- Para in-app notifications
  created_at TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP
);
```

**Casos de uso:**
- 📊 Métricas: ¿cuántas notificaciones se enviaron?
- 📋 Inbox: historial de notificaciones del usuario
- 🔍 Debugging: ¿por qué no llegó esta notificación?

---

## Eventos Implementados

### 1. `appointment.created`
Cuando se crea un nuevo turno
```
Admin: push (urgente, necesita verlo rápido)
Cliente: email (confirmación)
```

### 2. `appointment.confirmed`
Cuando el admin confirma un turno pendiente
```
Cliente: email (notificación)
```

### 3. `appointment.cancelled`
Cuando se cancela un turno
```
Cliente: email (cambio de planes)
```

### 4. `appointment.reminder.24h` (próximo)
24 horas antes del turno
```
Cliente: email (recordatorio)
```

### 5. `appointment.reminder.2h` (próximo)
2 horas antes del turno
```
Cliente: WhatsApp + email (urgente, confirmación de asistencia)
```

---

## Cómo Agregar Nuevos Canales

### Antes (Acoplado):
- Modificar `appointments.service.ts`
- Agregar lógica nueva
- Riesgo de romper lo existente

### Ahora (Desacoplado):
```typescript
// 1. Agregar método en notifications.service.ts
private async sendEmail(payload) {
  // Lógica de email
}

private async sendWhatsapp(payload) {
  // Lógica de WhatsApp
}

private async sendSms(payload) {
  // Lógica de SMS
}

// 2. Actualizar sendByChannel()
switch (channel) {
  case 'push': return this.sendPush(payload);
  case 'email': return this.sendEmail(payload);
  case 'whatsapp': return this.sendWhatsapp(payload);
  case 'sms': return this.sendSms(payload);
}

// 3. Actualizar listener
@OnEvent('appointment.created')
async onAppointmentCreated(data) {
  await this.notificationsService.notify({
    channels: ['push', 'email', 'whatsapp'], // Agregar canal
  });
}

// ✅ LISTO. No tocaste appointments.service.ts
```

---

## Próximos Pasos (Roadmap SaaS)

### Fase 1: Multi-Channel (Próxima)
```
✅ Push: implementado
⏳ Email: integrar con MailService
⏳ WhatsApp: integrar con WhatsappService
⏳ SMS: integrar con SMS provider
```

### Fase 2: Preferencias del Usuario
```typescript
// Tabla: notification_preferences
user_id → channel → enabled → frequency
```
Permitir al cliente:
- Desactivar notificaciones
- Elegir frecuencia
- Elegir canales

### Fase 3: Reminders Automáticos
```typescript
// Crear job scheduler
appointment.reminder.24h
appointment.reminder.2h

// Usar cron + EventEmitter
// Same architecture, scheduled events
```

### Fase 4: Analytics
```typescript
// Dashboard para admin
- Notificaciones enviadas
- Tasa de entrega
- Tasa de lectura (in-app)
- Effectiveness por canal
```

---

## Ventajas de Esta Arquitectura para SaaS

| Aspecto | Acoplado ❌ | Event-Driven ✅ |
|--------|-----------|-----------------|
| Agregar canal | Modificar service | Agregar listener |
| Escalar | Complicado | Fácil |
| Testing | Difícil (mock todo) | Fácil (listeners aislados) |
| Performance | Bloqueante | Async/non-blocking |
| Cambios | Riesgo alto | Riesgo bajo |
| Mantenibilidad | Baja | Alta |

---

## Testing

### Antes (Difícil)
```typescript
// Tenías que mockear NotificationsService
const mockNotifications = { notifyNewAppointment: jest.fn() };
```

### Ahora (Fácil)
```typescript
// Cada listener es independiente
describe('AppointmentEventListener', () => {
  it('should notify admin on appointment.created', () => {
    eventEmitter.emit('appointment.created', {...});
    expect(notificationsService.notify).toHaveBeenCalled();
  });
});

// AppointmentsService no conoce de listeners
describe('AppointmentsService', () => {
  it('should emit appointment.created event', () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    await service.create(dto);
    expect(emitSpy).toHaveBeenCalledWith('appointment.created', {...});
  });
});
```

---

## Consideraciones Performance

### Event Emitters
- Non-blocking: emitir no espera respuesta
- En memoria: rápido
- Perfecto para apps monolíticas

### Para Microservicios (Futuro)
Si escalas a microservicios:
```
RabbitMQ / Kafka reemplaza EventEmitter
Mismo patrón, infraestructura distribuida
```

---

## Conclusión

Esta arquitectura es:
- **Profesional**: lo usan startups serias
- **Escalable**: crece sin rediseños
- **Mantenible**: cada cosa en su lugar
- **Testeable**: componentes aislados

**La diferencia entre código junior y senior es exactamente esto.**
