// =====================================================================
//  S.A.P.C. — CHAWAL  |  Pool de conexiones MySQL
//  Archivo: backend/src/config/db.js
// =====================================================================
//  Usa mysql2/promise para consultas con async/await.
//  Las credenciales se leen de variables de entorno (.env).
// =====================================================================

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASS || '',
  database:           process.env.DB_NAME || 'chawal_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4_unicode_ci'
});

// ---------------------------------------------------------------------
//  Verificación de conexión + objetos programables al arrancar
//  (no bloquea el inicio del servidor)
//
//  Los triggers y stored procedures viven en db/triggers/ y
//  db/stored_procedures/. Si alguien ejecuta solo schema.sql, la API
//  arranca pero el aforo deja de funcionar en silencio: este chequeo
//  convierte ese fallo silencioso en una advertencia visible.
// ---------------------------------------------------------------------
const OBJETOS_REQUERIDOS = {
  TRIGGER: [
    'trg_citas_ai_auditoria',
    'trg_citas_bi_validacion',
    'trg_citas_bu_validacion',
    'trg_control_aforo_clases',
    'trg_reserva_cupo_delete',
    'trg_reserva_cupo_update'
  ],
  PROCEDURE: ['sp_agendar_cita']
};

pool.getConnection()
  .then(async (conn) => {
    const bd = process.env.DB_NAME || 'chawal_db';
    console.log(`Conexión a MySQL establecida (BD: ${bd})`);

    try {
      const [objetos] = await conn.query(
        `SELECT TRIGGER_NAME AS nombre FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = ?
          UNION ALL
         SELECT ROUTINE_NAME AS nombre FROM information_schema.ROUTINES
          WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
        [bd, bd]
      );
      const existentes = objetos.map((o) => o.nombre);

      const faltantes = Object.entries(OBJETOS_REQUERIDOS)
        .flatMap(([, nombres]) => nombres)
        .filter((nombre) => !existentes.includes(nombre));

      if (faltantes.length > 0) {
        console.warn(`\n⚠️  ADVERTENCIA: faltan ${faltantes.length} objeto(s) programable(s):`);
        faltantes.forEach((nombre) => console.warn(`     · ${nombre}`));
        console.warn(
          '   Sin los triggers, los cupos de los talleres NO se descuentan al\n' +
          '   inscribirse y la creación de citas grupales falla.\n' +
          '   Solución:  npm run db:setup\n'
        );
      } else {
        console.log(`Objetos programables verificados (${existentes.length})`);
      }
    } catch (err) {
      console.warn('No se pudieron verificar los objetos programables:', err.message);
    } finally {
      conn.release();
    }
  })
  .catch((err) => {
    console.error('Error conectando a MySQL:', err.message);
  });

module.exports = pool;
