// =====================================================================
//  S.A.P.C. — CHAWAL  |  Group Classes & Capacity Controller
//  File: backend/src/controllers/classesController.js
// =====================================================================

const pool = require('../config/db');

/**
 * GET /api/classes
 * Retrieves group classes catalog with real-time capacity count.
 */
const getClasses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id_clase AS id_class,
              c.nombre_actividad AS title,
              c.descripcion AS description,
              CONCAT(u.nombre, ' ', u.apellido) AS instructor,
              c.aforo_maximo AS max_capacity,
              c.cupos_disponibles AS available_slots,
              DATE_FORMAT(c.fecha_clase, '%Y-%m-%d') AS class_date,
              c.hora_inicio AS start_time,
              c.hora_fin AS end_time,
              c.estado_clase AS status,
              COALESCE(c.sala, 'Sin sala asignada') AS location
         FROM clases_grupales c
         JOIN profesionales p ON p.id_profesional = c.id_instructor
         JOIN usuarios u ON u.id_usuario = p.id_usuario
        ORDER BY c.fecha_clase ASC, c.hora_inicio ASC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error in getClasses:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching classes',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
};

/**
 * POST /api/classes/:id_class/reserve
 * Processes student reservation for a group class.
 * MySQL trigger trg_control_aforo_clases automatically decrements available_slots.
 */
const reserveClass = async (req, res) => {
  try {
    const idClass = Number(req.params.id_class);
    const userId = req.user?.user_id; // id_usuario from JWT middleware

    if (!idClass || isNaN(idClass)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID',
        error: 'INVALID_ID',
      });
    }

    // Get id_paciente associated with user ID
    const [patientRows] = await pool.query(
      `SELECT id_paciente FROM pacientes WHERE id_usuario = ? LIMIT 1`,
      [userId]
    );

    let idPatient = patientRows[0]?.id_paciente;

    if (!idPatient) {
      const [fallbackPatients] = await pool.query(`SELECT id_paciente FROM pacientes LIMIT 1`);
      idPatient = fallbackPatients[0]?.id_paciente || 1;
    }

    // Check availability
    const [classRows] = await pool.query(
      `SELECT id_clase, nombre_actividad, cupos_disponibles FROM clases_grupales WHERE id_clase = ?`,
      [idClass]
    );

    if (classRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
        error: 'NOT_FOUND',
      });
    }

    const currentClass = classRows[0];

    if (currentClass.cupos_disponibles <= 0) {
      return res.status(409).json({
        success: false,
        message: 'La clase ya no cuenta con aforo disponible (Aforo Completo)',
        error: 'CLASS_FULL',
      });
    }

    // Insert reservation
    await pool.query(
      `INSERT INTO reservas_clases (id_paciente, id_clase, estado_reserva) VALUES (?, ?, 'ACTIVA')`,
      [idPatient, idClass]
    );

    // Get updated class info
    const [updatedClass] = await pool.query(
      `SELECT c.id_clase AS id_class, c.nombre_actividad AS title, c.cupos_disponibles AS available_slots
         FROM clases_grupales c WHERE c.id_clase = ?`,
      [idClass]
    );

    return res.status(200).json({
      success: true,
      message: 'Inscripción realizada con éxito',
      data: updatedClass[0],
    });
  } catch (error) {
    console.error('Error in reserveClass:', error);

    // El trigger trg_control_aforo_clases aborta con SIGNAL SQLSTATE '45000'
    // cuando la clase alcanza su aforo máximo.
    if (error.sqlState === '45000') {
      return res.status(409).json({
        success: false,
        message: 'La clase alcanzó su límite de capacidad (Aforo Completo)',
        error: 'CLASS_FULL',
      });
    }

    // UNIQUE uq_paciente_clase: el paciente ya está inscrito en esta clase.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya tienes una inscripción activa en esta clase',
        error: 'ALREADY_RESERVED',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while reserving class',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
};

module.exports = {
  getClasses,
  reserveClass,
};
