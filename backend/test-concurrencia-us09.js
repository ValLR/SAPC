// =====================================================================
//  S.A.P.C. — CHAWAL  |  Concurrencia del aforo (US-09)
//  Archivo: backend/test-concurrencia-us09.js
// =====================================================================
//  Demuestra la CADENA COMPLETA del AC de US-09 (Escenario 2):
//
//      petición HTTP -> trigger TRIGGER aborta con SIGNAL SQLSTATE '45000'
//                    -> la API responde status 400 Bad Request
//
//  Por qué hace falta este test:
//    En un flujo SECUENCIAL el rechazo lo produce el pre-check de la
//    aplicación (`cupos_disponibles <= 0`) y el trigger nunca llega a
//    ejecutarse. El trigger es la RED DE SEGURIDAD contra la sobreventa y
//    sólo entra en acción cuando varias peticiones pasan el pre-check a la
//    vez. Sin concurrencia, esa rama del controlador queda sin ejercitar.
//
//  Escenarios:
//    A) DETERMINISTA — fuerza la carrera manteniendo un lock externo sobre
//       la fila de la clase, de modo que el pre-check lea el cupo viejo y
//       sea el TRIGGER quien rechace. Comprueba que el mensaje devuelto
//       proviene de la rama del trigger (no del pre-check).
//    B) CARGA REAL — N peticiones simultáneas sobre el último cupo:
//       exactamente 1 prospera y nunca hay sobreventa.
//
//  Uso:  node test-concurrencia-us09.js
//  Requiere: servidor arriba (npm run dev) + npm run db:setup
// =====================================================================

// Carga .env desde la carpeta del script (no desde el cwd).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const BASE = 'http://localhost:3000/api';
const CLASE_A = '__TEST_CONC_A__';
const CLASE_B = '__TEST_CONC_B__';

// Mensajes que distinguen qué guardó el rechazo. Deben coincidir con
// classesController.reserveClass.
const MSG_PRE_CHECK = 'ya no cuenta con aforo disponible';
const MSG_TRIGGER = 'alcanzó su límite de capacidad';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(56)} | ${detalle}`);

let ok = 0, fail = 0;
const check = (cond, etiqueta, detalle) => {
  if (cond) ok++; else fail++;
  log(cond, etiqueta, detalle);
};

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

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log(`\nVerificando concurrencia del aforo en: ${BASE}\n${'─'.repeat(110)}`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'chawal_db'
  });

  // Conexión aparte que mantendrá el lock sobre la fila de la clase.
  const locker = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'chawal_db'
  });

  const cuposDe = async (idClase) => {
    const [r] = await conn.query(
      'SELECT cupos_disponibles FROM clases_grupales WHERE id_clase = ?', [idClase]
    );
    return r[0]?.cupos_disponibles;
  };

  const inscripcionesActivas = async (idClase) => {
    const [r] = await conn.query(
      `SELECT COUNT(*) AS n FROM inscripciones_clases
        WHERE id_clase = ? AND estado_inscripcion = 'ACTIVA'`, [idClase]
    );
    return Number(r[0].n);
  };

  const crearClase = async (nombre) => {
    await conn.query('DELETE FROM clases_grupales WHERE nombre_actividad = ?', [nombre]);
    const [ins] = await conn.query(
      `INSERT INTO clases_grupales
         (nombre_actividad, descripcion, sala, id_instructor, aforo_maximo,
          cupos_disponibles, fecha_clase, hora_inicio, hora_fin)
       VALUES (?, 'Clase temporal de concurrencia', '__TEST_SALA__', 1, 1, 1,
               '2026-12-20', '10:00:00', '11:00:00')`,
      [nombre]
    );
    return ins.insertId;
  };

  let idA = null, idB = null;

  try {
    // ---------------------------------------------------------------
    //  Tokens de los 3 pacientes del seed
    // ---------------------------------------------------------------
    const tokens = [];
    for (const email of ['pedro.gonzalez@mail.cl', 'ana.munoz@mail.cl', 'luis.perez@mail.cl']) {
      const r = await req('POST', '/auth/login', { email, password: 'Password2026!' });
      if (r.data?.token) tokens.push(r.data.token);
    }
    check(tokens.length === 3, 'Tokens de 3 pacientes', `n=${tokens.length}`);

    // ===============================================================
    //  ESCENARIO A — El TRIGGER es quien rechaza (determinista)
    // ===============================================================
    console.log('\n── Escenario A: el trigger aborta y la API responde 400 ──');

    idA = await crearClase(CLASE_A);
    check(await cuposDe(idA) === 1, 'Clase A creada con 1 cupo', `id=${idA}`);

    // Se abre una transacción que BLOQUEA la fila de la clase y deja
    // cupos_disponibles = 0 SIN confirmar. Para el pre-check del
    // controlador (lectura no bloqueante) el valor sigue siendo 1, así
    // que la petición pasa el pre-check y llega al INSERT, donde el
    // trigger la espera con su propio FOR UPDATE.
    await locker.query('START TRANSACTION');
    await locker.query(
      'SELECT cupos_disponibles FROM clases_grupales WHERE id_clase = ? FOR UPDATE', [idA]
    );
    await locker.query(
      'UPDATE clases_grupales SET cupos_disponibles = 0 WHERE id_clase = ?', [idA]
    );

    // Petición en vuelo (no se espera todavía).
    const peticionA = req('POST', `/classes/${idA}/reserve`, null, tokens[0]);

    // Se espera a que aparezca una transacción en espera de lock: eso
    // prueba que la petición ya llegó al INSERT y el trigger está
    // bloqueado en su SELECT ... FOR UPDATE.
    let bloqueada = false;
    for (let i = 0; i < 60 && !bloqueada; i++) {
      const [r] = await locker.query(
        `SELECT COUNT(*) AS n FROM information_schema.INNODB_TRX
          WHERE trx_state = 'LOCK WAIT'`
      );
      bloqueada = Number(r[0].n) > 0;
      if (!bloqueada) await esperar(100);
    }
    check(bloqueada, 'El trigger quedó esperando el lock (FOR UPDATE)', `lock_wait=${bloqueada}`);

    // Se confirma cupos = 0 -> el trigger despierta, lee 0 y lanza SIGNAL.
    await locker.query('COMMIT');

    const respA = await peticionA;
    check(respA.status === 400, 'La API responde 400 con aforo agotado', `status=${respA.status}`);
    check(respA.data?.error === 'CLASS_FULL', 'error = CLASS_FULL', `error=${respA.data?.error}`);
    check(
      (respA.data?.message || '').includes(MSG_TRIGGER),
      'El rechazo provino del TRIGGER (no del pre-check)',
      `msg="${respA.data?.message}"`
    );
    check(await inscripcionesActivas(idA) === 0, 'No quedó ninguna inscripción', `n=${await inscripcionesActivas(idA)}`);

    // ===============================================================
    //  ESCENARIO B — N peticiones simultáneas, sin sobreventa
    // ===============================================================
    console.log('\n── Escenario B: 3 peticiones simultáneas sobre 1 cupo ──');

    idB = await crearClase(CLASE_B);
    check(await cuposDe(idB) === 1, 'Clase B creada con 1 cupo', `id=${idB}`);

    const resultados = await Promise.all(
      tokens.map((t) => req('POST', `/classes/${idB}/reserve`, null, t))
    );

    const exitos = resultados.filter((r) => r.status === 200);
    const rechazos400 = resultados.filter((r) => r.status === 400 && r.data?.error === 'CLASS_FULL');
    const errores500 = resultados.filter((r) => r.status === 500);
    const statuses = resultados.map((r) => r.status).join(',');
    const desdeTrigger = rechazos400.filter((r) =>
      (r.data?.message || '').includes(MSG_TRIGGER)
    ).length;
    const desdePreCheck = rechazos400.filter((r) =>
      (r.data?.message || '').includes(MSG_PRE_CHECK)
    ).length;

    check(exitos.length === 1, 'Exactamente 1 inscripción prosperó', `exitos=${exitos.length} [${statuses}]`);
    check(rechazos400.length === 2, 'Las otras 2 fueron rechazadas con 400 CLASS_FULL', `n=${rechazos400.length} [${statuses}]`);
    check(errores500.length === 0, 'Ninguna devolvió 500', `n=${errores500.length} [${statuses}]`);

    // Invariantes de integridad: el aforo nunca se desborda.
    const cuposFinales = await cuposDe(idB);
    const activasFinales = await inscripcionesActivas(idB);
    check(cuposFinales === 0, 'Cupos finales = 0 (aforo respetado)', `cupos=${cuposFinales}`);
    check(activasFinales === 1, 'Inscripciones ACTIVA = 1 (sin sobreventa)', `n=${activasFinales}`);
    check(activasFinales <= 1, 'Inscripciones nunca superan aforo_maximo', `n=${activasFinales}, aforo=1`);

    // Se reporta qué guardó rechazó; bajo carga real se espera que al
    // menos una petición llegue hasta el trigger.
    console.log(
      `${' '.repeat(7)}│ rechazos por TRIGGER=${desdeTrigger}, por PRE-CHECK=${desdePreCheck}`
    );

  } catch (err) {
    fail++;
    console.log(`FALLA | Excepción no controlada: ${err.message}`);
  } finally {
    try { await locker.query('ROLLBACK'); } catch { /* sin transacción abierta */ }
    await locker.end();
    for (const id of [idA, idB].filter(Boolean)) {
      // El DELETE en cascada debe ser tolerado por trg_inscripcion_cupo_delete.
      await conn.query('DELETE FROM clases_grupales WHERE id_clase = ?', [id]);
    }
    await conn.end();
    console.log('  (clases de prueba eliminadas)');
  }

  console.log(`${'─'.repeat(110)}`);
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
