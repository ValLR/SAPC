// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Clases Grupales (Talleres)
//  Archivo: backend/src/controllers/clases.controller.js
//  Historia: US-11 (SCRUM-19)
// =====================================================================
//  CRUD de talleres grupales con aforo parametrizable.
//
//  Reglas de negocio clave:
//    - Al crear, `cupos_disponibles` se inicializa con `aforo_maximo`.
//    - El trigger trg_control_aforo_clases decrementa cupos al inscribirse.
//    - El DELETE es LÓGICO (estado_clase = 'CANCELADA'): un borrado físico
//      arrastraría las inscripciones por ON DELETE CASCADE.
//    - `inscripciones_activas` y `disponible` se CALCULAN (no son columnas).
// =====================================================================

const pool = require('../config/db');
const { IDS_ROL } = require('../utils/roles');
const { esFechaISO, horaAMinutos, normalizarHora } = require('../utils/tiempo');

// ---------------------------------------------------------------------
//  Constantes de dominio
// ---------------------------------------------------------------------
const ESTADOS_CLASE = ['PROGRAMADA', 'COMPLETADA', 'CANCELADA'];
const ROL_TERAPEUTA = IDS_ROL.TERAPEUTA;   // roles.id_rol = 2 (TERAPEUTA)

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------
// Las validaciones de fecha y hora viven en `src/utils/tiempo.js`, módulo
// compartido con agendas, citas y reportes (antes estaban duplicadas aquí).

/**
 * Compone el objeto unificado de clase grupal.
 * @param {object} base  Fila con datos de clases_grupales + instructor
 */
const componerClase = (base) => {
  const aforo = Number(base.aforo_maximo);
  const cupos = Number(base.cupos_disponibles);
  const inscripciones = Number(base.inscripciones_activas ?? 0);

  return {
    id_clase: base.id_clase,
    nombre_actividad: base.nombre_actividad,
    descripcion: base.descripcion,
    sala: base.sala,
    id_instructor: base.id_instructor,
    instructor: base.instructor || null,
    aforo_maximo: aforo,
    cupos_disponibles: cupos,
    inscripciones_activas: inscripciones,
    fecha_clase: base.fecha_clase,
    hora_inicio: base.hora_inicio,
    hora_fin: base.hora_fin,
    estado_clase: base.estado_clase,
    disponible: cupos > 0 && base.estado_clase === 'PROGRAMADA',
    created_at: base.created_at,
    updated_at: base.updated_at
  };
};

/** Verifica que el instructor exista y sea TERAPEUTA */
const obtenerInstructor = async (idProfesional) => {
  const [rows] = await pool.query(
    `SELECT p.id_profesional, p.activo, u.nombre, u.apellido, u.id_rol
       FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE p.id_profesional = ?`,
    [idProfesional]
  );
  return rows[0] || null;
};

/** Carga una clase por id con instructor e inscripciones activas */
const cargarClase = async (idClase) => {
  const [rows] = await pool.query(
    `SELECT c.id_clase, c.nombre_actividad, c.descripcion, c.sala,
            c.id_instructor, c.aforo_maximo, c.cupos_disponibles,
            c.fecha_clase, c.hora_inicio, c.hora_fin, c.estado_clase,
            c.created_at, c.updated_at,
            CONCAT(u.nombre, ' ', u.apellido) AS instructor,
            (SELECT COUNT(*) FROM inscripciones_clases r
              WHERE r.id_clase = c.id_clase
                AND r.estado_inscripcion = 'ACTIVA') AS inscripciones_activas
       FROM clases_grupales c
       JOIN profesionales p ON p.id_profesional = c.id_instructor
       JOIN usuarios      u ON u.id_usuario     = p.id_usuario
      WHERE c.id_clase = ?`,
    [idClase]
  );
  return rows[0] || null;
};

// ---------------------------------------------------------------------
//  ESCENARIO 1 — Alta de una nueva clase
//  POST /api/clases   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const crearClase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      nombre_actividad, descripcion, sala, id_instructor,
      aforo_maximo, fecha_clase, hora_inicio, hora_fin
    } = req.body;

    // --- Campos obligatorios ---
    const faltantes = [];
    if (!nombre_actividad) faltantes.push('nombre_actividad');
    if (id_instructor === undefined || id_instructor === null) faltantes.push('id_instructor');
    if (aforo_maximo === undefined || aforo_maximo === null) faltantes.push('aforo_maximo');
    if (!fecha_clase) faltantes.push('fecha_clase');
    if (!hora_inicio) faltantes.push('hora_inicio');
    if (!hora_fin) faltantes.push('hora_fin');

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: faltantes.map((f) => ({ field: f, issue: 'requerido' }))
      });
    }

    // --- Validación de instructor ---
    const idInstructor = Number(id_instructor);
    if (!Number.isInteger(idInstructor) || idInstructor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_instructor inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_instructor', issue: 'debe ser un entero positivo' }]
      });
    }

    // --- Validación de aforo ---
    const aforo = Number(aforo_maximo);
    if (!Number.isInteger(aforo) || aforo < 1) {
      return res.status(400).json({
        success: false,
        message: 'aforo_maximo debe ser un entero >= 1',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'aforo_maximo', issue: 'entero >= 1 requerido' }]
      });
    }

    // --- Validación de fecha ---
    if (!esFechaISO(fecha_clase)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Se espera YYYY-MM-DD',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha_clase', issue: 'formato inválido' }]
      });
    }

    // --- Validación de horas ---
    const hInicio = normalizarHora(hora_inicio);
    const hFin = normalizarHora(hora_fin);

    if (!hInicio || !hFin) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Se espera HH:MM',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_inicio/hora_fin', issue: 'formato inválido' }]
      });
    }

    if (horaAMinutos(hFin) <= horaAMinutos(hInicio)) {
      return res.status(400).json({
        success: false,
        message: 'hora_fin debe ser posterior a hora_inicio',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_fin', issue: 'no posterior a hora_inicio' }]
      });
    }

    // --- Verificar instructor ---
    const instructor = await obtenerInstructor(idInstructor);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: `No existe un profesional con id_profesional = ${idInstructor}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    if (instructor.id_rol !== ROL_TERAPEUTA) {
      return res.status(400).json({
        success: false,
        message: 'El instructor debe tener rol TERAPEUTA',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_instructor', issue: 'no es TERAPEUTA' }]
      });
    }

    if (!instructor.activo) {
      return res.status(409).json({
        success: false,
        message: 'El instructor está deshabilitado (activo = 0)',
        error: 'RESOURCE_INACTIVE'
      });
    }

    // --- Conflicto de sala (misma sala, misma fecha, rango solapado) ---
    if (sala) {
      const [colision] = await conn.query(
        `SELECT id_clase, nombre_actividad, hora_inicio, hora_fin
           FROM clases_grupales
          WHERE sala = ?
            AND fecha_clase = ?
            AND estado_clase <> 'CANCELADA'
            AND hora_inicio < ?
            AND hora_fin    > ?`,
        [sala, fecha_clase, hFin, hInicio]
      );

      if (colision.length > 0) {
        return res.status(409).json({
          success: false,
          message: `La sala "${sala}" ya está ocupada en ese horario`,
          error: 'ROOM_CONFLICT',
          details: [{
            field: 'sala',
            issue: `ocupada por "${colision[0].nombre_actividad}" (${colision[0].hora_inicio}-${colision[0].hora_fin})`
          }]
        });
      }
    }

    // --- Inserción: cupos_disponibles = aforo_maximo (regla del AC) ---
    await conn.beginTransaction();

    const [resultado] = await conn.query(
      `INSERT INTO clases_grupales
         (nombre_actividad, descripcion, sala, id_instructor,
          aforo_maximo, cupos_disponibles, fecha_clase, hora_inicio, hora_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre_actividad,
        descripcion || null,
        sala || null,
        idInstructor,
        aforo,
        aforo,          // ← cupos_disponibles = aforo_maximo
        fecha_clase,
        hInicio,
        hFin
      ]
    );

    await conn.commit();

    const creada = await cargarClase(resultado.insertId);

    return res.status(201).json({
      success: true,
      message: 'Clase grupal creada correctamente',
      data: componerClase(creada)
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error en crearClase:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 2 — Listado de actividades disponibles
//  GET /api/clases
// ---------------------------------------------------------------------
const listarClases = async (req, res) => {
  try {
    const { estado, id_instructor, sala, desde, hasta, solo_disponibles } = req.query;

    let sql = `SELECT c.id_clase, c.nombre_actividad, c.descripcion, c.sala,
                      c.id_instructor, c.aforo_maximo, c.cupos_disponibles,
                      c.fecha_clase, c.hora_inicio, c.hora_fin, c.estado_clase,
                      c.created_at, c.updated_at,
                      CONCAT(u.nombre, ' ', u.apellido) AS instructor,
                      (SELECT COUNT(*) FROM inscripciones_clases r
                        WHERE r.id_clase = c.id_clase
                          AND r.estado_inscripcion = 'ACTIVA') AS inscripciones_activas
                 FROM clases_grupales c
                 JOIN profesionales p ON p.id_profesional = c.id_instructor
                 JOIN usuarios      u ON u.id_usuario     = p.id_usuario`;
    const params = [];
    const condiciones = [];

    if (estado !== undefined) {
      if (!ESTADOS_CLASE.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: `estado inválido. Valores: ${ESTADOS_CLASE.join(', ')}`,
          error: 'VALIDATION_ERROR',
          details: [{ field: 'estado', issue: 'valor no permitido' }]
        });
      }
      condiciones.push('c.estado_clase = ?');
      params.push(estado);
    }

    if (id_instructor !== undefined) {
      condiciones.push('c.id_instructor = ?');
      params.push(Number(id_instructor));
    }

    if (sala !== undefined) {
      condiciones.push('c.sala = ?');
      params.push(sala);
    }

    if (desde !== undefined) {
      if (!esFechaISO(desde)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido en "desde". Se espera YYYY-MM-DD',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'desde', issue: 'formato inválido' }]
        });
      }
      condiciones.push('c.fecha_clase >= ?');
      params.push(desde);
    }

    if (hasta !== undefined) {
      if (!esFechaISO(hasta)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido en "hasta". Se espera YYYY-MM-DD',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'hasta', issue: 'formato inválido' }]
        });
      }
      condiciones.push('c.fecha_clase <= ?');
      params.push(hasta);
    }

    if (solo_disponibles === 'true' || solo_disponibles === '1') {
      condiciones.push("c.cupos_disponibles > 0 AND c.estado_clase = 'PROGRAMADA'");
    }

    if (condiciones.length > 0) sql += ' WHERE ' + condiciones.join(' AND ');
    sql += ' ORDER BY c.fecha_clase, c.hora_inicio';

    const [rows] = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(componerClase)
    });

  } catch (error) {
    console.error('Error en listarClases:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 3 — Detalle de una clase
//  GET /api/clases/:id_clase
// ---------------------------------------------------------------------
const obtenerClase = async (req, res) => {
  try {
    const idClase = Number(req.params.id_clase);

    if (!Number.isInteger(idClase) || idClase <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_clase inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_clase', issue: 'debe ser un entero positivo' }]
      });
    }

    const clase = await cargarClase(idClase);
    if (!clase) {
      return res.status(404).json({
        success: false,
        message: `No existe una clase con id_clase = ${idClase}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: componerClase(clase)
    });

  } catch (error) {
    console.error('Error en obtenerClase:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 4 — Actualización de una clase
//  PUT /api/clases/:id_clase   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const actualizarClase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idClase = Number(req.params.id_clase);

    if (!Number.isInteger(idClase) || idClase <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_clase inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_clase', issue: 'debe ser un entero positivo' }]
      });
    }

    // --- Existencia ---
    const [existe] = await conn.query(
      `SELECT id_clase, aforo_maximo, cupos_disponibles, fecha_clase,
              hora_inicio, hora_fin, sala, estado_clase
         FROM clases_grupales
        WHERE id_clase = ?`,
      [idClase]
    );

    if (existe.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No existe una clase con id_clase = ${idClase}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    const actual = existe[0];

    const {
      nombre_actividad, descripcion, sala, id_instructor,
      aforo_maximo, fecha_clase, hora_inicio, hora_fin, estado_clase
    } = req.body;

    // --- Validación de estado ---
    if (estado_clase !== undefined && !ESTADOS_CLASE.includes(estado_clase)) {
      return res.status(400).json({
        success: false,
        message: `estado_clase inválido. Valores: ${ESTADOS_CLASE.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: [{ field: 'estado_clase', issue: 'valor no permitido' }]
      });
    }

    // --- Validación de instructor (si se envía) ---
    if (id_instructor !== undefined) {
      const idInstructor = Number(id_instructor);
      if (!Number.isInteger(idInstructor) || idInstructor <= 0) {
        return res.status(400).json({
          success: false,
          message: 'id_instructor inválido',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'id_instructor', issue: 'debe ser un entero positivo' }]
        });
      }
      const instructor = await obtenerInstructor(idInstructor);
      if (!instructor) {
        return res.status(404).json({
          success: false,
          message: `No existe un profesional con id_profesional = ${idInstructor}`,
          error: 'RESOURCE_NOT_FOUND'
        });
      }
      if (instructor.id_rol !== ROL_TERAPEUTA) {
        return res.status(400).json({
          success: false,
          message: 'El instructor debe tener rol TERAPEUTA',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'id_instructor', issue: 'no es TERAPEUTA' }]
        });
      }
    }

    // --- Validación de aforo (si se envía) ---
    let nuevoAforo = null;
    if (aforo_maximo !== undefined) {
      nuevoAforo = Number(aforo_maximo);
      if (!Number.isInteger(nuevoAforo) || nuevoAforo < 1) {
        return res.status(400).json({
          success: false,
          message: 'aforo_maximo debe ser un entero >= 1',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'aforo_maximo', issue: 'entero >= 1 requerido' }]
        });
      }

      // No se puede reducir el aforo por debajo de las reservas ya hechas
      const reservasActivas = Number(actual.aforo_maximo) - Number(actual.cupos_disponibles);
      if (nuevoAforo < reservasActivas) {
        return res.status(409).json({
          success: false,
          message: `No se puede reducir el aforo a ${nuevoAforo}: hay ${reservasActivas} reservas activas`,
          error: 'CONFLICT',
          details: [{ field: 'aforo_maximo', issue: `menor que las reservas activas (${reservasActivas})` }]
        });
      }
    }

    // --- Validación de fecha (si se envía) ---
    if (fecha_clase !== undefined && !esFechaISO(fecha_clase)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Se espera YYYY-MM-DD',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'fecha_clase', issue: 'formato inválido' }]
      });
    }

    // --- Validación de horas (si se envían) ---
    const hInicio = hora_inicio !== undefined ? normalizarHora(hora_inicio) : actual.hora_inicio;
    const hFin = hora_fin !== undefined ? normalizarHora(hora_fin) : actual.hora_fin;

    if (!hInicio || !hFin) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Se espera HH:MM',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_inicio/hora_fin', issue: 'formato inválido' }]
      });
    }

    if (horaAMinutos(hFin) <= horaAMinutos(hInicio)) {
      return res.status(400).json({
        success: false,
        message: 'hora_fin debe ser posterior a hora_inicio',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_fin', issue: 'no posterior a hora_inicio' }]
      });
    }

    // --- Conflicto de sala (si cambia sala/fecha/horas) ---
    const nuevaSala = sala !== undefined ? (sala || null) : actual.sala;
    const nuevaFecha = fecha_clase !== undefined ? fecha_clase : actual.fecha_clase;

    if (nuevaSala) {
      const [colision] = await conn.query(
        `SELECT id_clase, nombre_actividad, hora_inicio, hora_fin
           FROM clases_grupales
          WHERE sala = ?
            AND fecha_clase = ?
            AND estado_clase <> 'CANCELADA'
            AND id_clase <> ?
            AND hora_inicio < ?
            AND hora_fin    > ?`,
        [nuevaSala, nuevaFecha, idClase, hFin, hInicio]
      );

      if (colision.length > 0) {
        return res.status(409).json({
          success: false,
          message: `La sala "${nuevaSala}" ya está ocupada en ese horario`,
          error: 'ROOM_CONFLICT',
          details: [{
            field: 'sala',
            issue: `ocupada por "${colision[0].nombre_actividad}" (${colision[0].hora_inicio}-${colision[0].hora_fin})`
          }]
        });
      }
    }

    // --- Construcción del UPDATE dinámico ---
    const campos = [];
    const valores = [];

    if (nombre_actividad !== undefined) { campos.push('nombre_actividad = ?'); valores.push(nombre_actividad); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion); }
    if (sala !== undefined) { campos.push('sala = ?'); valores.push(sala || null); }
    if (id_instructor !== undefined) { campos.push('id_instructor = ?'); valores.push(Number(id_instructor)); }
    if (fecha_clase !== undefined) { campos.push('fecha_clase = ?'); valores.push(fecha_clase); }
    if (hora_inicio !== undefined) { campos.push('hora_inicio = ?'); valores.push(hInicio); }
    if (hora_fin !== undefined) { campos.push('hora_fin = ?'); valores.push(hFin); }
    if (estado_clase !== undefined) { campos.push('estado_clase = ?'); valores.push(estado_clase); }

    // Al cambiar el aforo, recalcular cupos_disponibles preservando las reservas
    if (nuevoAforo !== null) {
      const reservasActivas = Number(actual.aforo_maximo) - Number(actual.cupos_disponibles);
      campos.push('aforo_maximo = ?');
      valores.push(nuevoAforo);
      campos.push('cupos_disponibles = ?');
      valores.push(nuevoAforo - reservasActivas);
    }

    if (campos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se envió ningún campo para actualizar',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'body', issue: 'vacío' }]
      });
    }

    await conn.beginTransaction();

    valores.push(idClase);
    await conn.query(
      `UPDATE clases_grupales SET ${campos.join(', ')} WHERE id_clase = ?`,
      valores
    );

    await conn.commit();

    const actualizada = await cargarClase(idClase);

    return res.status(200).json({
      success: true,
      message: 'Clase grupal actualizada correctamente',
      data: componerClase(actualizada)
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error en actualizarClase:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 5 — Baja lógica de una clase
//  DELETE /api/clases/:id_clase   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const eliminarClase = async (req, res) => {
  try {
    const idClase = Number(req.params.id_clase);

    if (!Number.isInteger(idClase) || idClase <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_clase inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_clase', issue: 'debe ser un entero positivo' }]
      });
    }

    const clase = await cargarClase(idClase);
    if (!clase) {
      return res.status(404).json({
        success: false,
        message: `No existe una clase con id_clase = ${idClase}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    if (clase.estado_clase === 'CANCELADA') {
      return res.status(409).json({
        success: false,
        message: 'La clase ya está cancelada',
        error: 'CONFLICT'
      });
    }

    // Baja LÓGICA: un DELETE físico arrastraría las reservas (ON DELETE CASCADE)
    await pool.query(
      `UPDATE clases_grupales SET estado_clase = 'CANCELADA' WHERE id_clase = ?`,
      [idClase]
    );

    const cancelada = await cargarClase(idClase);

    return res.status(200).json({
      success: true,
      message: 'Clase grupal cancelada correctamente',
      data: componerClase(cancelada)
    });

  } catch (error) {
    console.error('Error en eliminarClase:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  crearClase,
  listarClases,
  obtenerClase,
  actualizarClase,
  eliminarClase
};
