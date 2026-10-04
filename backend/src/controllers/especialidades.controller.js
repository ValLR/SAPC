// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Especialidades (catálogo)
//  Archivo: backend/src/controllers/especialidades.controller.js
// =====================================================================
//  Catálogo maestro de especialidades. Consumido por el formulario de
//  terapeutas (US-13) para poblar el selector de especialidades.
// =====================================================================

const pool = require('../config/db');

/**
 * GET /api/especialidades
 * Lista el catálogo de especialidades activas.
 * Query params opcionales:
 *   - activo (boolean): filtra por estado activo
 */
const listarEspecialidades = async (req, res) => {
  try {
    const { activo } = req.query;

    let sql = `SELECT id_especialidad, nombre, descripcion, activo
                 FROM especialidades`;
    const params = [];

    if (activo !== undefined) {
      sql += ' WHERE activo = ?';
      params.push(activo === 'true' || activo === '1' ? 1 : 0);
    }

    sql += ' ORDER BY nombre';

    const [rows] = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((e) => ({
        id_especialidad: e.id_especialidad,
        nombre: e.nombre,
        descripcion: e.descripcion,
        activo: Boolean(e.activo)
      }))
    });

  } catch (error) {
    console.error('Error en listarEspecialidades:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  listarEspecialidades
};
