// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Citas (reserva transaccional)
//  Archivo: backend/src/controllers/citas.controller.js
//  Historia: US-05 (SCRUM-13)
// =====================================================================
//  La reserva se delega ÍNTEGRAMENTE al stored procedure
//  `sp_agendar_cita`, que es quien posee la transacción y el bloqueo
//  pesimista sobre el bloque horario:
//
//    START TRANSACTION
//      SELECT ... FROM servicios      FOR UPDATE   (servicio activo)
//      SELECT ... FROM profesionales  FOR UPDATE   (profesional activo)
//      SELECT ... FROM bloques_horarios FOR UPDATE (bloque + aforo)
//      ... validaciones de rango, día ISO y duración ...
//      SELECT COUNT(*) FROM citas                  (aforo del slot)
//      INSERT INTO citas
//    COMMIT
//
//  ⚠️ El endpoint NO abre una transacción propia, a propósito: si lo
//  hiciera, el START TRANSACTION del SP provocaría un COMMIT IMPLÍCITO de
//  la transacción de Node y el ROLLBACK del EXIT HANDLER dejaría de
//  revertir nada → se rompería el Escenario 2 del AC. La transacción la
//  posee el SP; el controlador solo lo invoca y traduce el resultado.
//
//  ⚠️ Tampoco hay pre-check de disponibilidad (a diferencia de
//  /api/classes): el SP es la única fuente de verdad y ya devuelve
//  mensajes específicos. Un pre-check añadiría una carrera TOCTOU y
//  duplicaría las reglas que el SP y los triggers ya garantizan.
//
//  `DELETE /api/citas/:id_cita` cierra el ciclo: la baja es LÓGICA
//  (estado = CANCELADA) y libera el slot sin escribir nada extra, porque
//  `citas.slot_activo` es una columna generada que se anula al cancelar.
// =====================================================================

const pool = require('../config/db');
const { esFechaISO, normalizarHora } = require('../utils/tiempo');
const { ROLES } = require('../utils/roles');

// ---------------------------------------------------------------------
//  Normalización de errores de negocio
// ---------------------------------------------------------------------
//  El rechazo puede originarse en TRES lugares distintos, con textos
//  distintos (y el SP los escribe sin tildes):
//
//    1. El SP                     -> SIGNAL SQLSTATE '45000'
//    2. El trigger trg_citas_bi_validacion -> SIGNAL SQLSTATE '45000'
//    3. El índice uq_citas_slot   -> ER_DUP_ENTRY (SQLSTATE 23000)
//
//  Aquí se traducen a un contrato único para el cliente: el frontend no
//  debe parsear mensajes de MySQL ni ver tecnicismos.
//
//  Los patrones se comparan contra el mensaje SIN tildes y en minúsculas,
//  por eso "día" y "dia" son el mismo caso.
const REGLAS_DE_RECHAZO = [
  {
    patron: /aforo/,
    status: 409,
    error: 'BLOCK_FULL',
    message: 'El bloque horario ya no tiene cupos disponibles'
  },
  {
    patron: /solapamiento/,
    status: 409,
    error: 'SLOT_TAKEN',
    message: 'El horario solicitado ya está reservado con otro paciente'
  },
  {
    patron: /bloque horario (invalido|inexistente)|no pertenece al profesional/,
    status: 404,
    error: 'BLOCK_NOT_FOUND',
    message: 'El bloque horario no existe o no corresponde a ese profesional'
  },
  {
    patron: /servicio inexistente/,
    status: 404,
    error: 'SERVICE_NOT_FOUND',
    message: 'El servicio no existe o está inactivo'
  },
  {
    patron: /profesional inexistente/,
    status: 404,
    error: 'THERAPIST_NOT_FOUND',
    message: 'El profesional no existe o está inactivo'
  },
  {
    patron: /no corresponde al dia de la semana/,
    status: 400,
    error: 'DATE_NOT_IN_BLOCK',
    message: 'La fecha no corresponde al día de la semana del bloque'
  },
  {
    patron: /fuera del rango/,
    status: 400,
    error: 'OUT_OF_BLOCK_RANGE',
    message: 'La hora solicitada está fuera del rango del bloque'
  },
  {
    patron: /excede el bloque/,
    status: 400,
    error: 'SERVICE_TOO_LONG',
    message: 'La duración del servicio excede el bloque horario'
  }
];

/** Quita diacríticos y pasa a minúsculas, para comparar mensajes de MySQL. */
const sinAcentos = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Traduce un error del SP / trigger / índice al contrato de la API.
 * @returns {{status:number,error:string,message:string}|null}
 *          null cuando no es un rechazo de negocio (=> 500).
 */
const traducirErrorDeReserva = (error) => {
  // 1) Índice único uq_citas_slot: misma fecha y hora_inicio con una cita
  //    vigente. Es la red de seguridad cuando la carrera la gana el índice
  //    y no el COUNT(*) del SP.
  //    ⚠️ Se comprueba ANTES que el 23000 genérico (ER_DUP_ENTRY también
  //    es SQLSTATE 23000).
  if (error.code === 'ER_DUP_ENTRY') {
    return {
      status: 409,
      error: 'SLOT_TAKEN',
      message: 'El horario solicitado ya está reservado con otro paciente'
    };
  }

  // 2) FK violada (paciente inexistente, por ejemplo): SQLSTATE 23000.
  if (error.sqlState === '23000') {
    return {
      status: 404,
      error: 'RESOURCE_NOT_FOUND',
      message: 'Alguno de los recursos referenciados no existe'
    };
  }

  // 3) SIGNAL de negocio (SQLSTATE 45000) del SP o del trigger.
  if (error.sqlState === '45000') {
    const texto = sinAcentos(error.sqlMessage);
    const regla = REGLAS_DE_RECHAZO.find((r) => r.patron.test(texto));

    if (regla) {
      return { status: regla.status, error: regla.error, message: regla.message };
    }

    // Un SIGNAL desconocido sigue siendo un rechazo de negocio, no un 500.
    return {
      status: 409,
      error: 'RESERVE_REJECTED',
      message: 'No fue posible reservar el horario solicitado'
    };
  }

  return null;
};

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

/** Carga una cita con los nombres de profesional y servicio resueltos. */
const cargarCita = async (idCita) => {
  const [rows] = await pool.query(
    `SELECT c.id_cita, c.id_paciente, c.id_profesional, c.id_servicio, c.id_bloque,
            DATE_FORMAT(c.fecha_cita, '%Y-%m-%d') AS fecha_cita,
            c.hora_inicio, c.hora_fin, c.estado, c.motivo,
            CONCAT(u.nombre, ' ', u.apellido) AS profesional,
            s.nombre AS servicio
       FROM citas c
       JOIN profesionales p ON p.id_profesional = c.id_profesional
       JOIN usuarios      u ON u.id_usuario     = p.id_usuario
       JOIN servicios     s ON s.id_servicio    = c.id_servicio
      WHERE c.id_cita = ?`,
    [idCita]
  );
  return rows[0] || null;
};

// ---------------------------------------------------------------------
//  POST /api/citas   (PACIENTE)
//  Escenario 1 del AC -> 201 Created
//  Escenario 2 del AC -> 409 Conflict (rollback de la segunda reserva)
// ---------------------------------------------------------------------
const crearCita = async (req, res) => {
  // La conexión se retiene porque los parámetros OUT del SP viven en
  // variables de sesión (@p_id_cita): ambas consultas deben ir por la
  // MISMA conexión.
  const conn = await pool.getConnection();

  try {
    const { id_profesional, id_servicio, id_bloque, fecha, hora_inicio } = req.body || {};

    // --- 1. Campos obligatorios -------------------------------------
    const faltantes = [];
    if (id_profesional === undefined || id_profesional === null) faltantes.push('id_profesional');
    if (id_servicio === undefined || id_servicio === null) faltantes.push('id_servicio');
    if (id_bloque === undefined || id_bloque === null) faltantes.push('id_bloque');
    if (!fecha) faltantes.push('fecha');
    if (!hora_inicio) faltantes.push('hora_inicio');

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: faltantes.map((f) => ({ field: f, issue: 'requerido' }))
      });
    }

    // --- 2. Validación de formato y tipos ---------------------------
    const idProf = Number(id_profesional);
    const idServ = Number(id_servicio);
    const idBloque = Number(id_bloque);

    const enteros = [['id_profesional', idProf], ['id_servicio', idServ], ['id_bloque', idBloque]];
    const noEnteros = enteros.filter(([, valor]) => !Number.isInteger(valor) || valor <= 0);
    if (noEnteros.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Los identificadores deben ser enteros positivos',
        error: 'VALIDATION_ERROR',
        details: noEnteros.map(([field]) => ({ field, issue: 'entero positivo requerido' }))
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

    const hInicio = normalizarHora(hora_inicio);
    if (!hInicio) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Se espera HH:MM (00:00-23:59)',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'hora_inicio', issue: 'formato inválido' }]
      });
    }

    // --- 3. Identidad: el paciente sale del JWT, nunca del body [R1] --
    const [pacRows] = await conn.query(
      'SELECT id_paciente FROM pacientes WHERE id_usuario = ? LIMIT 1',
      [req.user?.user_id]
    );
    const idPaciente = pacRows[0]?.id_paciente;

    if (!idPaciente) {
      return res.status(403).json({
        success: false,
        message: 'Solo los pacientes pueden agendar una cita',
        error: 'NOT_A_PATIENT'
      });
    }

    // --- 4. Reserva transaccional (delegada al SP) -------------------
    // Se limpian las variables de sesión antes de invocar: una conexión
    // reciclada del pool podría arrastrar el valor de una petición previa.
    await conn.query('SET @p_id_cita = NULL, @p_mensaje = NULL');

    await conn.query(
      'CALL sp_agendar_cita(?, ?, ?, ?, ?, ?, @p_id_cita, @p_mensaje)',
      [idPaciente, idProf, idServ, idBloque, fecha, hInicio]
    );

    const [[salida]] = await conn.query(
      'SELECT @p_id_cita AS id_cita, @p_mensaje AS mensaje'
    );

    if (!salida?.id_cita) {
      // El SP no lanzó excepción pero tampoco dejó id: estado inconsistente.
      console.error('crearCita: el SP finalizó sin id_cita', salida);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    // --- 5. Respuesta (Escenario 1: 201 Created) ---------------------
    const cita = await cargarCita(salida.id_cita);

    return res.status(201).json({
      success: true,
      message: 'Cita agendada correctamente',
      data: cita
    });

  } catch (error) {
    const rechazo = traducirErrorDeReserva(error);

    if (rechazo) {
      // Los rechazos de negocio (409/400/404) son resultados esperados:
      // no ensucian los logs con stack traces.
      return res.status(rechazo.status).json({
        success: false,
        message: rechazo.message,
        error: rechazo.error
      });
    }

    console.error('Error en crearCita:', error);
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
//  DELETE /api/citas/:id_cita   (PACIENTE dueño · TERAPEUTA dueño · ADMIN)
//  Baja LÓGICA: estado = 'CANCELADA'.
//
//  No forma parte del AC de US-05, pero sin esto un paciente que reserva
//  bloquea el horario para siempre: es el mismo agujero que US-09 cerró
//  para las inscripciones a talleres.
//
//  Al pasar a CANCELADA, la columna generada `slot_activo` se vuelve NULL
//  y el índice uq_citas_slot deja de bloquear el horario -> el slot se
//  libera SOLO. El trigger trg_citas_bu_validacion no estorba: salta sus
//  validaciones de aforo/solapamiento cuando el estado nuevo es
//  CANCELADA/NO_ASISTIO y excluye la propia fila del conteo.
// ---------------------------------------------------------------------

/** Estados desde los que tiene sentido cancelar. */
const ESTADOS_CANCELABLES = ['PENDIENTE', 'CONFIRMADA'];

const cancelarCita = async (req, res) => {
  try {
    // --- 1. Validación del parámetro y del body ----------------------
    const idCita = Number(req.params.id_cita);
    if (!Number.isInteger(idCita) || idCita <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_cita inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_cita', issue: 'debe ser un entero positivo' }]
      });
    }

    const { motivo } = req.body || {};
    if (motivo !== undefined && motivo !== null &&
        (typeof motivo !== 'string' || motivo.length > 255)) {
      return res.status(400).json({
        success: false,
        message: 'motivo inválido: se espera un texto de hasta 255 caracteres',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'motivo', issue: 'texto de hasta 255 caracteres' }]
      });
    }

    // --- 2. Estado actual (para propiedad y máquina de estados) -------
    const [rows] = await pool.query(
      'SELECT id_cita, id_paciente, id_profesional, estado FROM citas WHERE id_cita = ?',
      [idCita]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No existe una cita con id_cita = ${idCita}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    const cita = rows[0];
    const rol = req.user?.rol;

    // --- 3. Autorización por PROPIEDAD -------------------------------
    // El RBAC por rol ya lo aplicó requireRole() en la ruta; aquí se
    // comprueba que quien cancela sea dueño del recurso:
    //   PACIENTE      -> solo sus propias citas
    //   TERAPEUTA     -> solo las citas de su propia agenda
    //   ADMINISTRADOR -> cualquiera (gestión administrativa)
    if (rol === ROLES.PACIENTE) {
      const [pacRows] = await pool.query(
        'SELECT id_paciente FROM pacientes WHERE id_usuario = ? LIMIT 1',
        [req.user?.user_id]
      );
      const idPaciente = pacRows[0]?.id_paciente;

      if (!idPaciente) {
        return res.status(403).json({
          success: false,
          message: 'Solo los pacientes pueden cancelar sus citas',
          error: 'NOT_A_PATIENT'
        });
      }

      if (idPaciente !== cita.id_paciente) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes cancelar tus propias citas',
          error: 'FORBIDDEN'
        });
      }
    }

    if (rol === ROLES.TERAPEUTA) {
      const [profRows] = await pool.query(
        'SELECT id_profesional FROM profesionales WHERE id_usuario = ? LIMIT 1',
        [req.user?.user_id]
      );
      const idProfesional = profRows[0]?.id_profesional;

      if (!idProfesional) {
        return res.status(403).json({
          success: false,
          message: 'Solo un profesional puede cancelar citas de su agenda',
          error: 'NOT_A_THERAPIST'
        });
      }

      if (idProfesional !== cita.id_profesional) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes cancelar citas de tu propia agenda',
          error: 'FORBIDDEN'
        });
      }
    }

    // --- 4. Máquina de estados ---------------------------------------
    if (cita.estado === 'CANCELADA') {
      return res.status(409).json({
        success: false,
        message: 'La cita ya está cancelada',
        error: 'ALREADY_CANCELLED'
      });
    }

    if (!ESTADOS_CANCELABLES.includes(cita.estado)) {
      return res.status(409).json({
        success: false,
        message: `Una cita en estado ${cita.estado} no se puede cancelar`,
        error: 'NOT_CANCELLABLE'
      });
    }

    // --- 5. Baja lógica ----------------------------------------------
    // El WHERE repite la condición de estado: si otra petición la canceló
    // entre el SELECT y el UPDATE, affectedRows = 0 y no se pisa el cambio.
    // COALESCE preserva el motivo existente cuando no se envía uno nuevo.
    const [resultado] = await pool.query(
      `UPDATE citas
          SET estado = 'CANCELADA',
              motivo = COALESCE(?, motivo)
        WHERE id_cita = ? AND estado IN ('PENDIENTE','CONFIRMADA')`,
      [motivo ?? null, idCita]
    );

    if (resultado.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message: 'La cita cambió de estado y ya no se puede cancelar',
        error: 'CONFLICT'
      });
    }

    // --- 6. Respuesta -------------------------------------------------
    const cancelada = await cargarCita(idCita);

    return res.status(200).json({
      success: true,
      message: 'Cita cancelada correctamente',
      data: cancelada
    });

  } catch (error) {
    // Se reutiliza el traductor de la reserva: si el trigger rechazara el
    // UPDATE, el cliente recibe un 409 de negocio en vez de un 500.
    const rechazo = traducirErrorDeReserva(error);

    if (rechazo) {
      return res.status(rechazo.status).json({
        success: false,
        message: rechazo.message,
        error: rechazo.error
      });
    }

    console.error('Error en cancelarCita:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  crearCita,
  cancelarCita
};
