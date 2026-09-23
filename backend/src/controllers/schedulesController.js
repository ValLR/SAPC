const pool = require('../config/db');

/**
 * GET /api/schedules
 * Retrieves weekly working schedule blocks for a therapist.
 */
const getSchedules = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const userRole = req.user?.rol;
    let therapistId = req.query.therapistId ? Number(req.query.therapistId) : null;

    if (userRole === 'TERAPEUTA' || !therapistId) {
      const [profRows] = await pool.query(
        `SELECT id_profesional FROM profesionales WHERE id_usuario = ? LIMIT 1`,
        [userId]
      );
      if (profRows.length > 0) {
        therapistId = profRows[0].id_profesional;
      } else {
        therapistId = 1;
      }
    }

    const [blocks] = await pool.query(
      `SELECT b.id_bloque AS id_block,
              b.id_profesional AS id_therapist,
              b.dia_semana AS day_of_week,
              TIME_FORMAT(b.hora_inicio, '%H:%i') AS start_time,
              TIME_FORMAT(b.hora_fin, '%H:%i') AS end_time,
              b.aforo_maximo AS max_capacity,
              b.activo AS active
         FROM bloques_horarios b
        WHERE b.id_profesional = ? AND b.activo = 1
        ORDER BY b.dia_semana ASC, b.hora_inicio ASC`,
      [therapistId]
    );

    const [therapists] = await pool.query(
      `SELECT p.id_profesional AS id,
              CONCAT(CASE WHEN u.nombre LIKE 'Camila%' THEN 'Dra. ' ELSE 'Lic. ' END, u.nombre, ' ', u.apellido) AS name,
              COALESCE(p.titulo_profesional, e.nombre, 'Especialista') AS specialty
         FROM profesionales p
         JOIN usuarios u ON u.id_usuario = p.id_usuario
    LEFT JOIN especialidades e ON e.id_especialidad = p.id_especialidad_principal
        WHERE p.activo = 1`
    );

    return res.status(200).json({
      success: true,
      therapistId,
      therapists,
      data: blocks,
    });
  } catch (error) {
    console.error('Error in getSchedules:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching schedules',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
};

/**
 * POST /api/schedules/publish
 * Generates and publishes working hours schedule blocks for selected days.
 */
const publishSchedule = async (req, res) => {
  try {
    const { therapist_id, days, start_time, end_time, slot_duration } = req.body;
    const userId = req.user?.user_id;
    const userRole = req.user?.rol;

    let targetTherapistId = Number(therapist_id);

    if (userRole === 'TERAPEUTA' || !targetTherapistId) {
      const [profRows] = await pool.query(
        `SELECT id_profesional FROM profesionales WHERE id_usuario = ? LIMIT 1`,
        [userId]
      );
      if (profRows.length > 0) {
        targetTherapistId = profRows[0].id_profesional;
      } else {
        targetTherapistId = 1;
      }
    }

    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Las horas de inicio y término son requeridas',
        error: 'MISSING_TIME_FIELDS',
      });
    }

    const startMinutes = parseTimeToMinutes(start_time);
    const endMinutes = parseTimeToMinutes(end_time);

    if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
      return res.status(400).json({
        success: false,
        message: 'La hora de término debe ser estrictamente posterior a la hora de inicio',
        error: 'INVALID_TIME_RANGE',
      });
    }

    const duration = Number(slot_duration) || 45;
    const selectedDays = Array.isArray(days) && days.length > 0 ? days : [1, 2, 3, 4, 5];

    // Se usa DESACTIVACIÓN en lugar de DELETE: la FK fk_citas_bloque es
    // ON DELETE SET NULL, por lo que borrar un bloque dejaría huérfanas a las
    // citas ya agendadas. Desactivar (activo = 0) lo oculta de la grilla
    // (getSchedules filtra activo = 1) sin perder la trazabilidad.
    const generatedBlocks = [];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE bloques_horarios SET activo = 0
          WHERE id_profesional = ? AND dia_semana IN (?)`,
        [targetTherapistId, selectedDays]
      );

      for (const day of selectedDays) {
        let currentMinutes = startMinutes;
        while (currentMinutes + duration <= endMinutes) {
          const slotStart = formatMinutesToTime(currentMinutes);
          const slotEnd = formatMinutesToTime(currentMinutes + duration);

          // UPSERT sobre la clave única (id_profesional, dia_semana, hora_inicio):
          // si el slot ya existía (incluso desactivado), se reactiva y actualiza.
          await conn.query(
            `INSERT INTO bloques_horarios
               (id_profesional, dia_semana, hora_inicio, hora_fin, aforo_maximo, activo)
             VALUES (?, ?, ?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE
               hora_fin      = VALUES(hora_fin),
               aforo_maximo  = VALUES(aforo_maximo),
               activo        = 1`,
            [targetTherapistId, day, slotStart, slotEnd]
          );

          generatedBlocks.push({
            id_therapist: targetTherapistId,
            day_of_week: day,
            start_time: slotStart,
            end_time: slotEnd,
            max_capacity: 1,
          });

          currentMinutes += duration;
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return res.status(201).json({
      success: true,
      message: 'Jornada y disponibilidad horaria publicadas con éxito',
      count: generatedBlocks.length,
      data: generatedBlocks,
    });
  } catch (error) {
    console.error('Error in publishSchedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while publishing schedules',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
};

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return NaN;
  const parts = timeStr.split(':');
  if (parts.length < 2) return NaN;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hStr}:${mStr}`;
}

module.exports = {
  getSchedules,
  publishSchedule,
};
