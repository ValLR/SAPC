// =====================================================================
//  S.A.P.C. — CHAWAL  |  Pool de conexiones MySQL
//  Archivo: backend/src/config/db.js
// =====================================================================
//  Usa mysql2/promise para consultas con async/await.
//  Las credenciales se leen de variables de entorno (.env).
// =====================================================================

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4_unicode_ci'
});

// Verificación de conexión al arrancar (no bloquea el inicio del servidor)
pool.getConnection()
  .then((conn) => {
    console.log(`Conexión a MySQL establecida (BD: ${process.env.DB_NAME})`);
    conn.release();
  })
  .catch((err) => {
    console.error('Error conectando a MySQL:', err.message);
  });

module.exports = pool;
