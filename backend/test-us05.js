// =====================================================================
//  S.A.P.C. — CHAWAL  |  Pruebas del agendamiento transaccional (US-05)
//  Archivo: backend/test-us05.js
// =====================================================================
//  Uso:
//    1. Aplicar el seed:  npm run db:setup
//    2. Arrancar la API:  npm start        (o npm run dev)
//    3. Ejecutar:         node test-us05.js
//
//  Requiere Node 18+ (fetch nativo).
//
//  Escenarios del AC de US-05 (SCRUM-13):
//    Escenario 1 — Dado un bloque disponible, la API invoca el SP de
//                  reserva dentro de una transacción, inserta la cita y
//                  retorna 201 Created.
//    Escenario 2 — Dos reservas concurrentes sobre el mismo slot: la
//                  segunda hace rollback y retorna 409 Conflict.
//                  (El caso realmente simultáneo está en
//                   test-concurrencia-us05.js; aquí se prueba el rechazo
//                   determinista y que NO deja efectos en la BD.)
//
//  Además (sección 8, fuera del AC): cancelación de citas — baja lógica
//  que libera el slot, con autorización por propiedad del recurso.
//
//  Fixtures del seed que usa este script:
//    Camila   = profesional 1 · bloque 1 (Lunes 09:00-13:00, aforo 1)
//                            · bloque 6 (Sábado 10:00-12:00, aforo 3)
//    Matías   = profesional 2 · bloque 3 (Martes 10:00-14:00, aforo 1)
//    Servicio 1 = Kinesiología 45 min · Servicio 2 = Fonoaudiología 30 min
//    Servicio 3 = Psicología 50 min   · Servicio 4 = Taller grupal 60 min
//    Citas del seed: 05/10 09:00 y 10:00 (Camila) · 10/10 10:00 x2 (grupal)
//                    · 06/10 11:00 (Matías, CANCELADA -> libera el slot)
//
//  ⚠️ Este test CREA citas (los casos de éxito). Re-ejecutar
//     `npm run db:setup` antes de repetirlo.
// =====================================================================

require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

// --- Fixtures (ver cabecera) -----------------------------------------
const BLOQUE_CAMILA_LUNES = 1;    // prof 1, Lunes, 09-13, aforo 1
const BLOQUE_MATIAS_MARTES = 3;   // prof 2, Martes, 10-14, aforo 1
const BLOQUE_GRUPAL_SABADO = 6;   // prof 1, Sábado, 10-12, aforo 3
const PROF_CAMILA = 1;
const PROF_MATIAS = 2;
const SERV_KINESIO = 1;       // 45 min
const SERV_FONO = 2;          // 30 min
const SERV_PSICO = 3;         // 50 min
const SERV_GRUPAL = 4;        // 60 min
const LUNES = '2026-10-05';
const MARTES = '2026-10-06';
const SABADO = '2026-10-10';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(58)} | ${detalle}`);

const req = async (metodo, ruta, body, token) => {
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
  console.log(`\nProbando US-05 en: ${BASE}\n${'─'.repeat(110)}`);

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'chawal_db'
  });

  /** Citas vigentes de un bloque (opcionalmente de un slot exacto). */
  const citasVigentes = async (idBloque, fecha, horaInicio = null) => {
    let sql = `SELECT COUNT(*) AS n FROM citas
                WHERE id_bloque = ? AND fecha_cita = ?
                  AND estado NOT IN ('CANCELADA','NO_ASISTIO')`;
    const params = [idBloque, fecha];
    if (horaInicio) { sql += ' AND hora_inicio = ?'; params.push(horaInicio); }
    const [r] = await conn.query(sql, params);
    return Number(r[0].n);
  };

  /** Ocupación DERIVADA que expone GET /api/agendas (opción A del AC). */
  const ocupadosDe = async (idProfesional, fecha, token) => {
    const r = await req('GET', `/agendas/${idProfesional}?fecha=${fecha}`, null, token);
    return r.data?.data?.bloques?.[0]?.ocupados;
  };

  let tokenAdmin = null, tokenTerapeuta = null;
  const tokensPacientes = {};

  try {
    // -----------------------------------------------------------------
    // 0. Precondiciones
    // -----------------------------------------------------------------
    const loginAdmin = await req('POST', '/auth/login', { email: 'admin@chawal.cl', password: 'Password2026!' });
    tokenAdmin = loginAdmin.data?.token;
    check(loginAdmin.status === 200 && !!tokenAdmin, 'Login admin (precondición)', `status=${loginAdmin.status}`);

    const loginTer = await req('POST', '/auth/login', { email: 'camila.rojas@chawal.cl', password: 'Password2026!' });
    tokenTerapeuta = loginTer.data?.token;
    check(loginTer.status === 200 && !!tokenTerapeuta, 'Login terapeuta (precondición)', `status=${loginTer.status}`);

    for (const [paciente, email] of [[1, 'pedro.gonzalez@mail.cl'], [2, 'ana.munoz@mail.cl'], [3, 'luis.perez@mail.cl']]) {
      const r = await req('POST', '/auth/login', { email, password: 'Password2026!' });
      tokensPacientes[paciente] = r.data?.token;
    }
    const nTokens = Object.values(tokensPacientes).filter(Boolean).length;
    check(nTokens === 3, 'Tokens de 3 pacientes (precondición)', `n=${nTokens}`);

    // =================================================================
    // 1. Seguridad (US-03 aplicado al endpoint nuevo)
    // =================================================================
    const bodyValido = {
      id_profesional: PROF_CAMILA, id_servicio: SERV_KINESIO,
      id_bloque: BLOQUE_CAMILA_LUNES, fecha: LUNES, hora_inicio: '11:00'
    };

    const sinToken = await req('POST', '/citas', bodyValido);
    check(sinToken.status === 401, 'Sin token -> 401', `status=${sinToken.status}`);

    const comoAdmin = await req('POST', '/citas', bodyValido, tokenAdmin);
    check(
      comoAdmin.status === 403 && comoAdmin.data?.error === 'FORBIDDEN',
      'ADMINISTRADOR -> 403 (solo PACIENTE agenda)',
      `status=${comoAdmin.status}, error=${comoAdmin.data?.error}`
    );

    const comoTerapeuta = await req('POST', '/citas', bodyValido, tokenTerapeuta);
    check(
      comoTerapeuta.status === 403 && comoTerapeuta.data?.error === 'FORBIDDEN',
      'TERAPEUTA -> 403 (solo PACIENTE agenda)',
      `status=${comoTerapeuta.status}`
    );

    // =================================================================
    // 2. Validación del body (antes de tocar la BD)
    // =================================================================
    const vacio = await req('POST', '/citas', {}, tokensPacientes[2]);
    check(
      vacio.status === 400 && vacio.data?.error === 'VALIDATION_ERROR',
      'Body vacío -> 400 VALIDATION_ERROR', `status=${vacio.status}`
    );

    const fechaMala = await req('POST', '/citas', { ...bodyValido, fecha: '2026-10-5' }, tokensPacientes[2]);
    check(fechaMala.status === 400, 'Fecha "2026-10-5" -> 400', `status=${fechaMala.status}`);

    const horaMala = await req('POST', '/citas', { ...bodyValido, hora_inicio: '25:00' }, tokensPacientes[2]);
    check(horaMala.status === 400, 'Hora "25:00" -> 400', `status=${horaMala.status}`);

    const idMalo = await req('POST', '/citas', { ...bodyValido, id_bloque: 'abc' }, tokensPacientes[2]);
    check(idMalo.status === 400, 'id_bloque "abc" -> 400', `status=${idMalo.status}`);

    // =================================================================
    // 3. Escenario 1 — agendamiento sin colisión -> 201
    // =================================================================
    const ocupadosAntes = await ocupadosDe(PROF_CAMILA, LUNES, tokenAdmin);
    check(ocupadosAntes === 2, 'Ocupación inicial del bloque 1 = 2 (seed)', `ocupados=${ocupadosAntes}`);

    // Ana (paciente 2) reserva el slot libre de 11:00 con Kinesiología (45 min)
    const reserva = await req('POST', '/citas', bodyValido, tokensPacientes[2]);
    check(reserva.status === 201, 'POST /api/citas -> 201 Created', `status=${reserva.status}`);
    check(reserva.data?.success === true, 'success = true', `success=${reserva.data?.success}`);
    check(Number.isInteger(reserva.data?.data?.id_cita) && reserva.data.data.id_cita > 0, 'Devuelve id_cita', `id=${reserva.data?.data?.id_cita}`);
    check(reserva.data?.data?.estado === 'PENDIENTE', 'estado = PENDIENTE (el que inserta el SP)', `estado=${reserva.data?.data?.estado}`);
    check(
      reserva.data?.data?.hora_fin === '11:45:00',
      'hora_fin calculada por el SP (11:00 + 45 min)', `hora_fin=${reserva.data?.data?.hora_fin}`
    );
    check(reserva.data?.data?.id_paciente === 2, 'id_paciente tomado del JWT, no del body', `id_paciente=${reserva.data?.data?.id_paciente}`);
    check(reserva.data?.data?.fecha_cita === LUNES, 'fecha_cita persiste como YYYY-MM-DD', `fecha=${reserva.data?.data?.fecha_cita}`);

    const enBd = await citasVigentes(BLOQUE_CAMILA_LUNES, LUNES, '11:00:00');
    check(enBd === 1, 'La cita quedó en la BD (1 vigente en el slot)', `n=${enBd}`);

    // Evidencia de "el bloque quedó ocupado" con la ocupación DERIVADA:
    // el bloque no tiene columna de estado (es plantilla semanal); lo que
    // cambia es el conteo de citas vigentes que expone GET /api/agendas.
    const ocupadosDespues = await ocupadosDe(PROF_CAMILA, LUNES, tokenAdmin);
    check(ocupadosDespues === 3, 'El bloque quedó ocupado: ocupados 2 -> 3', `antes=${ocupadosAntes}, después=${ocupadosDespues}`);

    // =================================================================
    // 4. Escenario 2 — rechazos deterministas, sin efectos en la BD
    // =================================================================
    // Mismo hora_inicio ya ocupada (colisión exacta).
    // ⚠️ El código puede ser BLOCK_FULL o SLOT_TAKEN, y no es un descuido:
    // para un bloque de aforo 1 el rechazo lo produce el COUNT(*) del SP
    // (BLOCK_FULL) —que es la guardia que el AC nombra: "el SP detecta la
    // existencia de la cita previa"—, mientras que SLOT_TAKEN aparece
    // cuando lo detecta el trigger (solapamiento de rango, ver más abajo)
    // o el índice único uq_citas_slot cuando la carrera la gana el índice.
    // Las tres terminan en 409 Conflict, que es lo que exige el AC.
    const mismoSlot = await req('POST', '/citas', { ...bodyValido, hora_inicio: '09:00' }, tokensPacientes[3]);
    check(
      mismoSlot.status === 409 && ['BLOCK_FULL', 'SLOT_TAKEN'].includes(mismoSlot.data?.error),
      'Misma hora_inicio ocupada -> 409 (guardia del SP)',
      `status=${mismoSlot.status}, error=${mismoSlot.data?.error}`
    );

    const solapado = await req('POST', '/citas', { ...bodyValido, hora_inicio: '10:30' }, tokensPacientes[3]);
    check(
      solapado.status === 409 && solapado.data?.error === 'SLOT_TAKEN',
      'Solapamiento parcial (10:30 vs 10:00-10:45) -> 409',
      `status=${solapado.status}, error=${solapado.data?.error}`
    );

    const diaIncoherente = await req('POST', '/citas', { ...bodyValido, fecha: MARTES, hora_inicio: '12:00' }, tokensPacientes[3]);
    check(
      diaIncoherente.status === 400 && diaIncoherente.data?.error === 'DATE_NOT_IN_BLOCK',
      'Fecha que no calza con el día del bloque -> 400',
      `status=${diaIncoherente.status}, error=${diaIncoherente.data?.error}`
    );

    const bloqueAjeno = await req('POST', '/citas', { ...bodyValido, id_profesional: PROF_MATIAS, id_servicio: SERV_FONO }, tokensPacientes[3]);
    check(
      bloqueAjeno.status === 404 && bloqueAjeno.data?.error === 'BLOCK_NOT_FOUND',
      'Bloque de otro profesional -> 404 BLOCK_NOT_FOUND',
      `status=${bloqueAjeno.status}, error=${bloqueAjeno.data?.error}`
    );

    const bloqueFantasma = await req('POST', '/citas', { ...bodyValido, id_bloque: 999999 }, tokensPacientes[3]);
    check(
      bloqueFantasma.status === 404 && bloqueFantasma.data?.error === 'BLOCK_NOT_FOUND',
      'Bloque inexistente -> 404 BLOCK_NOT_FOUND',
      `status=${bloqueFantasma.status}`
    );

    const servicioFantasma = await req('POST', '/citas', { ...bodyValido, id_servicio: 999999 }, tokensPacientes[3]);
    check(
      servicioFantasma.status === 404 && servicioFantasma.data?.error === 'SERVICE_NOT_FOUND',
      'Servicio inexistente -> 404 SERVICE_NOT_FOUND',
      `status=${servicioFantasma.status}, error=${servicioFantasma.data?.error}`
    );

    const profFantasma = await req('POST', '/citas', { ...bodyValido, id_profesional: 999999 }, tokensPacientes[3]);
    check(
      profFantasma.status === 404 && profFantasma.data?.error === 'THERAPIST_NOT_FOUND',
      'Profesional inexistente -> 404 THERAPIST_NOT_FOUND',
      `status=${profFantasma.status}, error=${profFantasma.data?.error}`
    );

    const horaFuera = await req('POST', '/citas', { ...bodyValido, hora_inicio: '14:00' }, tokensPacientes[3]);
    check(
      horaFuera.status === 400 && horaFuera.data?.error === 'OUT_OF_BLOCK_RANGE',
      'Hora fuera del rango del bloque (14:00) -> 400',
      `status=${horaFuera.status}, error=${horaFuera.data?.error}`
    );

    const muyLargo = await req('POST', '/citas', {
      id_profesional: PROF_CAMILA, id_servicio: SERV_PSICO,
      id_bloque: BLOQUE_GRUPAL_SABADO, fecha: SABADO, hora_inicio: '11:30'
    }, tokensPacientes[3]);
    check(
      muyLargo.status === 400 && muyLargo.data?.error === 'SERVICE_TOO_LONG',
      'Servicio que excede el bloque (11:30 + 50min > 12:00) -> 400',
      `status=${muyLargo.status}, error=${muyLargo.data?.error}`
    );

    // Invariante: ninguno de los rechazos dejó cita alguna.
    const trasRechazos = await citasVigentes(BLOQUE_CAMILA_LUNES, LUNES);
    check(trasRechazos === 3, 'Los rechazos no dejaron citas (rollback efectivo)', `n=${trasRechazos} (esperado 3)`);

    // =================================================================
    // 5. Aforo del bloque grupal (aforo 3, ya hay 2 del seed)
    // =================================================================
    const grupal = {
      id_profesional: PROF_CAMILA, id_servicio: SERV_GRUPAL,
      id_bloque: BLOQUE_GRUPAL_SABADO, fecha: SABADO, hora_inicio: '10:00'
    };

    const tercera = await req('POST', '/citas', grupal, tokensPacientes[2]);
    check(tercera.status === 201, 'Tercera reserva del bloque grupal (2/3 -> 3/3) -> 201', `status=${tercera.status}`);

    const vigentesGrupal = await citasVigentes(BLOQUE_GRUPAL_SABADO, SABADO, '10:00:00');
    check(vigentesGrupal === 3, 'El slot grupal quedó con 3 vigentes', `n=${vigentesGrupal}`);

    const cuarta = await req('POST', '/citas', grupal, tokensPacientes[3]);
    check(
      cuarta.status === 409 && cuarta.data?.error === 'BLOCK_FULL',
      'Cuarta reserva (4/3) -> 409 BLOCK_FULL', `status=${cuarta.status}, error=${cuarta.data?.error}`
    );

    const vigentesTrasCuarta = await citasVigentes(BLOQUE_GRUPAL_SABADO, SABADO, '10:00:00');
    check(vigentesTrasCuarta === 3, 'El rechazado no alteró el aforo (sigue 3)', `n=${vigentesTrasCuarta}`);

    // =================================================================
    // 6. Una cita CANCELADA libera su slot
    // =================================================================
    const slotLiberado = {
      id_profesional: PROF_MATIAS, id_servicio: SERV_FONO,
      id_bloque: BLOQUE_MATIAS_MARTES, fecha: MARTES, hora_inicio: '11:00'
    };
    const liberado = await req('POST', '/citas', slotLiberado, tokensPacientes[3]);
    check(
      liberado.status === 201,
      'El slot de la cita CANCELADA del seed es reutilizable', `status=${liberado.status}`
    );

    const vigentesLiberado = await citasVigentes(BLOQUE_MATIAS_MARTES, MARTES, '11:00:00');
    check(vigentesLiberado === 1, 'Queda 1 vigente en ese slot (la cancelada no cuenta)', `n=${vigentesLiberado}`);

    // =================================================================
    // 7. Endpoint de información
    // =================================================================
    const infoSinToken = await req('GET', '/citas/info');
    check(infoSinToken.status === 401, 'GET /citas/info sin token -> 401', `status=${infoSinToken.status}`);

    const info = await req('GET', '/citas/info', null, tokensPacientes[2]);
    check(
      info.status === 200 && info.data?.user_story === 'US-05 (SCRUM-13)',
      'GET /citas/info con token -> 200', `status=${info.status}`
    );

    // =================================================================
    // 8. Cancelación de cita (baja lógica — complemento del ciclo)
    //    No está en el AC de US-05, pero sin esto un paciente que reserva
    //    dejaría el slot bloqueado para siempre (el agujero que US-09
    //    cerró para las inscripciones a talleres).
    // =================================================================
    const idCitaAna = reserva.data?.data?.id_cita;
    const idCitaGrupal = tercera.data?.data?.id_cita;

    const loginMatias = await req('POST', '/auth/login', { email: 'matias.fuentes@chawal.cl', password: 'Password2026!' });
    const tokenMatias = loginMatias.data?.token;

    const cancelSinToken = await req('DELETE', `/citas/${idCitaAna}`);
    check(cancelSinToken.status === 401, 'DELETE /citas/:id sin token -> 401', `status=${cancelSinToken.status}`);

    const cancelFantasma = await req('DELETE', '/citas/999999', null, tokenAdmin);
    check(cancelFantasma.status === 404, 'DELETE /citas/999999 -> 404', `status=${cancelFantasma.status}`);

    // Propiedad: otro paciente no puede cancelar una cita ajena.
    const ajena = await req('DELETE', `/citas/${idCitaAna}`, null, tokensPacientes[1]);
    check(
      ajena.status === 403 && ajena.data?.error === 'FORBIDDEN',
      'Otro PACIENTE no puede cancelar una cita ajena -> 403',
      `status=${ajena.status}, error=${ajena.data?.error}`
    );

    const propia = await req('DELETE', `/citas/${idCitaAna}`, { motivo: 'Motivo de prueba' }, tokensPacientes[2]);
    check(propia.status === 200, 'La dueña cancela su propia cita -> 200', `status=${propia.status}`);
    check(propia.data?.data?.estado === 'CANCELADA', 'estado = CANCELADA', `estado=${propia.data?.data?.estado}`);
    check(propia.data?.data?.motivo === 'Motivo de prueba', 'motivo persistido', `motivo=${propia.data?.data?.motivo}`);

    const vigentesTrasCancelar = await citasVigentes(BLOQUE_CAMILA_LUNES, LUNES, '11:00:00');
    check(vigentesTrasCancelar === 0, 'La cita cancelada ya no ocupa el slot', `n=${vigentesTrasCancelar}`);

    // El slot queda reutilizable: slot_activo pasa a NULL por ser generada.
    const reReserva = await req('POST', '/citas', bodyValido, tokensPacientes[3]);
    check(reReserva.status === 201, 'El slot liberado se puede volver a reservar -> 201', `status=${reReserva.status}`);

    const ocupadosTrasCiclo = await ocupadosDe(PROF_CAMILA, LUNES, tokenAdmin);
    check(
      ocupadosTrasCiclo === 3,
      'La ocupación derivada refleja el ciclo (cancelada fuera, nueva dentro)',
      `ocupados=${ocupadosTrasCiclo}`
    );

    const dobleCancel = await req('DELETE', `/citas/${idCitaAna}`, null, tokensPacientes[2]);
    check(
      dobleCancel.status === 409 && dobleCancel.data?.error === 'ALREADY_CANCELLED',
      'Cancelar dos veces -> 409 ALREADY_CANCELLED',
      `status=${dobleCancel.status}, error=${dobleCancel.data?.error}`
    );

    // TERAPEUTA: solo las citas de su propia agenda.
    const idCitaNueva = reReserva.data?.data?.id_cita;

    const terapeutaAjeno = await req('DELETE', `/citas/${idCitaNueva}`, null, tokenMatias);
    check(
      terapeutaAjeno.status === 403 && terapeutaAjeno.data?.error === 'FORBIDDEN',
      'TERAPEUTA de otra agenda -> 403',
      `status=${terapeutaAjeno.status}, error=${terapeutaAjeno.data?.error}`
    );

    const terapeutaDueno = await req('DELETE', `/citas/${idCitaNueva}`, null, tokenTerapeuta);
    check(
      terapeutaDueno.status === 200,
      'La TERAPEUTA dueña de la agenda cancela -> 200',
      `status=${terapeutaDueno.status}`
    );

    const adminCancela = await req('DELETE', `/citas/${idCitaGrupal}`, null, tokenAdmin);
    check(
      adminCancela.status === 200,
      'ADMINISTRADOR cancela cualquier cita -> 200',
      `status=${adminCancela.status}`
    );

    // Estado no cancelable: se prepara una cita ATENDIDA con SQL directo
    // (la cita 4 es de Valentina y no colisiona con nada).
    await conn.query("UPDATE citas SET estado = 'ATENDIDA' WHERE id_cita = 4");
    const noCancelable = await req('DELETE', '/citas/4', null, tokenAdmin);
    check(
      noCancelable.status === 409 && noCancelable.data?.error === 'NOT_CANCELLABLE',
      'Cita ATENDIDA -> 409 NOT_CANCELLABLE',
      `status=${noCancelable.status}, error=${noCancelable.data?.error}`
    );
    await conn.query("UPDATE citas SET estado = 'PENDIENTE' WHERE id_cita = 4");

  } catch (err) {
    fail++;
    console.log(`FALLA | Excepción no controlada: ${err.message}`);
  } finally {
    await conn.end();
  }

  console.log(`${'─'.repeat(110)}`);
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  console.log('NOTA: este script crea citas. Re-ejecuta `npm run db:setup` para limpiar.\n');
  process.exit(fail === 0 ? 0 : 1);
})();
