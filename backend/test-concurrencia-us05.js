// =====================================================================
//  S.A.P.C. — CHAWAL  |  Concurrencia del agendamiento (US-05)
//  Archivo: backend/test-concurrencia-us05.js
// =====================================================================
//  Uso:
//    1. Aplicar el seed:  npm run db:setup
//    2. Arrancar la API:  npm start        (o npm run dev)
//    3. Ejecutar:         node test-concurrencia-us05.js
//
//  Escenario 2 del AC ("dos pacientes intentan agendar el mismo bloque al
//  mismo tiempo") necesita concurrencia REAL: en una secuencia normal el
//  rechazo lo produce el COUNT(*) del propio SP, no la carrera.
//
//  ESCENARIO A — determinista:
//     Una segunda conexión bloquea la fila del bloque con FOR UPDATE y
//     deja una cita vigente en el mismo slot SIN confirmar. La petición
//     del paciente queda entonces ESPERANDO el lock: cuando aparezca
//     `trx_state = 'LOCK WAIT'` en information_schema.INNODB_TRX queda
//     PROBADO que el SP tomó el bloqueo pesimista (eso es exactamente
//     "prevenir técnicamente el solapamiento"). Al confirmar la otra
//     transacción, el SP despierta, ve la cita previa y aborta con
//     ROLLBACK -> la API responde 409.
//
//  ESCENARIO B — carga real:
//     3 pacientes piden el MISMO slot libre con Promise.all. Solo una
//     puede quedar: se verifica que exactamente 1 prospere, que las otras
//     reciban 409 (el que gane puede ser el COUNT(*) del SP o el índice
//     único uq_citas_slot) y que la BD quede sin sobreventa.
//
//  No altera el seed de forma permanente: borra las citas que crea y sus
//  filas de auditoría al terminar.
// =====================================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const mysql = require('mysql2/promise');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

// --- Fixtures (seed) --------------------------------------------------
const BLOQUE_CAMILA_LUNES = 1;      // prof 1, Lunes 09-13, aforo 1
const BLOQUE_CAMILA_MIERCOLES = 2;  // prof 1, Miércoles 09-13, aforo 1
const PROF_CAMILA = 1;
const SERV_KINESIO = 1;             // 45 min
const LUNES = '2026-10-05';
const MIERCOLES = '2026-10-07';

// Slots elegidos porque están LIBRES en el seed y no los toca test-us05.js:
//   05/10 12:00 (bloque 1) y 07/10 09:00 (bloque 2).
const HORA_A = '12:00';
const HORA_B = '09:00';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(58)} | ${detalle}`);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
  console.log(`\nVerificando concurrencia del agendamiento en: ${BASE}\n${'─'.repeat(110)}`);

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'chawal_db'
  };
  const conn = await mysql.createConnection(cfg);
  const locker = await mysql.createConnection(cfg);   // mantiene el lock externo

  const citasVigentes = async (idBloque, fecha, horaInicio) => {
    const [r] = await conn.query(
      `SELECT COUNT(*) AS n FROM citas
        WHERE id_bloque = ? AND fecha_cita = ? AND hora_inicio = ?
          AND estado NOT IN ('CANCELADA','NO_ASISTIO')`,
      [idBloque, fecha, horaInicio]
    );
    return Number(r[0].n);
  };

  const borrarCita = async (idCita) => {
    if (!idCita) return;
    await conn.query('DELETE FROM citas WHERE id_cita = ?', [idCita]);
    await conn.query(
      `DELETE FROM auditoria WHERE tabla_afectada = 'citas' AND id_registro = ?`,
      [idCita]
    );
  };

  const creadas = [];   // ids de citas a limpiar al final

  try {
    // -----------------------------------------------------------------
    //  Tokens
    // -----------------------------------------------------------------
    const tokens = [];
    for (const email of ['pedro.gonzalez@mail.cl', 'ana.munoz@mail.cl', 'luis.perez@mail.cl']) {
      const r = await req('POST', '/auth/login', { email, password: 'Password2026!' });
      if (r.data?.token) tokens.push(r.data.token);
    }
    check(tokens.length === 3, 'Tokens de 3 pacientes', `n=${tokens.length}`);

    // =================================================================
    //  ESCENARIO A — el SP espera el lock y detecta la cita previa
    // =================================================================
    console.log('\n── Escenario A: el SP espera el lock y aborta con 409 ──');

    check(
      await citasVigentes(BLOQUE_CAMILA_LUNES, LUNES, `${HORA_A}:00`) === 0,
      'Slot A libre en el seed (precondición)', `slot=${LUNES} ${HORA_A}`
    );

    // La conexión externa bloquea la fila del bloque y, dentro de la misma
    // transacción, deja una cita vigente en el slot que pedirá la API.
    // Nada de esto es visible para las lecturas no bloqueantes de otras
    // sesiones hasta el COMMIT.
    await locker.query('START TRANSACTION');
    await locker.query(
      'SELECT aforo_maximo FROM bloques_horarios WHERE id_bloque = ? FOR UPDATE',
      [BLOQUE_CAMILA_LUNES]
    );
    const [ins] = await locker.query(
      `INSERT INTO citas (id_paciente, id_profesional, id_servicio, id_bloque,
                          fecha_cita, hora_inicio, hora_fin, estado)
       VALUES (3, ?, ?, ?, ?, ?, '12:45:00', 'CONFIRMADA')`,
      [PROF_CAMILA, SERV_KINESIO, BLOQUE_CAMILA_LUNES, LUNES, `${HORA_A}:00`]
    );
    const citaDelLocker = ins.insertId;
    creadas.push(citaDelLocker);

    // Petición en vuelo (todavía no se espera).
    const peticion = req('POST', '/citas', {
      id_profesional: PROF_CAMILA, id_servicio: SERV_KINESIO,
      id_bloque: BLOQUE_CAMILA_LUNES, fecha: LUNES, hora_inicio: HORA_A
    }, tokens[1]);

    // Se espera a que aparezca una transacción en LOCK WAIT: eso prueba
    // que la petición llegó al SP y está bloqueada en su
    // SELECT ... FROM bloques_horarios ... FOR UPDATE.
    let bloqueada = false;
    for (let i = 0; i < 60 && !bloqueada; i++) {
      const [r] = await locker.query(
        `SELECT COUNT(*) AS n FROM information_schema.INNODB_TRX
          WHERE trx_state = 'LOCK WAIT'`
      );
      bloqueada = Number(r[0].n) > 0;
      if (!bloqueada) await esperar(100);
    }
    check(bloqueada, 'El SP quedó esperando el lock del bloque (FOR UPDATE)', `lock_wait=${bloqueada}`);

    // Al confirmar, el SP despierta, cuenta la cita vigente y aborta.
    await locker.query('COMMIT');

    const respA = await peticion;
    check(respA.status === 409, 'Segunda reserva del mismo slot -> 409 Conflict', `status=${respA.status}`);
    check(
      respA.data?.error === 'BLOCK_FULL',
      'error = BLOCK_FULL (lo detecta el COUNT del SP)', `error=${respA.data?.error}`
    );

    const vigentesA = await citasVigentes(BLOQUE_CAMILA_LUNES, LUNES, `${HORA_A}:00`);
    check(vigentesA === 1, 'Quedó 1 sola cita vigente en el slot (sin doble reserva)', `n=${vigentesA}`);
    check(vigentesA <= 1, 'El aforo del bloque nunca se desbordó', `n=${vigentesA}, aforo=1`);

    // =================================================================
    //  ESCENARIO B — 3 peticiones simultáneas sobre un slot libre
    // =================================================================
    console.log('\n── Escenario B: 3 peticiones simultáneas sobre 1 cupo ──');

    check(
      await citasVigentes(BLOQUE_CAMILA_MIERCOLES, MIERCOLES, `${HORA_B}:00`) === 0,
      'Slot B libre en el seed (precondición)', `slot=${MIERCOLES} ${HORA_B}`
    );

    const body = {
      id_profesional: PROF_CAMILA, id_servicio: SERV_KINESIO,
      id_bloque: BLOQUE_CAMILA_MIERCOLES, fecha: MIERCOLES, hora_inicio: HORA_B
    };

    const resultados = await Promise.all(tokens.map((t) => req('POST', '/citas', body, t)));

    const statuses = resultados.map((r) => r.status).join(',');
    const exitos = resultados.filter((r) => r.status === 201);
    const rechazos = resultados.filter((r) => r.status === 409);
    const errores500 = resultados.filter((r) => r.status === 500);
    const porAforo = rechazos.filter((r) => r.data?.error === 'BLOCK_FULL').length;
    const porIndice = rechazos.filter((r) => r.data?.error === 'SLOT_TAKEN').length;

    for (const r of exitos) {
      if (r.data?.data?.id_cita) creadas.push(r.data.data.id_cita);
    }

    check(exitos.length === 1, 'Exactamente 1 reserva prosperó', `exitos=${exitos.length} [${statuses}]`);
    check(rechazos.length === 2, 'Las otras 2 fueron rechazadas con 409', `n=${rechazos.length} [${statuses}]`);
    check(errores500.length === 0, 'Ninguna devolvió 500', `n=${errores500.length} [${statuses}]`);

    const vigentesB = await citasVigentes(BLOQUE_CAMILA_MIERCOLES, MIERCOLES, `${HORA_B}:00`);
    check(vigentesB === 1, 'Sin sobreventa: 1 cita vigente en el slot', `n=${vigentesB}`);
    check(vigentesB <= 1, 'El aforo se respetó bajo concurrencia real', `n=${vigentesB}, aforo=1`);

    // Bajo carrera, quién detecta el conflicto puede ser el COUNT del SP
    // o el índice único uq_citas_slot; ambos desembocan en 409.
    console.log(
      `${' '.repeat(7)}│ rechazos por COUNT del SP=${porAforo}, por índice único=${porIndice}`
    );

  } catch (err) {
    fail++;
    console.log(`FALLA | Excepción no controlada: ${err.message}`);
  } finally {
    try { await locker.query('ROLLBACK'); } catch { /* ya confirmado */ }
    await locker.end();

    for (const id of creadas) {
      try { await borrarCita(id); } catch { /* ya borrada */ }
    }

    await conn.end();
    console.log('  (citas de prueba eliminadas)');
  }

  console.log(`${'─'.repeat(110)}`);
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
