/**
 * Seed script — crea un tenant de prueba con servicios, recursos, horarios y un par de turnos.
 *
 * Uso: npx ts-node scripts/seed.ts
 *
 * Requiere que el backend esté corriendo en http://localhost:3000
 */

const BASE = process.env.API_URL ?? 'http://localhost:3000';

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

interface Tenant {
  id: string;
}
interface Service {
  id: string;
  name: string;
}
interface Resource {
  id: string;
  name: string;
}

async function main() {
  console.log('🌱 Seeding...\n');

  // ─── Tenant ────────────────────────────────────────────────
  console.log('1. Creando tenant "Corte Moderno"...');
  const tenant = await api<Tenant>('POST', '/tenants', {
    name: 'Corte Moderno',
    slug: 'corte-moderno',
    whatsapp_number: '+5491155552200',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    locale: 'es-AR',
    description: 'Barbería tradicional en Palermo',
    address: 'Gorriti 4420, Palermo',
    is_public: true,
  });
  console.log(`   ✓ Tenant ID: ${tenant.id}\n`);

  // ─── Servicios ─────────────────────────────────────────────
  console.log('2. Creando servicios...');
  const corte = await api<Service>('POST', '/services', {
    tenant_id: tenant.id,
    name: 'Corte de pelo',
    duration_minutes: 30,
    buffer_minutes: 0,
    price: 8000,
    description: 'Corte clásico o moderno',
  });
  const corteBarba = await api<Service>('POST', '/services', {
    tenant_id: tenant.id,
    name: 'Corte + barba',
    duration_minutes: 45,
    buffer_minutes: 5,
    price: 12000,
    description: 'Incluye perfilado y toalla caliente',
  });
  const barba = await api<Service>('POST', '/services', {
    tenant_id: tenant.id,
    name: 'Solo barba',
    duration_minutes: 20,
    buffer_minutes: 0,
    price: 5500,
    description: 'Perfilado y acabado con navaja',
  });
  console.log(`   ✓ ${corte.name}, ${corteBarba.name}, ${barba.name}\n`);

  // ─── Recursos ──────────────────────────────────────────────
  console.log('3. Creando recursos...');
  const carlos = await api<Resource>('POST', '/resources', {
    tenant_id: tenant.id,
    name: 'Carlos',
    role: 'Barbero senior',
    hue: 24,
    service_ids: [corte.id, corteBarba.id, barba.id],
  });
  const martin = await api<Resource>('POST', '/resources', {
    tenant_id: tenant.id,
    name: 'Martín',
    role: 'Barbero',
    hue: 180,
    service_ids: [corte.id, corteBarba.id],
  });
  console.log(`   ✓ ${carlos.name}, ${martin.name}\n`);

  // ─── Horarios (availability) ───────────────────────────────
  // Lun-Vie 10:00-20:00, Sábados 10:00-18:00 para cada recurso
  console.log('4. Creando horarios de disponibilidad...');
  for (const resource of [carlos, martin]) {
    for (const dow of [1, 2, 3, 4, 5]) {
      await api('POST', '/availability', {
        tenant_id: tenant.id,
        resource_id: resource.id,
        day_of_week: dow,
        start_time: '10:00',
        end_time: '20:00',
        slot_duration: 30,
      });
    }
    await api('POST', '/availability', {
      tenant_id: tenant.id,
      resource_id: resource.id,
      day_of_week: 6,
      start_time: '10:00',
      end_time: '18:00',
      slot_duration: 30,
    });
  }
  console.log('   ✓ Horarios L-V 10-20, Sáb 10-18\n');

  console.log('✨ Seed completo!');
  console.log(`\n📋 Pegá esto en front/turnosapp/.env.local:\n`);
  console.log(`NEXT_PUBLIC_API_URL=http://localhost:3000`);
  console.log(`NEXT_PUBLIC_ADMIN_TENANT_ID=${tenant.id}`);
  console.log(`\n🌐 Landing pública: http://localhost:3001/corte-moderno`);
  console.log(`🛠️  Admin: http://localhost:3001/admin/agenda\n`);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
