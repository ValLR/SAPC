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
 * Enrolls the authenticated patient in a group class (solo rol PACIENTE).
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

    const idPatient = patientRows[0]?.id_paciente;

    // [R1] Una inscripción pertenece SIEMPRE a un paciente (entidad de
    // dominio), nunca a un usuario cualquiera. Antes había un fallback que
    // atribuía la inscripción al "paciente 1" cuando quien llamaba no era
    // paciente (p. ej. un ADMINISTRADOR): eso creaba una inscripción falsa
    // en silencio. Ahora se rechaza de forma explícita.
    if (!idPatient) {
      return res.status(403).json({
        success: false,
        message: 'Solo los pacientes pueden inscribirse en una clase grupal',
        error: 'NOT_A_PATIENT',
      });
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
      // US-09: el AC exige 400 Bad Request al rechazar por aforo agotado.
      // Nota: 409 Conflict sería semánticamente equivalente (el conflicto
      // es con el estado del recurso, no con la petición), pero el
      // criterio de aceptación especifica 400 de forma explícita.
      return res.status(400).json({
        success: false,
        message: 'La clase ya no cuenta con aforo disponible (Aforo Completo)',
        error: 'CLASS_FULL',
      });
    }

    // Insert enrollment
    await pool.query(
      `INSERT INTO inscripciones_clases (id_paciente, id_clase, estado_inscripcion) VALUES (?, ?, 'ACTIVA')`,
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
    // El trigger trg_control_aforo_clases aborta con SIGNAL SQLSTATE '45000'
    // cuando la clase alcanza su aforo máximo.
    // Se responde 400 por el AC de US-09 (ver nota en la validación previa).
    if (error.sqlState === '45000') {
      return res.status(400).json({
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

    // Solo se registra lo que es un fallo real: los rechazos de negocio de
    // arriba (aforo completo / duplicado) son resultados esperados y no
    // deben ensuciar los logs con stack traces.
    console.error('Error in reserveClass:', error);

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
