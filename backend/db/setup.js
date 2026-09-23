#!/usr/bin/env node
// =====================================================================
//  S.A.P.C. — CHAWAL  |  Runner de base de datos
//  Archivo: db/setup.js
// =====================================================================
//  Ejecuta en ORDEN:
//    1. schema.sql                 tablas, índices, constraints, vista
//    2. stored_procedures/*.sql    sp_agendar_cita
//    3. triggers/*.sql             validaciones + control de aforo
//    4. seed.sql                   datos maestros y de prueba
//
//  Uso:  npm run db:setup
//
//  Notas técnicas:
//    - DELIMITER es un comando del CLIENTE mysql, no del servidor: el
//      driver mysql2 no lo entiende, por eso se elimina de cada archivo
//      antes de enviarlo.
//    - Se usa multipleStatements: true para enviar cada archivo completo;
//      el parser del SERVIDOR sí comprende los bloques BEGIN...END.
//    - El orden importa: seed.sql inserta citas grupales que dependen de
//      trg_citas_bi_validacion (que deriva es_grupal).
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_DIR = __dirname;
const DB_NAME = process.env.DB_NAME || 'chawal_db';

/**
 * Normaliza un archivo .sql para el driver mysql2.
 *
 * `DELIMITER` es un comando del CLIENTE mysql, no del servidor. El driver
 * no lo entiende, así que hay que:
 *   1. Quitar las líneas `DELIMITER x`.
 *   2. Quitar las apariciones del delimitador personalizado al final de
 *      línea (p. ej. `END //` -> `END`), que sólo servían para que el
 *      cliente no partiera el bloque BEGIN...END.
 *
 * El parser del SERVIDOR sí comprende los `;` internos del bloque, por lo
 * que la sentencia llega completa gracias a multipleStatements.
 */
const normalizeSql = (sql) => {
  const delimitadores = new Set();
  const lineas = [];

  for (const raw of sql.split(/\r?\n/)) {
    const match = raw.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (match) {
      if (match[1] !== ';') delimitadores.add(match[1]);
      continue;
    }
    lineas.push(raw);
  }

  let text = lineas.join('\n');

  for (const delim of delimitadores) {
    const escapado = delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`[ \\t]*${escapado}[ \\t]*$`, 'gm'), '');
  }

  return text;
};

/** Devuelve los .sql de un subdirectorio, ordenados alfabéticamente. */
const sqlFilesIn = (dir) => {
  const full = path.join(DB_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort()
    .map((f) => path.join(full, f));
};

/** Objetos programables que deben existir tras una ejecución completa. */
const ESPERADOS = {
  TRIGGER: [
    'trg_citas_ai_auditoria',
    'trg_citas_bi_validacion',
    'trg_citas_bu_validacion',
    'trg_control_aforo_clases',
    'trg_inscripcion_cupo_delete',
    'trg_inscripcion_cupo_update'
  ],
  PROCEDURE: ['sp_agendar_cita']
};

const linea = '─'.repeat(60);

(async () => {
  const pasos = [
    { label: 'schema.sql', file: path.join(DB_DIR, 'schema.sql') },
    ...sqlFilesIn('stored_procedures').map((f) => ({
      label: `stored_procedures/${path.basename(f)}`,
      file: f
    })),
    ...sqlFilesIn('triggers').map((f) => ({
      label: `triggers/${path.basename(f)}`,
      file: f
    })),
    { label: 'seed.sql', file: path.join(DB_DIR, 'seed.sql') }
  ];

  console.log(`\nSAPC — setup de base de datos "${DB_NAME}"\n${linea}`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      multipleStatements: true,
      charset: 'utf8mb4_unicode_ci'
    });
  } catch (err) {
    console.error(`\n✗ No se pudo conectar a MySQL: ${err.message}`);
    console.error('  Revisa DB_HOST, DB_PORT, DB_USER y DB_PASS en backend/.env\n');
    process.exit(1);
  }

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${DB_NAME}\``);
    console.log(`  • Base de datos "${DB_NAME}" disponible`);

    for (const paso of pasos) {
      if (!fs.existsSync(paso.file)) {
        console.error(`  ✗ ${paso.label} — archivo no encontrado`);
        process.exit(1);
      }
      const sql = normalizeSql(fs.readFileSync(paso.file, 'utf8'));
      await conn.query(sql);
      console.log(`  ✓ ${paso.label}`);
    }

    // -----------------------------------------------------------------
    // Verificación de objetos programables
    // -----------------------------------------------------------------
    const [objetos] = await conn.query(
      `SELECT TRIGGER_NAME AS nombre FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = ?
        UNION ALL
       SELECT ROUTINE_NAME AS nombre FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
      [DB_NAME, DB_NAME]
    );
    const existentes = objetos.map((o) => o.nombre);

    console.log(`\n  Verificación de objetos programables`);
    console.log(`  ${'·'.repeat(56)}`);

    const faltantes = [];
    for (const [tipo, nombres] of Object.entries(ESPERADOS)) {
      for (const nombre of nombres) {
        const ok = existentes.includes(nombre);
        if (!ok) faltantes.push(nombre);
        console.log(`    ${ok ? '✓' : '✗'} ${tipo.padEnd(9)} ${nombre}`);
      }
    }

    if (faltantes.length > 0) {
      console.error(`\n✗ Faltan objetos: ${faltantes.join(', ')}\n`);
      process.exit(1);
    }

    console.log(`\n${linea}`);
    console.log(`✓ Base de datos lista (${pasos.length} archivos aplicados)\n`);
  } catch (err) {
    console.error(`\n✗ Error durante el setup:\n  ${err.message}`);
    if (err.sqlMessage && err.sqlMessage !== err.message) {
      console.error(`  SQL: ${err.sqlMessage}`);
    }
    if (err.sql) {
      console.error(`\n  Sentencia:\n${String(err.sql).trim().slice(0, 400)}\n`);
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
