// =====================================================================
//  S.A.P.C. — CHAWAL  |  Simulación de pagos (FIX-02 / Refix US-16)
//  Archivo: backend/__tests__/pagos.test.js
// =====================================================================
//  Uso:
//    1. API arriba:            npm start
//    2. Ejecutar:              npm test
//         (archivo suelto)     node __tests__/pagos.test.js
//
//  Runner: `node:test` nativo (Node 18+), sin dependencias externas.
//
//  Escenario 1 del AC (FIX-02):
//    Dado que la app móvil envía una solicitud de pago con el monto y el
//    método, cuando el controlador valida el JWT del paciente y procesa la
//    carga útil, entonces responde 200 OK con un JSON estructurado, mensaje
//    de éxito y un código de referencia ficticio (#TX-12345-CH).
//
//  ✅ SOLO LECTURA: el endpoint es una simulación y no escribe en `pagos`.
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

// Carga útil EXACTA que envía la app móvil (paymentsService.simulatePayment).
const PAGO_MOVIL = { citaId: 1, monto: 25000, metodoPago: 'DEBITO_SIMULADO' };

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

const tokens = {};
let pago;

before(async () => {
  for (const [rol, email] of Object.entries(CUENTAS)) {
    const r = await req('POST', '/auth/login', null, { email, password: CLAVE });
    assert.equal(r.status, 200, `login ${rol} (${email}): status ${r.status}`);
    assert.ok(r.data?.token, `login ${rol}: la respuesta no trae token`);
    tokens[rol] = r.data.token;
  }
  pago = await req('POST', '/pagos/simular', tokens.PACIENTE, PAGO_MOVIL);
  assert.equal(pago.status, 200, `POST /pagos/simular (PACIENTE) -> ${pago.status}`);
});

// =====================================================================
//  1. Autorización
// =====================================================================

describe('Autorización', () => {
  it('sin token -> 401 MISSING_TOKEN', async () => {
    const r = await req('POST', '/pagos/simular', null, PAGO_MOVIL);
    assert.equal(r.status, 401);
    assert.equal(r.data?.error, 'MISSING_TOKEN');
  });

  it('ADMINISTRADOR -> 403 FORBIDDEN (el AC exige token de paciente)', async () => {
    const r = await req('POST', '/pagos/simular', tokens.ADMINISTRADOR, PAGO_MOVIL);
    assert.equal(r.status, 403);
    assert.equal(r.data?.error, 'FORBIDDEN');
  });

  it('TERAPEUTA -> 403 FORBIDDEN', async () => {
    const r = await req('POST', '/pagos/simular', tokens.TERAPEUTA, PAGO_MOVIL);
    assert.equal(r.status, 403);
  });

  it('PACIENTE -> 200 OK (AC Escenario 1)', async () => {
    assert.equal(pago.status, 200);
    assert.equal(pago.data?.success, true);
  });

  it('GET /pagos/info exige token', async () => {
    const r = await req('GET', '/pagos/info');
    assert.equal(r.status, 401);
  });
});

// =====================================================================
//  2. Escenario 1 del AC — transacción simulada
// =====================================================================

describe('Escenario 1: transacción simulada', () => {
  it('responde con mensaje de éxito', () => {
    assert.equal(pago.data.success, true);
    assert.equal(typeof pago.data.message, 'string');
    assert.ok(pago.data.message.length > 0, 'mensaje vacío');
  });

  it('devuelve un código de referencia ficticio #TX-…-CH', () => {
    assert.match(pago.data.data.referencia, /^#TX-\d{5}-CH$/);
  });

  it('fecha_pago es una marca ISO válida', () => {
    assert.ok(!Number.isNaN(Date.parse(pago.data.data.fecha_pago)), `fecha_pago=${pago.data.data.fecha_pago}`);
  });

  it('devuelve el monto y el método enviados', () => {
    assert.equal(pago.data.data.monto, 25000);
    assert.equal(pago.data.data.metodo_pago, 'DEBITO_SIMULADO');
    assert.equal(pago.data.data.moneda, 'CLP');
  });

  it('la transacción queda marcada como PAGADO y simulado', () => {
    assert.equal(pago.data.data.estado_pago, 'PAGADO');
    assert.equal(pago.data.data.simulado, true);
  });

  it('el citaId del móvil viaja como id_cita en la respuesta', () => {
    assert.equal(pago.data.data.id_cita, 1);
  });

  it('acepta los nombres snake_case del dominio', async () => {
    const r = await req('POST', '/pagos/simular', tokens.PACIENTE, {
      id_cita: 3, monto: 19990, metodo_pago: 'CREDITO'
    });
    assert.equal(r.status, 200);
    assert.equal(r.data?.data?.id_cita, 3);
    assert.equal(r.data?.data?.metodo_pago, 'CREDITO');
  });
});

// =====================================================================
//  3. Validación de la carga útil
// =====================================================================

describe('Validación de la carga útil', () => {
  const invalidos = [
    ['sin body', undefined],
    ['sin cita', { monto: 25000, metodoPago: 'DEBITO_SIMULADO' }],
    ['citaId no entero', { citaId: 'abc', monto: 25000, metodoPago: 'DEBITO_SIMULADO' }],
    ['monto 0', { citaId: 1, monto: 0, metodoPago: 'DEBITO_SIMULADO' }],
    ['monto negativo', { citaId: 1, monto: -5000, metodoPago: 'DEBITO_SIMULADO' }],
    ['monto no numérico', { citaId: 1, monto: 'mucho', metodoPago: 'DEBITO_SIMULADO' }],
    ['monto sobre el techo', { citaId: 1, monto: 999999999, metodoPago: 'DEBITO_SIMULADO' }],
    ['sin método', { citaId: 1, monto: 25000 }],
    ['método desconocido', { citaId: 1, monto: 25000, metodoPago: 'BITCOIN' }]
  ];

  for (const [caso, body] of invalidos) {
    it(`${caso} -> 400 VALIDATION_ERROR con el campo señalado`, async () => {
      const r = await req('POST', '/pagos/simular', tokens.PACIENTE, body);
      assert.equal(r.status, 400, `status=${r.status}`);
      assert.equal(r.data?.error, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(r.data?.details) && r.data.details.length > 0, 'sin details');
      assert.ok(typeof r.data.details[0].field === 'string', 'details[0].field ausente');
    });
  }
});
