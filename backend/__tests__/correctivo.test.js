// =====================================================================
//  S.A.P.C. — CHAWAL  |  Bloque correctivo (ronda 2) — fixes de backend
//  Archivo: backend/__tests__/correctivo.test.js
// =====================================================================
//  Uso:
//    1. API arriba:            npm start
//    2. Ejecutar:              npm test
//         (archivo suelto)     node __tests__/correctivo.test.js
//
//  Cubre los tres huecos de backend detectados al revisar los consumidores
//  (web + mobile) contra la API real:
//
//    A. `POST /api/citas/:id_cita/cancelar` — alias que la app móvil YA
//       llamaba (paymentsService.cancelAppointmentHold) y que no existía:
//       recibía 404 y el cliente fabricaba un "éxito" sin liberar el bloque.
//    B. Taller CANCELADO no inscribible — `DELETE /api/clases/:id_clase` es
//       una baja LÓGICA, pero el catálogo lo seguía ofreciendo y la reserva
//       lo aceptaba, consumiendo un cupo de algo que no se dicta.
//    C. `/api/schedules` sin fallbacks silenciosos — ya no se asume el
//       profesional 1 cuando falta el id, y publicar para un profesional
//       inexistente responde 404 (antes: 500 por violación de FK).
//
//  ✅ RE-EJECUTABLE sin `npm run db:setup`: las citas y el taller que crea
//     quedan cancelados, así que liberan sus cupos y slots.
// =====================================================================

const path = require('node:path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '.env') });

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';
const CLAVE = process.env.TEST_PASSWORD || 'Password2026!';
const CUENTAS = {
  ADMINISTRADOR: process.env.TEST_ADMIN_EMAIL || 'admin@chawal.cl',
  TERAPEUTA: process.env.TEST_TERAPEUTA_EMAIL || 'camila.rojas@chawal.cl',
  PACIENTE: process.env.TEST_PACIENTE_EMAIL || 'pedro.gonzalez@mail.cl'
};

// Fixture de agenda: bloque 1 = profesional 1, lunes 09:00-13:00, aforo 1,
// servicio 1 = 45 min (mismos fixtures que usa US-05).
const CITA_FIXTURE = { id_profesional: 1, id_servicio: 1, id_bloque: 1, hora_inicio: '09:00' };
const AFORO_TALLER = 2;

const req = async (metodo, ruta, token, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuestas sin body */ }
  return { status: res.status, data };
};

/** Fecha ISO del N-ésimo lunes futuro (los bloques del seed son semanales). */
const lunesFuturo = (semanas) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 1);
  d.setUTCDate(d.getUTCDate() + 7 * (semanas - 1));
  return d.toISOString().slice(0, 10);
};

const tokens = {};

before(async () => {
  for (const [rol, email] of Object.entries(CUENTAS)) {
    const r = await req('POST', '/auth/login', null, { email, password: CLAVE });
    assert.equal(r.status, 200, `login ${rol} (${email}): status ${r.status}`);
    assert.ok(r.data?.token, `login ${rol}: la respuesta no trae token`);
    tokens[rol] = r.data.token;
  }
});

// =====================================================================
//  A. Alias POST /api/citas/:id_cita/cancelar (contrato móvil)
// =====================================================================

describe('A. Alias de cancelación de cita', () => {
  let idCita;
  let fechaCita;

  before(async () => {
    // Busca un lunes con el slot libre (el seed ya ocupa algunos).
    let ultimoIntento = 'sin intentos';
    for (let semana = 1; semana <= 8 && !idCita; semana++) {
      const fecha = lunesFuturo(semana);
      const r = await req('POST', '/citas', tokens.PACIENTE, { ...CITA_FIXTURE, fecha });
      if (r.status === 201) {
        idCita = r.data?.data?.id_cita;
        fechaCita = fecha;
      } else {
        ultimoIntento = `${fecha} -> ${r.status} ${r.data?.error}`;
      }
    }
    assert.ok(idCita, `no se pudo agendar una cita de prueba para el alias (${ultimoIntento})`);
  });

  it('el alias existe y responde igual que el DELETE (misma cita inexistente)', async () => {
    const porAlias = await req('POST', '/citas/999999/cancelar', tokens.PACIENTE);
    const porDelete = await req('DELETE', '/citas/999999', tokens.PACIENTE);

    assert.equal(porAlias.status, 404);
    // ⚠️ Clave: si la ruta no existiera, el handler global respondería
    // NOT_FOUND; el controlador responde RESOURCE_NOT_FOUND.
    assert.equal(porAlias.data?.error, 'RESOURCE_NOT_FOUND');
    assert.deepEqual(
      { status: porAlias.status, error: porAlias.data?.error },
      { status: porDelete.status, error: porDelete.data?.error },
      'el alias debe comportarse exactamente como el DELETE'
    );
  });

  it('sin token -> 401 MISSING_TOKEN', async () => {
    const r = await req('POST', `/citas/${idCita}/cancelar`);
    assert.equal(r.status, 401);
    assert.equal(r.data?.error, 'MISSING_TOKEN');
  });

  it('el PACIENTE cancela su cita por el alias -> 200 y queda CANCELADA', async () => {
    const r = await req('POST', `/citas/${idCita}/cancelar`, tokens.PACIENTE, {
      motivo: 'Prueba del alias móvil'
    });
    assert.equal(r.status, 200, `status=${r.status} ${JSON.stringify(r.data)}`);
    assert.equal(r.data?.data?.estado, 'CANCELADA');
    assert.equal(r.data?.data?.motivo, 'Prueba del alias móvil');
  });

  it('una segunda cancelación por DELETE -> 409 ALREADY_CANCELLED (misma máquina de estados)', async () => {
    const r = await req('DELETE', `/citas/${idCita}`, tokens.PACIENTE);
    assert.equal(r.status, 409);
    assert.ok(
      ['ALREADY_CANCELLED', 'NOT_CANCELLABLE'].includes(r.data?.error),
      `error inesperado: ${r.data?.error}`
    );
  });

  it('el slot quedó libre: se puede volver a agendar el mismo horario', async () => {
    const r = await req('POST', '/citas', tokens.PACIENTE, { ...CITA_FIXTURE, fecha: fechaCita });
    assert.equal(r.status, 201, `el alias no liberó el bloque: ${r.status} ${r.data?.error}`);

    // Deja el horario limpio para la próxima corrida.
    const idNueva = r.data?.data?.id_cita;
    const limpieza = await req('POST', `/citas/${idNueva}/cancelar`, tokens.PACIENTE);
    assert.equal(limpieza.status, 200, 'no se pudo limpiar la cita de prueba');
  });
});

// =====================================================================
//  B. Taller cancelado: fuera del catálogo y de la reserva
// =====================================================================

describe('B. Taller cancelado no es inscribible', () => {
  let idTaller;

  before(async () => {
    const fixture = {
      nombre_actividad: 'Taller QA cancelado',
      descripcion: 'Fixture del bloque correctivo (taller cancelado).',
      sala: `Sala QA correctivo ${Date.now()}`,
      id_instructor: 2,
      aforo_maximo: AFORO_TALLER,
      fecha_clase: '2027-07-20',
      hora_inicio: '12:00',
      hora_fin: '13:00'
    };

    const creado = await req('POST', '/clases', tokens.ADMINISTRADOR, fixture);
    assert.equal(creado.status, 201, `no se pudo crear el taller de prueba: ${JSON.stringify(creado.data)}`);
    idTaller = creado.data?.data?.id_clase;

    const baja = await req('DELETE', `/clases/${idTaller}`, tokens.ADMINISTRADOR);
    assert.equal(baja.status, 200, `no se pudo cancelar el taller de prueba: ${baja.status}`);
  });

  it('inscribirse en un taller CANCELADO -> 409 CLASS_CANCELLED', async () => {
    const r = await req('POST', `/classes/${idTaller}/reserve`, tokens.PACIENTE);
    assert.equal(r.status, 409, `status=${r.status} ${JSON.stringify(r.data)}`);
    assert.equal(r.data?.error, 'CLASS_CANCELLED');
  });

  it('el rechazo no consumió cupo', async () => {
    const r = await req('GET', `/clases/${idTaller}`, tokens.ADMINISTRADOR);
    assert.equal(r.data?.data?.cupos_disponibles, AFORO_TALLER);
    assert.equal(r.data?.data?.inscripciones_activas, 0);
  });

  it('el catálogo móvil ya no ofrece talleres cancelados', async () => {
    const r = await req('GET', '/classes', tokens.PACIENTE);
    assert.equal(r.status, 200);
    const ids = (r.data?.data || []).map((c) => c.id_class);
    assert.ok(!ids.includes(idTaller), `el taller cancelado ${idTaller} sigue en el catálogo`);
    assert.ok(ids.length >= 1, 'el catálogo quedó vacío: revisa el seed');
  });
});

// =====================================================================
//  C. /api/schedules sin fallbacks silenciosos
// =====================================================================

describe('C. Agendas: sin fallback al profesional 1', () => {
  it('ADMIN sin therapistId -> 400 MISSING_THERAPIST_ID', async () => {
    const r = await req('GET', '/schedules', tokens.ADMINISTRADOR);
    assert.equal(r.status, 400, `status=${r.status}`);
    assert.equal(r.data?.error, 'MISSING_THERAPIST_ID');
  });

  it('therapistId no numérico -> 400 INVALID_THERAPIST_ID', async () => {
    const r = await req('GET', '/schedules?therapistId=abc', tokens.ADMINISTRADOR);
    assert.equal(r.status, 400);
    assert.equal(r.data?.error, 'INVALID_THERAPIST_ID');
  });

  it('el TERAPEUTA recibe SU agenda aunque pida la de otro profesional', async () => {
    const r = await req('GET', '/schedules?therapistId=2', tokens.TERAPEUTA);
    assert.equal(r.status, 200);
    assert.ok(Number.isInteger(r.data?.therapistId), 'therapistId no es entero');
    assert.notEqual(r.data.therapistId, 2, 'se respetó el id ajeno en vez de forzar el propio');
  });

  it('publish sin therapist_id -> 400 (antes publicaba en el profesional 1)', async () => {
    const r = await req('POST', '/schedules/publish', tokens.ADMINISTRADOR, {
      days: [4], start_time: '09:00', end_time: '10:00', slot_duration: 30
    });
    assert.equal(r.status, 400);
    assert.equal(r.data?.error, 'MISSING_THERAPIST_ID');
  });

  it('publish con therapist_id inexistente -> 404 (antes 500 por FK)', async () => {
    const r = await req('POST', '/schedules/publish', tokens.ADMINISTRADOR, {
      therapist_id: 99999, days: [4], start_time: '09:00', end_time: '10:00', slot_duration: 30
    });
    assert.equal(r.status, 404);
    assert.equal(r.data?.error, 'THERAPIST_NOT_FOUND');
  });
});
