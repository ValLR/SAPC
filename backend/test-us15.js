// =====================================================================
//  S.A.P.C. — CHAWAL  |  Pruebas de métricas de demanda (US-15)
//  Archivo: backend/test-us15.js
// =====================================================================
//  Uso:
//    1. Aplicar el seed:  npm run db:setup
//    2. Arrancar la API:  npm start        (o npm run dev)
//    3. Ejecutar:         node test-us15.js
//
//  Requiere Node 18+ (fetch nativo).
//
//  Escenarios del AC de US-15 (SCRUM-23):
//    Escenario 1 — Un ADMINISTRADOR autenticado hace GET /api/reports/ocupacion
//                  y recibe 200 OK con el total de citas por especialista y
//                  el porcentaje de ocupación de las clases.
//    Escenario 2 — Un PACIENTE que intenta consumir la ruta recibe 403
//                  Forbidden (lo aplica el middleware de US-03).
//
//  ✅ Este test es de SOLO LECTURA: no crea ni modifica datos. Aun así
//     requiere el seed limpio, porque verifica los totales exactos.
//
//  Fixtures del seed que se comprueban:
//    Citas (7):  Camila 4 (2 vigentes + 2 grupales) · Matías 2 (1 CANCELADA)
//                · Valentina 1      -> 6 vigentes, 1 cancelada
//    Clases (3): aforo 3+5+2 = 10 · inscripciones ACTIVA 2+2+0 = 4 -> 40 %
// =====================================================================

require('dotenv').config({ quiet: true });

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(58)} | ${detalle}`);

const req = async (metodo, ruta, token, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin body */ }
  return { status: res.status, data };
};

(async () => {
  console.log(`\nProbando US-15 en: ${BASE}\n${'─'.repeat(110)}`);

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  const sumar = (lista, campo) => lista.reduce((s, x) => s + Number(x[campo] ?? 0), 0);

  try {
    // -----------------------------------------------------------------
    // 0. Tokens (uno por rol)
    // -----------------------------------------------------------------
    const logins = {};
    for (const [rol, email] of [
      ['ADMINISTRADOR', 'admin@chawal.cl'],
      ['TERAPEUTA', 'camila.rojas@chawal.cl'],
      ['PACIENTE', 'pedro.gonzalez@mail.cl'],
    ]) {
      const r = await req('POST', '/auth/login', null, { email, password: 'Password2026!' });
      logins[rol] = r.data?.token;
      check(r.status === 200 && !!logins[rol], `Login ${rol} (precondición)`, `status=${r.status}`);
    }

    // =================================================================
    // 1. Escenario 2 — sin privilegios administrativos -> 403
    // =================================================================
    const sinToken = await req('GET', '/reports/ocupacion');
    check(sinToken.status === 401, 'Sin token -> 401', `status=${sinToken.status}`);

    const comoPaciente = await req('GET', '/reports/ocupacion', logins.PACIENTE);
    check(
      comoPaciente.status === 403 && comoPaciente.data?.error === 'FORBIDDEN',
      'PACIENTE -> 403 FORBIDDEN (AC Escenario 2)',
      `status=${comoPaciente.status}, error=${comoPaciente.data?.error}`
    );

    const comoTerapeuta = await req('GET', '/reports/ocupacion', logins.TERAPEUTA);
    check(
      comoTerapeuta.status === 403 && comoTerapeuta.data?.error === 'FORBIDDEN',
      'TERAPEUTA -> 403 (métricas del centro son administrativas)',
      `status=${comoTerapeuta.status}`
    );

    const infoSinToken = await req('GET', '/reports/info');
    check(infoSinToken.status === 401, 'GET /reports/info sin token -> 401', `status=${infoSinToken.status}`);

    // =================================================================
    // 2. Escenario 1 — consolidación de métricas -> 200
    // =================================================================
    const r = await req('GET', '/reports/ocupacion', logins.ADMINISTRADOR);
    check(r.status === 200, 'ADMINISTRADOR -> 200 OK (AC Escenario 1)', `status=${r.status}`);
    check(r.data?.success === true, 'success = true', `success=${r.data?.success}`);
    check(typeof r.data?.generado_en === 'string', 'Incluye generado_en', `valor=${r.data?.generado_en}`);

    // --- Citas -----------------------------------------------------
    const citas = r.data?.citas || {};
    check(citas.total === 7, 'citas.total = 7 (seed)', `total=${citas.total}`);
    check(citas.vigentes === 6, 'citas.vigentes = 6 (excluye la cancelada)', `vigentes=${citas.vigentes}`);
    check(citas.canceladas === 1, 'citas.canceladas = 1', `canceladas=${citas.canceladas}`);
    check(citas.no_asistio === 0, 'citas.no_asistio = 0', `no_asistio=${citas.no_asistio}`);

    const porEspecialista = citas.por_especialista || [];
    check(porEspecialista.length === 3, 'por_especialista: 3 profesionales del seed', `n=${porEspecialista.length}`);
    check(
      sumar(porEspecialista, 'total_citas') === citas.total,
      'Los parciales por especialista suman el total',
      `suma=${sumar(porEspecialista, 'total_citas')}, total=${citas.total}`
    );

    const camila = porEspecialista.find((e) => e.id_profesional === 1);
    check(
      camila?.especialista === 'Camila Rojas' && camila?.total_citas === 4,
      'Camila Rojas: 4 citas (la de mayor demanda)',
      `nombre=${camila?.especialista}, total=${camila?.total_citas}`
    );
    check(
      camila?.especialidad === 'Kinesiología',
      'Incluye la especialidad principal como etiqueta',
      `especialidad=${camila?.especialidad}`
    );

    const matias = porEspecialista.find((e) => e.id_profesional === 2);
    check(
      matias?.total_citas === 2 && matias?.canceladas === 1,
      'Matías Fuentes: 2 citas, 1 cancelada',
      `total=${matias?.total_citas}, canceladas=${matias?.canceladas}`
    );

    const porEspecialidad = citas.por_especialidad || [];
    check(
      porEspecialidad.length === 3 && sumar(porEspecialidad, 'total_citas') === 7,
      'por_especialidad: 3 especialidades sin doble conteo',
      `n=${porEspecialidad.length}, suma=${sumar(porEspecialidad, 'total_citas')}`
    );
    check(
      porEspecialidad[0]?.especialidad === 'Kinesiología' && porEspecialidad[0]?.total_citas === 4,
      'La especialidad con más demanda es Kinesiología (4)',
      `top=${porEspecialidad[0]?.especialidad} (${porEspecialidad[0]?.total_citas})`
    );

    // --- Ocupación de clases ---------------------------------------
    const ocupacion = r.data?.ocupacion_clases || {};
    const global = ocupacion.global || {};
    check(global.aforo_total === 10, 'ocupacion_clases.global.aforo_total = 10 (3+5+2)', `aforo=${global.aforo_total}`);
    check(global.inscritos_total === 4, 'ocupacion_clases.global.inscritos_total = 4', `inscritos=${global.inscritos_total}`);
    check(global.porcentaje_ocupacion === 40, 'Porcentaje global = 40 % (4/10)', `pct=${global.porcentaje_ocupacion}`);
    check(global.clases === 3, 'El global cuenta 3 clases', `clases=${global.clases}`);

    const detalle = ocupacion.detalle || [];
    check(detalle.length === 3, 'detalle: 3 clases del seed', `n=${detalle.length}`);

    const clase1 = detalle.find((c) => c.id_clase === 1);
    check(
      clase1?.inscritos === 2 && clase1?.aforo_maximo === 3,
      'Clase 1: 2 inscritos de 3',
      `inscritos=${clase1?.inscritos}, aforo=${clase1?.aforo_maximo}`
    );
    check(
      clase1?.porcentaje_ocupacion === 67,
      'Clase 1: 67 % (misma fórmula que el portal web)',
      `pct=${clase1?.porcentaje_ocupacion}`
    );
    check(clase1?.completa === false, 'Clase 1 no está completa', `completa=${clase1?.completa}`);

    const clase3 = detalle.find((c) => c.id_clase === 3);
    check(
      clase3?.inscritos === 0 && clase3?.porcentaje_ocupacion === 0,
      'Clase 3 sin inscripciones aparece con 0 % (LEFT JOIN)',
      `inscritos=${clase3?.inscritos}, pct=${clase3?.porcentaje_ocupacion}`
    );
    check(
      detalle.every((c) => c.porcentaje_ocupacion >= 0 && c.porcentaje_ocupacion <= 100),
      'Ningún porcentaje sale del rango 0-100',
      `max=${Math.max(...detalle.map((c) => c.porcentaje_ocupacion))}`
    );

    // =================================================================
    // 3. Filtro opcional por rango de fechas
    // =================================================================
    const desde07 = await req('GET', '/reports/ocupacion?desde=2026-10-07', logins.ADMINISTRADOR);
    check(desde07.status === 200, 'GET con ?desde válido -> 200', `status=${desde07.status}`);
    check(
      desde07.data?.citas?.total === 3,
      '?desde=2026-10-07 -> 3 citas (09 y 10 de octubre)',
      `total=${desde07.data?.citas?.total}`
    );
    check(
      desde07.data?.rango?.desde === '2026-10-07' && desde07.data?.rango?.hasta === null,
      'El payload refleja el rango aplicado',
      `rango=${JSON.stringify(desde07.data?.rango)}`
    );

    const matiasEnRango = (desde07.data?.citas?.por_especialista || [])
      .find((e) => e.id_profesional === 2);
    check(
      (desde07.data?.citas?.por_especialista || []).length === 3 && matiasEnRango?.total_citas === 0,
      'Sin citas en el rango el profesional aparece con 0 (no desaparece)',
      `n=${(desde07.data?.citas?.por_especialista || []).length}, matias=${matiasEnRango?.total_citas}`
    );

    const hasta06 = await req('GET', '/reports/ocupacion?hasta=2026-10-06', logins.ADMINISTRADOR);
    check(hasta06.data?.citas?.total === 4, '?hasta=2026-10-06 -> 4 citas', `total=${hasta06.data?.citas?.total}`);

    const rangoAcotado = await req('GET', '/reports/ocupacion?desde=2026-10-07&hasta=2026-10-09', logins.ADMINISTRADOR);
    check(
      rangoAcotado.data?.citas?.total === 1,
      '?desde + ?hasta acotado -> 1 cita (solo 2026-10-09)',
      `total=${rangoAcotado.data?.citas?.total}`
    );

    const clasesNoviembre = await req('GET', '/reports/ocupacion?desde=2026-11-01', logins.ADMINISTRADOR);
    check(
      (clasesNoviembre.data?.ocupacion_clases?.detalle || []).length === 1,
      'El filtro también aplica a la fecha de las clases',
      `clases=${(clasesNoviembre.data?.ocupacion_clases?.detalle || []).length}`
    );

    // --- Filtros inválidos -----------------------------------------
    const fechaMala = await req('GET', '/reports/ocupacion?desde=2026-10-5', logins.ADMINISTRADOR);
    check(
      fechaMala.status === 400 && fechaMala.data?.error === 'VALIDATION_ERROR',
      '?desde mal formateado -> 400 VALIDATION_ERROR',
      `status=${fechaMala.status}, error=${fechaMala.data?.error}`
    );

    const rangoInvertido = await req('GET', '/reports/ocupacion?desde=2026-10-10&hasta=2026-10-01', logins.ADMINISTRADOR);
    check(rangoInvertido.status === 400, '?hasta anterior a ?desde -> 400', `status=${rangoInvertido.status}`);

  } catch (err) {
    fail++;
    console.log(`FALLA | Excepción no controlada: ${err.message}`);
  }

  console.log(`${'─'.repeat(110)}`);
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  console.log('NOTA: este test es de solo lectura; no deja datos de prueba.\n');
  process.exit(fail === 0 ? 0 : 1);
})();
