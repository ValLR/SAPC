// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rol PACIENTE en la reserva de clases (FIX-03)
//  Archivo: backend/__tests__/inscripciones.test.js
// =====================================================================
//  Uso:
//    1. API arriba:            npm start
//    2. Ejecutar:              npm test
//         (archivo suelto)     node __tests__/inscripciones.test.js
//
//  Hallazgo de QA (SCRUM-61 → FIX-03): "Implementar validación de rol
//  PACIENTE en endpoint de reserva de clases".
//
//  Este suite deja el hallazgo verificado y cerrado: comprueba la matriz
//  completa de roles sobre `POST /api/classes/:id_class/reserve`, que un
//  rechazo NO consume cupos y que la inscripción del paciente es real
//  (visible en el detalle US-11 y en la reportería US-15).
//
//  Contrato bajo prueba:
//    401 MISSING_TOKEN / INVALID_TOKEN   sin token o token inválido (US-03)
//    403 FORBIDDEN                       ADMINISTRADOR y TERAPEUTA (requireRole en la ruta)
//    403 NOT_A_PATIENT                   token sin ficha de paciente (2ª capa del controlador)
//    400 INVALID_ID                      id de clase no numérico
//    404 NOT_FOUND                       clase inexistente
//    200 OK                              PACIENTE: inscripción real, cupo −1
//    409 ALREADY_RESERVED                uq_paciente_clase (no se puede repetir)
//
//  ✅ RE-EJECUTABLE: crea su propia clase (US-11) con una sala única y la
//     da de baja lógica al final, así que no requiere `npm run db:setup`
//     entre corridas. Deja la clase cancelada (residuo visible en el
//     catálogo), limpiable con `npm run db:setup`.
// =====================================================================

const path = require('node:path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '.env') });

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';
const CLAVE = process.env.TEST_PASSWORD || 'Password2026!';
const CUENTAS = {
  ADMINISTRADOR: process.env.TEST_ADMIN_EMAIL || 'admin@chawal.cl',
  TERAPEUTA: process.env.TEST_TERAPEUTA_EMAIL || 'camila.rojas@chawal.cl',
  PACIENTE: process.env.TEST_PACIENTE_EMAIL || 'pedro.gonzalez@mail.cl'
};

const AFORO_FIXTURE = 2;
const FECHA_FIXTURE = '2027-06-15';   // fecha propia: aísla el fixture de los datos del seed

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

/** Cupos e inscripciones activas del fixture, según el detalle de US-11. */
const estadoDelFixture = async () => {
  const r = await req('GET', `/clases/${idClase}`, tokens.ADMINISTRADOR);
  return {
    cupos: r.data?.data?.cupos_disponibles,
    inscripciones: r.data?.data?.inscripciones_activas
  };
};

const tokens = {};
let idClase;

before(async () => {
  for (const [rol, email] of Object.entries(CUENTAS)) {
    const r = await req('POST', '/auth/login', null, { email, password: CLAVE });
    assert.equal(r.status, 200, `login ${rol} (${email}): status ${r.status}`);
    assert.ok(r.data?.token, `login ${rol}: la respuesta no trae token`);
    tokens[rol] = r.data.token;
  }

  // Fixture propio: una clase con sala única (evita ROOM_CONFLICT incluso si
  // una corrida anterior quedó a medias).
  const fixture = {
    nombre_actividad: 'Taller QA FIX-03',
    descripcion: 'Fixture del suite de RBAC de inscripciones (FIX-03).',
    sala: `Sala QA FIX-03 ${Date.now()}`,
    id_instructor: 2,
    aforo_maximo: AFORO_FIXTURE,
    fecha_clase: FECHA_FIXTURE,
    hora_inicio: '10:00',
    hora_fin: '11:00'
  };

  const creada = await req('POST', '/clases', tokens.ADMINISTRADOR, fixture);
  assert.equal(creada.status, 201, `no se pudo crear el fixture: ${creada.status} ${JSON.stringify(creada.data)}`);
  idClase = creada.data?.data?.id_clase;
  assert.ok(idClase, 'el fixture no devolvió id_clase');
  assert.equal(creada.data?.data?.cupos_disponibles, AFORO_FIXTURE, 'el fixture no arrancó con el aforo completo');
});

after(async () => {
  // Limpieza: baja lógica (US-11). No se borra físicamente para no arrastrar
  // la inscripción por ON DELETE CASCADE.
  if (idClase) await req('DELETE', `/clases/${idClase}`, tokens.ADMINISTRADOR);
});

// =====================================================================
//  1. Autorización — el hallazgo de QA
// =====================================================================

describe('Autorización: la reserva exige rol PACIENTE', () => {
  it('sin token -> 401 MISSING_TOKEN (y sin tocar cupos)', async () => {
    const antes = await estadoDelFixture();
    const r = await req('POST', `/classes/${idClase}/reserve`);
    assert.equal(r.status, 401, `status=${r.status}`);
    assert.equal(r.data?.error, 'MISSING_TOKEN');
    assert.deepEqual(await estadoDelFixture(), antes, 'un 401 no puede consumir cupos');
  });

  it('token malformado -> 401 INVALID_TOKEN', async () => {
    const r = await req('POST', `/classes/${idClase}/reserve`, 'esto.no.es.un.jwt');
    assert.equal(r.status, 401);
    assert.equal(r.data?.error, 'INVALID_TOKEN');
  });

  it('ADMINISTRADOR -> 403 FORBIDDEN (no puede inscribirse)', async () => {
    const antes = await estadoDelFixture();
    const r = await req('POST', `/classes/${idClase}/reserve`, tokens.ADMINISTRADOR);
    assert.equal(r.status, 403, `status=${r.status}`);
    assert.ok(
      ['FORBIDDEN', 'NOT_A_PATIENT'].includes(r.data?.error),
      `error inesperado: ${r.data?.error}`
    );
    assert.deepEqual(await estadoDelFixture(), antes, 'un 403 no puede consumir cupos');
  });

  it('TERAPEUTA -> 403 FORBIDDEN (tampoco es paciente)', async () => {
    const antes = await estadoDelFixture();
    const r = await req('POST', `/classes/${idClase}/reserve`, tokens.TERAPEUTA);
    assert.equal(r.status, 403, `status=${r.status}`);
    assert.ok(['FORBIDDEN', 'NOT_A_PATIENT'].includes(r.data?.error), `error inesperado: ${r.data?.error}`);
    assert.deepEqual(await estadoDelFixture(), antes, 'un 403 no puede consumir cupos');
  });

  it('el catálogo de clases también exige sesión', async () => {
    const r = await req('GET', '/classes');
    assert.equal(r.status, 401);
  });
});

// =====================================================================
//  2. PACIENTE — la inscripción es real
// =====================================================================

describe('PACIENTE: la inscripción se persiste', () => {
  let cuposAntes;
  let respuesta;

  before(async () => {
    cuposAntes = (await estadoDelFixture()).cupos;
    respuesta = await req('POST', `/classes/${idClase}/reserve`, tokens.PACIENTE);
    assert.equal(respuesta.status, 200, `la inscripción del paciente falló: ${respuesta.status} ${JSON.stringify(respuesta.data)}`);
  });

  it('responde 200 con la clase y el cupo ya decrementado', () => {
    assert.equal(respuesta.data.success, true);
    assert.equal(respuesta.data.data.id_class, idClase);
    assert.equal(respuesta.data.data.available_slots, cuposAntes - 1);
  });

  it('el detalle de la clase refleja la inscripción (US-11)', async () => {
    const { cupos, inscripciones } = await estadoDelFixture();
    assert.equal(cupos, AFORO_FIXTURE - 1);
    assert.equal(inscripciones, 1);
  });

  it('la inscripción cuenta en la reportería de ocupación (US-15)', async () => {
    const r = await req(
      'GET',
      `/reports/ocupacion?desde=${FECHA_FIXTURE}&hasta=${FECHA_FIXTURE}`,
      tokens.ADMINISTRADOR
    );
    assert.equal(r.status, 200);

    const miClase = (r.data?.ocupacion_clases?.detalle || []).find((c) => c.id_clase === idClase);
    assert.ok(miClase, 'la clase del fixture no aparece en el reporte');
    assert.equal(miClase.inscritos, 1, 'la reportería no ve la inscripción');
    assert.equal(miClase.porcentaje_ocupacion, 50, '1 de 2 cupos = 50 %');
  });

  it('inscribirse dos veces -> 409 ALREADY_RESERVED', async () => {
    const r = await req('POST', `/classes/${idClase}/reserve`, tokens.PACIENTE);
    assert.equal(r.status, 409, `status=${r.status}`);
    assert.equal(r.data?.error, 'ALREADY_RESERVED');
  });

  it('el duplicado rechazado no consume un segundo cupo', async () => {
    const { cupos, inscripciones } = await estadoDelFixture();
    assert.equal(cupos, AFORO_FIXTURE - 1);
    assert.equal(inscripciones, 1);
  });
});

// =====================================================================
//  3. Validaciones de la petición
// =====================================================================

describe('Validaciones de la petición', () => {
  it('id de clase no numérico -> 400 INVALID_ID', async () => {
    const r = await req('POST', '/classes/abc/reserve', tokens.PACIENTE);
    assert.equal(r.status, 400);
    assert.equal(r.data?.error, 'INVALID_ID');
  });

  it('clase inexistente -> 404 NOT_FOUND', async () => {
    const r = await req('POST', '/classes/999999/reserve', tokens.PACIENTE);
    assert.equal(r.status, 404);
    assert.equal(r.data?.error, 'NOT_FOUND');
  });
});
