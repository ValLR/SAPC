// =====================================================================
//  S.A.P.C. — CHAWAL  |  Métricas de demanda y ocupación (US-15 / SCRUM-23)
//  Archivo: backend/__tests__/reports.test.js
// =====================================================================
//  Uso:
//    1. API arriba:            npm start
//    2. Ejecutar:              npm test
//         (equivalente a)      node --test __tests__/
//         (archivo suelto)     node __tests__/reports.test.js
//
//  Runner: `node:test` nativo de Node (18+), sin dependencias externas.
//  Usa fetch nativo (Node 18+), por lo que la API debe estar levantada.
//
//  Escenarios del AC (SCRUM-23):
//    Escenario 1 — Un ADMINISTRADOR autenticado obtiene 200 OK con el total
//                  de citas por especialista y el porcentaje de ocupación
//                  de los talleres.
//    Escenario 2 — Un PACIENTE recibe 403 Forbidden.
//
//  ✅ SOLO LECTURA: no crea, modifica ni elimina datos.
//  ✅ INDEPENDIENTE DEL SEED: las aserciones son invariantes del contrato
//     (identidades entre campos del propio payload, formas, códigos HTTP y
//     comportamiento de los filtros), no valores fijos de las fixtures.
//     Por eso NO requiere `npm run db:setup` y sigue siendo válido si el
//     seed cambia.
//
//     Únicas suposiciones (cobertura mínima + sentido común):
//       · >= 1 profesional activo, >= 1 taller y >= 1 cita registrada
//         (si no, las invariantes pasarían "en verde" vacías);
//       · no hay citas ni talleres en el año 2100 (se usa como filtro
//         futuro para probar que el filtro realmente excluye).
// =====================================================================

const path = require('node:path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '.env') });

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

// Credenciales del seed (sobrescribibles por variables de entorno).
const CLAVE = process.env.TEST_PASSWORD || 'Password2026!';
const CUENTAS = {
  ADMINISTRADOR: process.env.TEST_ADMIN_EMAIL || 'admin@chawal.cl',
  TERAPEUTA: process.env.TEST_TERAPEUTA_EMAIL || 'camila.rojas@chawal.cl',
  PACIENTE: process.env.TEST_PACIENTE_EMAIL || 'pedro.gonzalez@mail.cl'
};

const req = async (metodo, ruta, token, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuestas sin body */ }
  return { status: res.status, data };
};

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

const sumar = (filas, campo) => filas.reduce((total, f) => total + Number(f[campo] ?? 0), 0);

/** Fórmula de ocupación del contrato (la misma que usa el portal web). */
const ocupacion = (inscritos, aforo) =>
  aforo > 0 ? Math.min(100, Math.round((inscritos / aforo) * 100)) : 0;

/** Fecha ISO (YYYY-MM-DD) desplazada N días. */
const desplazar = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const ordenadoDesc = (filas, campo) =>
  filas.every((f, i) => i === 0 || Number(filas[i - 1][campo]) >= Number(f[campo]));

// ---------------------------------------------------------------------
//  Estado compartido (se llena en el `before` raíz, antes de todos los tests)
// ---------------------------------------------------------------------

const tokens = {};
const consultas = {};
let base;                  // payload sin filtros
let citas;                 // bloque `citas`
let talleres;              // bloque `ocupacion_clases`
let detalle;               // talleres.detalle
let global;                // talleres.global
let primeraFecha;          // fecha del taller más antiguo del reporte
let ultimaFecha;           // fecha del taller más reciente del reporte

before(async () => {
  // --- Sesiones (usadas por todos los bloques) ---
  for (const [rol, email] of Object.entries(CUENTAS)) {
    const r = await req('POST', '/auth/login', null, { email, password: CLAVE });
    assert.equal(r.status, 200, `login ${rol} (${email}): status ${r.status}`);
    assert.ok(r.data?.token, `login ${rol}: la respuesta no trae token`);
    tokens[rol] = r.data.token;
  }

  // --- Payload base del reporte (AC Escenario 1) ---
  base = await req('GET', '/reports/ocupacion', tokens.ADMINISTRADOR);
  assert.equal(base.status, 200, `GET /reports/ocupacion (ADMIN) -> ${base.status}`);
  citas = base.data.citas;
  talleres = base.data.ocupacion_clases;
  detalle = talleres.detalle;
  global = talleres.global;

  // Cobertura mínima: sin datos, las invariantes de abajo pasarían vacías.
  assert.ok(citas.total >= 1, 'La base no tiene citas registradas: ejecuta `npm run db:setup`');
  assert.ok(citas.por_especialista.length >= 1, 'La base no tiene profesionales activos: ejecuta `npm run db:setup`');
  assert.ok(detalle.length >= 1, 'La base no tiene talleres: ejecuta `npm run db:setup`');

  // Fechas del propio payload: los filtros se derivan de los datos, no del seed.
  const fechas = detalle.map((c) => c.fecha_clase).sort();
  primeraFecha = fechas[0];
  ultimaFecha = fechas[fechas.length - 1];

  // --- Variantes con filtro (todas de solo lectura) ---
  consultas.abierto = await req('GET', '/reports/ocupacion?desde=2000-01-01&hasta=2100-01-01', tokens.ADMINISTRADOR);
  consultas.futuro = await req('GET', '/reports/ocupacion?desde=2100-01-01', tokens.ADMINISTRADOR);
  consultas.pasado = await req('GET', '/reports/ocupacion?hasta=1970-01-01', tokens.ADMINISTRADOR);
  consultas.desdeUltima = await req('GET', `/reports/ocupacion?desde=${ultimaFecha}`, tokens.ADMINISTRADOR);
  consultas.unDia = await req('GET', `/reports/ocupacion?desde=${primeraFecha}&hasta=${primeraFecha}`, tokens.ADMINISTRADOR);
  consultas.antesDePrimera = await req('GET', `/reports/ocupacion?hasta=${desplazar(primeraFecha, -1)}`, tokens.ADMINISTRADOR);
  consultas.malFormado = await req('GET', '/reports/ocupacion?desde=2026-10-5', tokens.ADMINISTRADOR);
  consultas.invertido = await req('GET', '/reports/ocupacion?desde=2100-01-01&hasta=2000-01-01', tokens.ADMINISTRADOR);
});

// =====================================================================
//  1. Autorización (AC Escenario 2)
// =====================================================================

describe('Autorización (AC Escenario 2)', () => {
  it('sin token -> 401 MISSING_TOKEN', async () => {
    const r = await req('GET', '/reports/ocupacion');
    assert.equal(r.status, 401);
    assert.equal(r.data?.error, 'MISSING_TOKEN');
  });

  it('PACIENTE -> 403 FORBIDDEN', async () => {
    const r = await req('GET', '/reports/ocupacion', tokens.PACIENTE);
    assert.equal(r.status, 403);
    assert.equal(r.data?.error, 'FORBIDDEN');
  });

  it('TERAPEUTA -> 403 FORBIDDEN (las métricas del centro son administrativas)', async () => {
    const r = await req('GET', '/reports/ocupacion', tokens.TERAPEUTA);
    assert.equal(r.status, 403);
    assert.equal(r.data?.error, 'FORBIDDEN');
  });

  it('token malformado -> 401 INVALID_TOKEN (no 403)', async () => {
    const r = await req('GET', '/reports/ocupacion', 'esto.no.es.un.jwt');
    assert.equal(r.status, 401);
    assert.equal(r.data?.error, 'INVALID_TOKEN');
  });

  it('GET /reports/info exige token', async () => {
    const r = await req('GET', '/reports/info');
    assert.equal(r.status, 401);
  });

  it('ADMINISTRADOR -> 200 OK (AC Escenario 1)', async () => {
    const r = await req('GET', '/reports/ocupacion', tokens.ADMINISTRADOR);
    assert.equal(r.status, 200);
    assert.equal(r.data?.success, true);
  });
});

// =====================================================================
//  2. Forma del payload
// =====================================================================

describe('Forma del payload', () => {
  it('success = true y generado_en es una fecha ISO válida', () => {
    assert.equal(base.data.success, true);
    assert.ok(
      !Number.isNaN(Date.parse(base.data.generado_en)),
      `generado_en no parseable: ${base.data.generado_en}`
    );
  });

  it('rango refleja que no se aplicó ningún filtro', () => {
    assert.deepEqual(base.data.rango, { desde: null, hasta: null });
  });

  it('citas expone los cuatro totales como números', () => {
    for (const campo of ['total', 'vigentes', 'canceladas', 'no_asistio']) {
      assert.equal(typeof citas[campo], 'number', `citas.${campo} es ${typeof citas[campo]}`);
    }
  });

  it('por_especialista: una fila por profesional, con etiqueta y total numérico', () => {
    for (const fila of citas.por_especialista) {
      assert.equal(typeof fila.especialista, 'string', 'especialista sin nombre');
      assert.ok(fila.especialista.length > 0, 'especialista vacío');
      assert.ok(typeof fila.especialidad === 'string' && fila.especialidad.length > 0, 'especialidad vacía');
      assert.equal(typeof fila.total_citas, 'number', 'total_citas no numérico');
    }
  });

  it('por_especialidad: filas con etiqueta y total numérico', () => {
    assert.ok(Array.isArray(citas.por_especialidad));
    for (const fila of citas.por_especialidad) {
      assert.ok(typeof fila.especialidad === 'string' && fila.especialidad.length > 0, 'especialidad vacía');
      assert.equal(typeof fila.total_citas, 'number', 'total_citas no numérico');
    }
  });

  it('ocupacion_clases trae el global completo y el detalle', () => {
    for (const campo of ['clases', 'aforo_total', 'inscritos_total', 'porcentaje_ocupacion', 'clases_canceladas_excluidas']) {
      assert.equal(typeof global[campo], 'number', `global.${campo} es ${typeof global[campo]}`);
    }
    assert.ok(Array.isArray(detalle), 'detalle no es un arreglo');
  });
});

// =====================================================================
//  3. Identidades de las métricas de citas
// =====================================================================

describe('Identidades de citas', () => {
  it('total = vigentes + canceladas + no_asistio', () => {
    assert.equal(citas.total, citas.vigentes + citas.canceladas + citas.no_asistio);
  });

  it('la suma de los parciales por especialista da el total', () => {
    assert.equal(sumar(citas.por_especialista, 'total_citas'), citas.total);
  });

  it('los desgloses por estado también suman el total', () => {
    assert.equal(sumar(citas.por_especialista, 'vigentes'), citas.vigentes);
    assert.equal(sumar(citas.por_especialista, 'canceladas'), citas.canceladas);
    assert.equal(sumar(citas.por_especialista, 'no_asistio'), citas.no_asistio);
  });

  it('por_especialista viene ordenado de mayor a menor demanda', () => {
    assert.ok(ordenadoDesc(citas.por_especialista, 'total_citas'));
  });

  it('el rollup por especialidad no duplica citas (suma = total)', () => {
    assert.equal(sumar(citas.por_especialidad, 'total_citas'), citas.total);
    assert.equal(sumar(citas.por_especialidad, 'vigentes'), citas.vigentes);
  });

  it('por_especialidad viene ordenado de mayor a menor demanda', () => {
    assert.ok(ordenadoDesc(citas.por_especialidad, 'total_citas'));
  });
});

// =====================================================================
//  4. Ocupación de talleres (fórmula del contrato)
// =====================================================================

describe('Ocupación de talleres', () => {
  it('cada taller cumple porcentaje = min(100, round(inscritos / aforo * 100))', () => {
    for (const c of detalle) {
      assert.equal(
        c.porcentaje_ocupacion,
        ocupacion(c.inscritos, c.aforo_maximo),
        `clase ${c.id_clase} (${c.nombre_actividad}): ${c.inscritos}/${c.aforo_maximo}`
      );
    }
  });

  it('cada taller marca "completa" con el mismo criterio que el portal', () => {
    for (const c of detalle) {
      assert.equal(
        c.completa,
        c.cupos_disponibles === 0 || c.porcentaje_ocupacion >= 100,
        `clase ${c.id_clase}`
      );
    }
  });

  it('el global ignora las clases canceladas y lo reporta', () => {
    const vigentes = detalle.filter((c) => c.estado_clase !== 'CANCELADA');
    assert.equal(global.clases, vigentes.length);
    assert.equal(global.clases_canceladas_excluidas, detalle.length - vigentes.length);
    assert.equal(global.aforo_total, sumar(vigentes, 'aforo_maximo'));
    assert.equal(global.inscritos_total, sumar(vigentes, 'inscritos'));
  });

  it('el porcentaje global aplica la misma fórmula sobre los totales', () => {
    assert.equal(global.porcentaje_ocupacion, ocupacion(global.inscritos_total, global.aforo_total));
  });

  it('el detalle viene ordenado por fecha y hora de inicio', () => {
    const claves = detalle.map((c) => `${c.fecha_clase} ${c.hora_inicio}`);
    assert.deepEqual(claves, [...claves].sort());
  });
});

// =====================================================================
//  5. Filtros por fecha (comportamiento del contrato)
// =====================================================================

describe('Filtros por fecha', () => {
  it('el payload refleja el rango aplicado', () => {
    assert.deepEqual(consultas.desdeUltima.data.rango, { desde: ultimaFecha, hasta: null });
    assert.deepEqual(consultas.unDia.data.rango, { desde: primeraFecha, hasta: primeraFecha });
  });

  it('un rango que cubre todo devuelve el histórico completo', () => {
    assert.equal(consultas.abierto.data.citas.total, citas.total);
    assert.equal(consultas.abierto.data.ocupacion_clases.global.clases, global.clases);
  });

  it('?desde un año futuro -> 0 citas y 0 talleres (el filtro excluye de verdad)', () => {
    assert.equal(consultas.futuro.data.citas.total, 0);
    assert.equal(consultas.futuro.data.ocupacion_clases.global.clases, 0);
    assert.equal(consultas.futuro.data.ocupacion_clases.detalle.length, 0);
  });

  it('?hasta anterior al primer taller -> 0 citas y 0 talleres', () => {
    assert.equal(consultas.pasado.data.citas.total, 0);
    assert.equal(consultas.pasado.data.ocupacion_clases.global.clases, 0);
  });

  it('al filtrar, los profesionales NO desaparecen: aparecen con 0 (filtro en el ON, no en el WHERE)', () => {
    const porEspecialista = consultas.futuro.data.citas.por_especialista;
    assert.equal(porEspecialista.length, citas.por_especialista.length);
    assert.ok(
      porEspecialista.every((f) => f.total_citas === 0),
      'con un filtro que excluye todo, ningún profesional puede tener citas'
    );
  });

  it('?desde=<último taller> solo devuelve talleres de ese día o posteriores', () => {
    const clases = consultas.desdeUltima.data.ocupacion_clases.detalle;
    assert.ok(clases.length >= 1, 'el filtro excluyó también el último taller');
    assert.ok(clases.every((c) => c.fecha_clase >= ultimaFecha));
  });

  it('el rango de un solo día devuelve los talleres de ese día (extremos inclusivos)', () => {
    const clases = consultas.unDia.data.ocupacion_clases.detalle;
    assert.ok(clases.length >= 1, 'el rango [primera, primera] no devolvió ningún taller');
    assert.ok(clases.every((c) => c.fecha_clase === primeraFecha));
  });
});

// =====================================================================
//  6. Validación de filtros
// =====================================================================

describe('Validación de filtros', () => {
  it('formato incorrecto -> 400 VALIDATION_ERROR con el campo señalado', () => {
    assert.equal(consultas.malFormado.status, 400);
    assert.equal(consultas.malFormado.data?.error, 'VALIDATION_ERROR');
    assert.equal(consultas.malFormado.data?.details?.[0]?.field, 'desde');
  });

  it('rango invertido (hasta < desde) -> 400 VALIDATION_ERROR', () => {
    assert.equal(consultas.invertido.status, 400);
    assert.equal(consultas.invertido.data?.error, 'VALIDATION_ERROR');
    assert.equal(consultas.invertido.data?.details?.[0]?.field, 'hasta');
  });
});
