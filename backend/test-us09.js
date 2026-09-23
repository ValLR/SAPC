// =====================================================================
//  S.A.P.C. — CHAWAL  |  Verificación de triggers de aforo (US-09)
//  Archivo: backend/test-us09.js
// =====================================================================
//  Prueba el CICLO COMPLETO del aforo a nivel de base de datos:
//
//    1. INSERT reserva           -> cupos -1
//    2. INSERT sin cupo          -> SIGNAL 45000 (aborta)
//    3. UPDATE ACTIVA->CANCELADA -> cupos +1   (el gap que cierra US-09)
//    4. Re-inscribir tras cancelar -> ya no queda bloqueado
//    5. UPDATE CANCELADA->ACTIVA -> cupos -1 (valida disponibilidad)
//    6. UPDATE CANCELADA->ACTIVA sin cupo -> SIGNAL 45000
//    7. DELETE reserva ACTIVA    -> cupos +1
//    8. DELETE reserva CANCELADA -> sin cambio
//
//  Uso:  node test-us09.js
//  Requiere:  npm run db:setup  (o BD ya inicializada)
// =====================================================================

// Carga .env desde la carpeta del script (no desde el cwd) para que
// funcione sin importar desde dónde se invoque `node test-us09.js`.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const CLASE_TEST = '__TEST_US09__';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(56)} | ${detalle}`);

let ok = 0, fail = 0;
const check = (cond, etiqueta, detalle) => {
  if (cond) ok++; else fail++;
  log(cond, etiqueta, detalle);
};

(async () => {
  console.log(`\nVerificando triggers de aforo (US-09)\n${'─'.repeat(110)}`);

  const conn = await mysql.createConnection({
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

  let idClase = null;

  try {
    // -----------------------------------------------------------------
    // Preparación: clase de prueba con aforo 2 y cupos 2
    // -----------------------------------------------------------------
    await conn.query('DELETE FROM clases_grupales WHERE nombre_actividad = ?', [CLASE_TEST]);

    const [ins] = await conn.query(
      `INSERT INTO clases_grupales
         (nombre_actividad, descripcion, sala, id_instructor, aforo_maximo,
          cupos_disponibles, fecha_clase, hora_inicio, hora_fin)
       VALUES (?, 'Clase temporal de verificación', '__TEST_SALA__', 1, 2,
               2, '2026-12-15', '10:00:00', '11:00:00')`,
      [CLASE_TEST]
    );
    idClase = ins.insertId;
    check(await cuposDe(idClase) === 2, 'Clase de prueba creada (aforo 2, cupos 2)', `id=${idClase}`);

    // -----------------------------------------------------------------
    // 1. INSERT descuenta cupo
    // -----------------------------------------------------------------
    const [r1] = await conn.query(
      `INSERT INTO reservas_clases (id_paciente, id_clase, estado_reserva)
       VALUES (1, ?, 'ACTIVA')`, [idClase]
    );
    const idR1 = r1.insertId;
    check(await cuposDe(idClase) === 1, '[1] INSERT reserva -> cupos 2→1', `cupos=${await cuposDe(idClase)}`);

    const [r2] = await conn.query(
      `INSERT INTO reservas_clases (id_paciente, id_clase, estado_reserva)
       VALUES (2, ?, 'ACTIVA')`, [idClase]
    );
    const idR2 = r2.insertId;
    check(await cuposDe(idClase) === 0, '[1] Segundo INSERT -> cupos 1→0', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 2. INSERT sin cupo -> aborta
    // -----------------------------------------------------------------
    let aborto = false;
    try {
      await conn.query(
        `INSERT INTO reservas_clases (id_paciente, id_clase, estado_reserva)
         VALUES (3, ?, 'ACTIVA')`, [idClase]
      );
    } catch (e) {
      aborto = e.sqlState === '45000';
    }
    check(aborto, '[2] INSERT con cupos=0 -> SIGNAL 45000', `abortado=${aborto}`);

    // -----------------------------------------------------------------
    // 3. CANCELAR devuelve el cupo  ← EL GAP QUE CIERRA US-09
    // -----------------------------------------------------------------
    await conn.query(
      `UPDATE reservas_clases SET estado_reserva = 'CANCELADA' WHERE id_reserva_clase = ?`, [idR1]
    );
    check(await cuposDe(idClase) === 1, '[3] ACTIVA→CANCELADA devuelve cupo (0→1)', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 4. El cupo liberado se puede reutilizar por otro paciente
    // -----------------------------------------------------------------
    const [r3] = await conn.query(
      `INSERT INTO reservas_clases (id_paciente, id_clase, estado_reserva)
       VALUES (3, ?, 'ACTIVA')`, [idClase]
    );
    const idR3 = r3.insertId;
    check(await cuposDe(idClase) === 0, '[4] Cupo liberado reutilizable (1→0)', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 5. REACTIVAR consume cupo cuando hay disponibilidad
    // -----------------------------------------------------------------
    await conn.query(
      `UPDATE reservas_clases SET estado_reserva = 'CANCELADA' WHERE id_reserva_clase = ?`, [idR3]
    );
    check(await cuposDe(idClase) === 1, '[5a] Cancelar libera (0→1)', `cupos=${await cuposDe(idClase)}`);

    await conn.query(
      `UPDATE reservas_clases SET estado_reserva = 'ACTIVA' WHERE id_reserva_clase = ?`, [idR3]
    );
    check(await cuposDe(idClase) === 0, '[5b] CANCELADA→ACTIVA consume cupo (1→0)', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 6. REACTIVAR sin cupo -> aborta
    // -----------------------------------------------------------------
    // idR1 sigue CANCELADA; la clase está llena (idR2 e idR3 activas).
    let abortoReactivar = false;
    try {
      await conn.query(
        `UPDATE reservas_clases SET estado_reserva = 'ACTIVA' WHERE id_reserva_clase = ?`, [idR1]
      );
    } catch (e) {
      abortoReactivar = e.sqlState === '45000';
    }
    check(abortoReactivar, '[6] CANCELADA→ACTIVA sin cupo -> SIGNAL 45000', `abortado=${abortoReactivar}`);
    check(await cuposDe(idClase) === 0, '[6] El cupo no cambió tras el aborto', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 7. DELETE de reserva ACTIVA devuelve el cupo
    // -----------------------------------------------------------------
    await conn.query('DELETE FROM reservas_clases WHERE id_reserva_clase = ?', [idR2]);
    check(await cuposDe(idClase) === 1, '[7] DELETE reserva ACTIVA devuelve cupo (0→1)', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 8. DELETE de reserva CANCELADA no altera el cupo
    // -----------------------------------------------------------------
    await conn.query('DELETE FROM reservas_clases WHERE id_reserva_clase = ?', [idR1]); // CANCELADA
    check(await cuposDe(idClase) === 1, '[8] DELETE reserva CANCELADA no altera cupos', `cupos=${await cuposDe(idClase)}`);

    // -----------------------------------------------------------------
    // 9. Guarda de integridad: cupos nunca supera el aforo
    // -----------------------------------------------------------------
    await conn.query('DELETE FROM reservas_clases WHERE id_reserva_clase = ?', [idR3]); // ACTIVA
    check(await cuposDe(idClase) === 2, '[9] Todos liberados -> cupos = aforo (2)', `cupos=${await cuposDe(idClase)}`);

  } catch (err) {
    fail++;
    console.log(`FALLA | Excepción no controlada: ${err.message}`);
  } finally {
    if (idClase) {
      // El DELETE de la clase dispara el cascade sobre reservas_clases;
      // trg_reserva_cupo_delete debe tolerarlo sin errores.
      await conn.query('DELETE FROM clases_grupales WHERE id_clase = ?', [idClase]);
      console.log(`${'─'.repeat(110)}`);
      console.log('  (clase de prueba eliminada)');
    }
    await conn.end();
  }

  console.log(`${'─'.repeat(110)}`);
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
