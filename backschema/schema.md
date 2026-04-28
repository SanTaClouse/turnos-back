// Use DBML to define your database structure
// Docs: https://dbml.dbdiagram.io/docs


Table tenant {
  id uuid [primary key]
  name varchar
  slug varchar [unique] // URL-friendly (ej: tuapp.com/peluqueria-carlos)
  whatsapp_number varchar
  timezone varchar [default: 'America/Argentina/Buenos_Aires'] // IANA timezone
  currency varchar [default: 'ARS'] // ISO 4217
  locale varchar [default: 'es-AR'] // formateo de fechas y números
  created_at timestamp
}

Table service {
  id uuid [primary key]
  tenant_id uuid [not null, ref: > tenant.id]
  name varchar
  duration_minutes int // duración del servicio en minutos
  buffer_minutes int [default: 0] // tiempo de preparación entre turnos
  is_active boolean [default: true]
  created_at timestamp

  indexes {
    (tenant_id, name) [unique]
  }
}

Table resource {
  id uuid [primary key]
  tenant_id uuid [not null, ref: > tenant.id]
  name varchar // profesional, sala, cancha, sillón, etc
  is_active boolean [default: true]
  created_at timestamp

  indexes {
    (tenant_id, name) [unique]
  }
}

Table resource_service {
  resource_id uuid [ref: > resource.id]
  service_id uuid [ref: > service.id]

  indexes {
    (resource_id, service_id) [pk]
  }
}

Table availability {
  id uuid [primary key]
  tenant_id uuid [not null, ref: > tenant.id]
  resource_id uuid [not null, ref: > resource.id]
  day_of_week int // 0 = domingo
  start_time time
  end_time time
  slot_duration int // granularidad en minutos (30, 60, etc)

  indexes {
    (resource_id, day_of_week) [name: 'idx_availability_resource_day']
  }
}

Table appointment {
  id uuid [primary key]
  tenant_id uuid [not null, ref: > tenant.id]
  client_id uuid [null, ref: > client.id]
  service_id uuid [null, ref: > service.id]
  resource_id uuid [null, ref: > resource.id]

  date date
  time time // hora de inicio
  end_time time // hora de fin (calculada: time + duration + buffer)

  status varchar // 'pending', 'confirmed', 'cancelled'
  source varchar [default: 'whatsapp'] // 'whatsapp', 'web', 'manual'
  notes text [null] // notas del cliente o negocio

  created_at timestamp

  indexes {
    // Safety net: previene duplicados exactos.
    // NO previene solapamiento de multi-slot (ej: 60min a las 10:00 vs 30min a las 10:30).
    // La validación de solapamiento se hace en el backend (AppointmentsService.create).
    (resource_id, date, time) [unique]
  }
}

// Client es a nivel PLATAFORMA (no por tenant).
// Un mismo teléfono puede reservar en múltiples negocios.
Table client {
  id uuid [primary key]
  name varchar
  phone varchar [unique]

  auth0_id varchar [null]
  email varchar [null]
  picture varchar [null]

  created_at timestamp
}

// Relación many-to-many entre tenant y client
Table tenant_client {
  tenant_id uuid [ref: > tenant.id]
  client_id uuid [ref: > client.id]

  indexes {
    (tenant_id, client_id) [pk]
  }
}

Table blocked_slot {
  id uuid [primary key]
  tenant_id uuid [not null, ref: > tenant.id]
  resource_id uuid [null, ref: > resource.id] // null = bloquea TODOS los recursos

  date date // fecha de inicio del bloqueo
  end_date date [null] // fecha de fin (null = solo un día)
  start_time time [null] // hora inicio (null = día completo bloqueado)
  end_time time [null] // hora fin (null = día completo bloqueado)

  reason varchar [null]

  indexes {
    (tenant_id, date) [name: 'idx_blocked_tenant_date']
  }
}
