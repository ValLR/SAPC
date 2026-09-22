// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Agendas / Bloques Horarios
//  Archivo: backend/src/controllers/agendas.controller.js
//  Historia: US-07 (SCRUM-6)
// =====================================================================
//  Escenario 1 — Consulta de disponibilidad de un terapeuta en una fecha.
//  Escenario 2 — Generación masiva de bloques (plantilla semanal).
//
//  Modelo: `bloques_horarios` es una PLANTILLA SEMANAL (dia_semana 1..7),
//  no una agenda por fecha. Por eso:
//    - La consulta recibe una fecha y resuelve qué bloques aplican ese día.
//    - La generación recibe un rango de fechas y crea un bloque por cada
//      slot (duracion_minutos) de cada día de la semana cubierto.
//
//  `disponible` NO es una columna: se CALCULA cruzando con `citas`.
// =====================================================================

const pool = require('../config/db');

// ---------------------------------------------------------------------
//  Constantes de dominio
// ---------------------------------------------------------------------
const DIAS_SEMANA = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo'
};

const ESTADOS_QUE_OCUPAN = ['CANCELADA', 'NO_ASISTIO'];

// ---------------------------------------------------------------------
//  Helpers de tiempo y fecha
// ---------------------------------------------------------------------

/** "09:30" o "09:30:00" -> minutos desde medianoche */
const horaAMinutos = (hora) => {
  const partes = String(hora).split(':');
  const hh = Number(partes[0]);
  const mm = Number(partes[1]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
  return hh * 60 + mm;
};

/** minutos desde medianoche -> "HH:MM:SS" */
const minutosAHora = (minutos) => {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

/** Valida formato YYYY-MM-DD y que sea una fecha real */
const esFechaISO = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
};

/** Fecha ISO -> día de la semana ISO-8601 (1=Lunes ... 7=Domingo) */
const diaSemanaISO = (fechaISO) => {
  const dow = new Date(`${fechaISO}T00:00:00Z`).getUTCDay(); // 0=Domingo
  return dow === 0 ? 7 : dow;
};

/** Lista todas las fechas (YYYY-MM-DD) entre dos fechas inclusive */
const iterarFechas = (inicioISO, finISO) => {
  const fechas = [];
  const cursor = new Date(`${inicioISO}T00:00:00Z`);
  const fin = new Date(`${finISO}T00:00:00Z`);
  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
};

/** Verifica que el profesional exista y esté activo */
const obtenerProfesional = async (idProfesional) => {
  const [rows] = await pool.query(
    `SELECT p.id_profesional, p.id_usuario, p.activo,
            u.nombre, u.apellido
       FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE p.id_profesional = ?`,
    [idProfesional]
  );
  return rows[0] || null;
};

// ---------------------------------------------------------------------
//  ESCENARIO 1 — Consulta de disponibilidad
//  GET /api/agendas/:terapeutaId?fecha=YYYY-MM-DD
// ---------------------------------------------------------------------
const consultarDisponibilidad = async (req, res) => {
  try {
    const idProfesional = Number(req.params.terapeutaId);
    const { fecha } = req.query;

    // --- Validación de parámetros ---
    if (!Number.isInteger(idProfesional) || idProfesional <= 0) {
      return res.status(400).json({
        success: false,
        message: 'terapeutaId inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'terapeutaId', issue: 'debe ser un entero positivo' }]
      });
    }

    if (!fecha) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro fecha es obligatorio (YYYY-MM-DD)',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha', issue: 'requerido' }]
      });
    }

    if (!esFechaISO(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Se espera YYYY-MM-DD',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha', issue: 'formato inválido' }]
      });
    }

    // --- Verificar existencia del profesional ---
    const profesional = await obtenerProfesional(idProfesional);
    if (!profesional) {
      return res.status(404).json({
        success: false,
        message: `No existe un terapeuta con id_profesional = ${idProfesional}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    const dia = diaSemanaISO(fecha);

    // --- Bloques del día + ocupación real (cruce con citas vigentes) ---
    const [bloques] = await pool.query(
      `SELECT b.id_bloque, b.dia_semana, b.hora_inicio, b.hora_fin,
              b.aforo_maximo, b.activo,
              COALESCE(SUM(
                CASE WHEN c.id_cita IS NOT NULL THEN 1 ELSE 0 END
              ), 0) AS ocupados
         FROM bloques_horarios b
         LEFT JOIN citas c
                ON c.id_profesional = b.id_profesional
               AND c.fecha_cita     = ?
               AND c.estado NOT IN (?, ?)
               AND c.hora_inicio <  b.hora_fin
               AND c.hora_fin    >  b.hora_inicio
        WHERE b.id_profesional = ?
          AND b.dia_semana     = ?
          AND b.activo         = 1
        GROUP BY b.id_bloque, b.dia_semana, b.hora_inicio, b.hora_fin,
                 b.aforo_maximo, b.activo
        ORDER BY b.hora_inicio`,
      [fecha, ESTADOS_QUE_OCUPAN[0], ESTADOS_QUE_OCUPAN[1], idProfesional, dia]
    );

    const data = bloques.map((b) => {
      const ocupados = Number(b.ocupados);
      const aforo = Number(b.aforo_maximo);
      return {
        id_bloque: b.id_bloque,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
        aforo_maximo: aforo,
        ocupados,
        cupos_libres: Math.max(aforo - ocupados, 0),
        disponible: ocupados < aforo ? 1 : 0
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data: {
        id_profesional: profesional.id_profesional,
        terapeuta: `${profesional.nombre} ${profesional.apellido}`,
        fecha,
        dia_semana: dia,
        dia_nombre: DIAS_SEMANA[dia],
        bloques: data
      }
    });

  } catch (error) {
    console.error('Error en consultarDisponibilidad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 2 — Generación masiva de bloques
//  POST /api/agendas   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const generarBloques = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      id_profesional,
      fecha_inicio,
      fecha_fin,
      hora_inicio,
      hora_fin,
      duracion_minutos,
      aforo_maximo
    } = req.body;

    // --- Campos obligatorios ---
    const faltantes = [];
    if (id_profesional === undefined || id_profesional === null) faltantes.push('id_profesional');
    if (!fecha_inicio) faltantes.push('fecha_inicio');
    if (!fecha_fin) faltantes.push('fecha_fin');
    if (!hora_inicio) faltantes.push('hora_inicio');
    if (!hora_fin) faltantes.push('hora_fin');
    if (duracion_minutos === undefined || duracion_minutos === null) faltantes.push('duracion_minutos');

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: faltantes.map((f) => ({ field: f, issue: 'requerido' }))
      });
    }

    // --- Validación de id_profesional ---
    const idProf = Number(id_profesional);
    if (!Number.isInteger(idProf) || idProf <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_profesional inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_profesional', issue: 'debe ser un entero positivo' }]
      });
    }

    // --- Validación de fechas ---
    if (!esFechaISO(fecha_inicio) || !esFechaISO(fecha_fin)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Se espera YYYY-MM-DD',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha_inicio/fecha_fin', issue: 'formato inválido' }]
      });
    }

    if (fecha_fin < fecha_inicio) {
      return res.status(400).json({
        success: false,
        message: 'fecha_fin no puede ser anterior a fecha_inicio',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha_fin', issue: 'anterior a fecha_inicio' }]
      });
    }

    // --- Validación de horas ---
    const minInicio = horaAMinutos(hora_inicio);
    const minFin = horaAMinutos(hora_fin);

    if (Number.isNaN(minInicio) || Number.isNaN(minFin)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Se espera HH:MM',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_inicio/hora_fin', issue: 'formato inválido' }]
      });
    }

    if (minFin <= minInicio) {
      return res.status(400).json({
        success: false,
        message: 'hora_fin debe ser posterior a hora_inicio',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_fin', issue: 'no posterior a hora_inicio' }]
      });
    }

    // --- Validación de duración ---
    const duracion = Number(duracion_minutos);
    if (!Number.isInteger(duracion) || duracion <= 0) {
      return res.status(400).json({
        success: false,
        message: 'duracion_minutos debe ser un entero positivo',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'duracion_minutos', issue: 'entero positivo requerido' }]
      });
    }

    const ventana = minFin - minInicio;
    if (duracion > ventana) {
      return res.status(400).json({
        success: false,
        message: 'duracion_minutos supera la ventana horaria disponible',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'duracion_minutos', issue: 'mayor que la ventana' }]
      });
    }

    // --- Validación de aforo ---
    const aforo = aforo_maximo === undefined || aforo_maximo === null
      ? 1
      : Number(aforo_maximo);

    if (!Number.isInteger(aforo) || aforo < 1) {
      return res.status(400).json({
        success: false,
        message: 'aforo_maximo debe ser un entero >= 1',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'aforo_maximo', issue: 'entero >= 1 requerido' }]
      });
    }

    // --- Verificar profesional ---
    const profesional = await obtenerProfesional(idProf);
    if (!profesional) {
      return res.status(404).json({
        success: false,
        message: `No existe un terapeuta con id_profesional = ${idProf}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    if (!profesional.activo) {
      return res.status(409).json({
        success: false,
        message: 'El terapeuta está deshabilitado (activo = 0)',
        error: 'RESOURCE_INACTIVE'
      });
    }

    // --- Días de la semana cubiertos por el rango ---
    const fechas = iterarFechas(fecha_inicio, fecha_fin);
    const diasCubiertos = [...new Set(fechas.map(diaSemanaISO))].sort((a, b) => a - b);

    // --- Generar slots (un bloque por slot, por cada día de la semana) ---
    const candidatos = [];
    for (const dia of diasCubiertos) {
      for (let m = minInicio; m + duracion <= minFin; m += duracion) {
        candidatos.push({
          id_profesional: idProf,
          dia_semana: dia,
          hora_inicio: minutosAHora(m),
          hora_fin: minutosAHora(m + duracion),
          aforo_maximo: aforo
        });
      }
    }

    const minutosSobrantes = ventana % duracion;

    if (candidatos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La configuración no genera ningún bloque',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'duracion_minutos', issue: 'no cabe ningún slot en la ventana' }]
      });
    }

    // --- Detectar duplicados existentes (UNIQUE id_profesional+dia+hora) ---
    const dias = [...new Set(candidatos.map((c) => c.dia_semana))];
    const placeholdersDias = dias.map(() => '?').join(', ');
    const [existentes] = await conn.query(
      `SELECT dia_semana, hora_inicio
         FROM bloques_horarios
        WHERE id_profesional = ?
          AND dia_semana IN (${placeholdersDias})`,
      [idProf, ...dias]
    );

    const claveExistente = new Set(
      existentes.map((e) => `${e.dia_semana}|${e.hora_inicio}`)
    );

    const nuevos = candidatos.filter(
      (c) => !claveExistente.has(`${c.dia_semana}|${c.hora_inicio}`)
    );
    const omitidos = candidatos.length - nuevos.length;

    // --- Inserción transaccional ---
    let insertados = 0;
    if (nuevos.length > 0) {
      await conn.beginTransaction();

      const valores = nuevos.map((c) => [
        c.id_profesional, c.dia_semana, c.hora_inicio, c.hora_fin, c.aforo_maximo
      ]);

      const [resultado] = await conn.query(
        `INSERT INTO bloques_horarios
           (id_profesional, dia_semana, hora_inicio, hora_fin, aforo_maximo)
         VALUES ?`,
        [valores]
      );

      insertados = resultado.affectedRows;
      await conn.commit();
    }

    // --- Respuesta ---
    const [creados] = await pool.query(
      `SELECT id_bloque, dia_semana, hora_inicio, hora_fin, aforo_maximo, activo
         FROM bloques_horarios
        WHERE id_profesional = ?
          AND dia_semana IN (${placeholdersDias})
        ORDER BY dia_semana, hora_inicio`,
      [idProf, ...dias]
    );

    return res.status(201).json({
      success: true,
      message: `Se generaron ${insertados} bloques horarios`,
      data: {
        id_profesional: idProf,
        terapeuta: `${profesional.nombre} ${profesional.apellido}`,
        rango: { fecha_inicio, fecha_fin },
        dias_cubiertos: diasCubiertos.map((d) => ({
          dia_semana: d,
          dia_nombre: DIAS_SEMANA[d]
        })),
        duracion_minutos: duracion,
        minutos_sobrantes: minutosSobrantes,
        bloques_creados: insertados,
        bloques_omitidos: omitidos,
        bloques: creados.map((b) => ({
          id_bloque: b.id_bloque,
          dia_semana: b.dia_semana,
          dia_nombre: DIAS_SEMANA[b.dia_semana],
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
          aforo_maximo: Number(b.aforo_maximo),
          activo: Boolean(b.activo)
        }))
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error en generarBloques:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    conn.release();
  }
};

module.exports = {
  consultarDisponibilidad,
  generarBloques
};
