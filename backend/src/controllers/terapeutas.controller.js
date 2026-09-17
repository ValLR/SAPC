// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Terapeutas (CRUD)
//  Archivo: backend/src/controllers/terapeutas.controller.js
//  Historia: US-13 (SCRUM-21)
// =====================================================================
//  Abstrae la complejidad relacional: el frontend envía y recibe un
//  único objeto plano, aunque la información viva en 4 tablas:
//    usuarios + profesionales + especialidades + profesional_especialidad
// =====================================================================

const bcrypt = require('bcrypt');
const pool = require('../config/db');

// ---------------------------------------------------------------------
//  Constantes de dominio
// ---------------------------------------------------------------------
const ROL_TERAPEUTA = 2;   // roles.id_rol = 2 (TERAPEUTA)
const ESTADOS_CUENTA = ['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE'];
const ESTADOS_DISPONIBILIDAD = ['DISPONIBLE', 'NO_DISPONIBLE', 'LICENCIA'];

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

/**
 * Compone el objeto unificado de terapeuta a partir de las filas de BD.
 * @param {object} base  Fila con datos de usuarios + profesionales
 * @param {Array}  especialidades  Filas de especialidades asignadas
 */
const componerTerapeuta = (base, especialidades) => ({
  id_profesional: base.id_profesional,
  id_usuario: base.id_usuario,
  rut: base.rut,
  nombre: base.nombre,
  apellido: base.apellido,
  email: base.email,
  telefono: base.telefono,
  estado_cuenta: base.estado,
  numero_registro: base.numero_registro,
  titulo_profesional: base.titulo_profesional,
  anios_experiencia: base.anios_experiencia,
  biografia: base.biografia,
  estado_disponibilidad: base.estado_disponibilidad,
  activo: Boolean(base.activo),
  especialidades: especialidades.map((e) => ({
    id_especialidad: e.id_especialidad,
    nombre: e.nombre,
    es_principal: Boolean(e.es_principal)
  })),
  created_at: base.created_at,
  updated_at: base.updated_at
});

/**
 * Carga las especialidades asignadas a uno o varios profesionales.
 * @param {Array<number>} idsProfesionales
 * @returns {Map<number, Array>}  id_profesional -> especialidades
 */
const cargarEspecialidades = async (idsProfesionales) => {
  const mapa = new Map();
  if (idsProfesionales.length === 0) return mapa;

  const placeholders = idsProfesionales.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT pe.id_profesional, pe.id_especialidad, pe.es_principal, e.nombre
       FROM profesional_especialidad pe
       JOIN especialidades e ON e.id_especialidad = pe.id_especialidad
      WHERE pe.id_profesional IN (${placeholders})
      ORDER BY pe.es_principal DESC, e.nombre`,
    idsProfesionales
  );

  for (const r of rows) {
    if (!mapa.has(r.id_profesional)) mapa.set(r.id_profesional, []);
    mapa.get(r.id_profesional).push(r);
  }
  return mapa;
};

/**
 * Valida el arreglo de especialidades del request.
 * @returns {{ ok: boolean, mensaje?: string }}
 */
const validarEspecialidades = (especialidades) => {
  if (!Array.isArray(especialidades) || especialidades.length === 0) {
    return { ok: false, mensaje: 'Debe asignar al menos una especialidad' };
  }

  const principales = especialidades.filter((e) => e.es_principal === true);
  if (principales.length > 1) {
    return { ok: false, mensaje: 'Solo se permite una especialidad principal por profesional' };
  }

  for (const e of especialidades) {
    if (typeof e.id_especialidad !== 'number') {
      return { ok: false, mensaje: 'Cada especialidad requiere id_especialidad numérico' };
    }
    if (typeof e.es_principal !== 'boolean') {
      return { ok: false, mensaje: 'Cada especialidad requiere es_principal booleano' };
    }
  }

  return { ok: true };
};

/**
 * Verifica que todos los IDs de especialidad existan en el catálogo.
 */
const especialidadesExisten = async (ids) => {
  if (ids.length === 0) return true;
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM especialidades WHERE id_especialidad IN (${placeholders})`,
    ids
  );
  return rows[0].total === ids.length;
};

// ---------------------------------------------------------------------
//  ESCENARIO 1 — Alta de un nuevo especialista
//  POST /api/terapeutas   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const crearTerapeuta = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      rut, nombre, apellido, email, telefono, password,
      numero_registro, titulo_profesional, anios_experiencia,
      biografia, estado_disponibilidad, especialidades
    } = req.body;

    // --- Validación de campos obligatorios ---
    const faltantes = [];
    if (!rut) faltantes.push('rut');
    if (!nombre) faltantes.push('nombre');
    if (!apellido) faltantes.push('apellido');
    if (!email) faltantes.push('email');
    if (!password) faltantes.push('password');
    if (!numero_registro) faltantes.push('numero_registro');

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: faltantes.map((f) => ({ field: f, issue: 'requerido' }))
      });
    }

    // --- Validación de especialidades ---
    const valEsp = validarEspecialidades(especialidades);
    if (!valEsp.ok) {
      return res.status(400).json({
        success: false,
        message: valEsp.mensaje,
        error: 'VALIDATION_ERROR',
        details: [{ field: 'especialidades', issue: valEsp.mensaje }]
      });
    }

    // --- Validación de enums ---
    if (estado_disponibilidad && !ESTADOS_DISPONIBILIDAD.includes(estado_disponibilidad)) {
      return res.status(400).json({
        success: false,
        message: `estado_disponibilidad inválido. Valores: ${ESTADOS_DISPONIBILIDAD.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: [{ field: 'estado_disponibilidad', issue: 'valor no permitido' }]
      });
    }

    // --- Verificar existencia de especialidades ---
    const idsEsp = especialidades.map((e) => e.id_especialidad);
    if (!(await especialidadesExisten(idsEsp))) {
      return res.status(400).json({
        success: false,
        message: 'Una o más especialidades no existen en el catálogo',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'especialidades', issue: 'id inexistente' }]
      });
    }

    // --- Verificar duplicados (RUT / email / numero_registro) ---
    const [dup] = await conn.query(
      `SELECT rut, email FROM usuarios WHERE rut = ? OR email = ?`,
      [rut, email]
    );
    const [dupReg] = await conn.query(
      `SELECT id_profesional FROM profesionales WHERE numero_registro = ?`,
      [numero_registro]
    );

    const detallesDup = [];
    if (dup.some((d) => d.rut === rut)) detallesDup.push({ field: 'rut', issue: 'ya existe' });
    if (dup.some((d) => d.email === email)) detallesDup.push({ field: 'email', issue: 'ya existe' });
    if (dupReg.length > 0) detallesDup.push({ field: 'numero_registro', issue: 'ya existe' });

    if (detallesDup.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Recurso duplicado',
        error: 'DUPLICATE_RESOURCE',
        details: detallesDup
      });
    }

    // --- Transacción: usuarios + profesionales + puente ---
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);

    const [resUser] = await conn.query(
      `INSERT INTO usuarios
         (id_rol, rut, nombre, apellido, email, password_hash, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVO')`,
      [ROL_TERAPEUTA, rut, nombre, apellido, email, passwordHash, telefono || null]
    );
    const idUsuario = resUser.insertId;

    // Especialidad principal (para la columna de acceso directo)
    const principal = especialidades.find((e) => e.es_principal === true);

    const [resProf] = await conn.query(
      `INSERT INTO profesionales
         (id_usuario, numero_registro, titulo_profesional, id_especialidad_principal,
          anios_experiencia, biografia, estado_disponibilidad)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idUsuario,
        numero_registro,
        titulo_profesional || null,
        principal ? principal.id_especialidad : null,
        anios_experiencia || 0,
        biografia || null,
        estado_disponibilidad || 'DISPONIBLE'
      ]
    );
    const idProfesional = resProf.insertId;

    // Puente N:M
    const valoresPuente = especialidades.map((e) => [
      idProfesional, e.id_especialidad, e.es_principal ? 1 : 0
    ]);
    await conn.query(
      `INSERT INTO profesional_especialidad (id_profesional, id_especialidad, es_principal) VALUES ?`,
      [valoresPuente]
    );

    await conn.commit();

    // --- Respuesta ---
    const [baseRows] = await pool.query(
      `SELECT p.id_profesional, p.id_usuario, u.rut, u.nombre, u.apellido, u.email,
              u.telefono, u.estado, p.numero_registro, p.titulo_profesional,
              p.anios_experiencia, p.biografia, p.estado_disponibilidad, p.activo,
              p.created_at, p.updated_at
         FROM profesionales p
         JOIN usuarios u ON u.id_usuario = p.id_usuario
        WHERE p.id_profesional = ?`,
      [idProfesional]
    );
    const mapaEsp = await cargarEspecialidades([idProfesional]);

    return res.status(201).json({
      success: true,
      message: 'Terapeuta creado correctamente',
      data: componerTerapeuta(baseRows[0], mapaEsp.get(idProfesional) || [])
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error en crearTerapeuta:', error);
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
//  ESCENARIO 2 — Consulta del catálogo de terapeutas
//  GET /api/terapeutas
// ---------------------------------------------------------------------
const listarTerapeutas = async (req, res) => {
  try {
    const { activo, id_especialidad } = req.query;

    let sql = `SELECT p.id_profesional, p.id_usuario, u.rut, u.nombre, u.apellido,
                      u.email, u.telefono, u.estado, p.numero_registro,
                      p.titulo_profesional, p.anios_experiencia, p.biografia,
                      p.estado_disponibilidad, p.activo,
                      p.created_at, p.updated_at
                 FROM profesionales p
                 JOIN usuarios u ON u.id_usuario = p.id_usuario`;
    const params = [];
    const condiciones = [];

    if (activo !== undefined) {
      condiciones.push('p.activo = ?');
      params.push(activo === 'true' || activo === '1' ? 1 : 0);
    }

    if (id_especialidad !== undefined) {
      sql += ` JOIN profesional_especialidad pe ON pe.id_profesional = p.id_profesional`;
      condiciones.push('pe.id_especialidad = ?');
      params.push(Number(id_especialidad));
    }

    if (condiciones.length > 0) sql += ' WHERE ' + condiciones.join(' AND ');
    sql += ' ORDER BY u.apellido, u.nombre';

    const [rows] = await pool.query(sql, params);

    const ids = rows.map((r) => r.id_profesional);
    const mapaEsp = await cargarEspecialidades(ids);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((r) => componerTerapeuta(r, mapaEsp.get(r.id_profesional) || []))
    });

  } catch (error) {
    console.error('Error en listarTerapeutas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ---------------------------------------------------------------------
//  ESCENARIO 3 — Actualización de datos de terapeuta
//  PUT /api/terapeutas/:id_profesional   (ADMINISTRADOR)
// ---------------------------------------------------------------------
const actualizarTerapeuta = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idProfesional = Number(req.params.id_profesional);

    if (!Number.isInteger(idProfesional) || idProfesional <= 0) {
      return res.status(400).json({
        success: false,
        message: 'id_profesional inválido',
        error: 'VALIDATION_ERROR',
        details: [{ field: 'id_profesional', issue: 'debe ser un entero positivo' }]
      });
    }

    // --- Verificar existencia ---
    const [existe] = await conn.query(
      `SELECT p.id_profesional, p.id_usuario
         FROM profesionales p
        WHERE p.id_profesional = ?`,
      [idProfesional]
    );

    if (existe.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No existe un terapeuta con id_profesional = ${idProfesional}`,
        error: 'RESOURCE_NOT_FOUND'
      });
    }

    const { id_usuario } = existe[0];

    const {
      telefono, titulo_profesional, biografia, anios_experiencia,
      estado_disponibilidad, estado_cuenta, especialidades
    } = req.body;

    // --- Validaciones de enums ---
    if (estado_disponibilidad && !ESTADOS_DISPONIBILIDAD.includes(estado_disponibilidad)) {
      return res.status(400).json({
        success: false,
        message: `estado_disponibilidad inválido. Valores: ${ESTADOS_DISPONIBILIDAD.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: [{ field: 'estado_disponibilidad', issue: 'valor no permitido' }]
      });
    }
    if (estado_cuenta && !ESTADOS_CUENTA.includes(estado_cuenta)) {
      return res.status(400).json({
        success: false,
        message: `estado_cuenta inválido. Valores: ${ESTADOS_CUENTA.join(', ')}`,
        error: 'VALIDATION_ERROR',
        details: [{ field: 'estado_cuenta', issue: 'valor no permitido' }]
      });
    }

    // --- Validación de especialidades (si se envían) ---
    if (especialidades !== undefined) {
      const valEsp = validarEspecialidades(especialidades);
      if (!valEsp.ok) {
        return res.status(400).json({
          success: false,
          message: valEsp.mensaje,
          error: 'VALIDATION_ERROR',
          details: [{ field: 'especialidades', issue: valEsp.mensaje }]
        });
      }
      const idsEsp = especialidades.map((e) => e.id_especialidad);
      if (!(await especialidadesExisten(idsEsp))) {
        return res.status(400).json({
          success: false,
          message: 'Una o más especialidades no existen en el catálogo',
          error: 'VALIDATION_ERROR',
          details: [{ field: 'especialidades', issue: 'id inexistente' }]
        });
      }
    }

    await conn.beginTransaction();

    // --- Actualizar usuarios (solo campos permitidos) ---
    const camposUsuario = [];
    const valoresUsuario = [];
    if (telefono !== undefined) { camposUsuario.push('telefono = ?'); valoresUsuario.push(telefono); }
    if (estado_cuenta !== undefined) { camposUsuario.push('estado = ?'); valoresUsuario.push(estado_cuenta); }

    if (camposUsuario.length > 0) {
      valoresUsuario.push(id_usuario);
      await conn.query(
        `UPDATE usuarios SET ${camposUsuario.join(', ')} WHERE id_usuario = ?`,
        valoresUsuario
      );
    }

    // --- Actualizar profesionales ---
    const camposProf = [];
    const valoresProf = [];
    if (titulo_profesional !== undefined) { camposProf.push('titulo_profesional = ?'); valoresProf.push(titulo_profesional); }
    if (biografia !== undefined) { camposProf.push('biografia = ?'); valoresProf.push(biografia); }
    if (anios_experiencia !== undefined) { camposProf.push('anios_experiencia = ?'); valoresProf.push(anios_experiencia); }
    if (estado_disponibilidad !== undefined) { camposProf.push('estado_disponibilidad = ?'); valoresProf.push(estado_disponibilidad); }

    // Si se envían especialidades, sincronizar también la principal
    if (especialidades !== undefined) {
      const principal = especialidades.find((e) => e.es_principal === true);
      camposProf.push('id_especialidad_principal = ?');
      valoresProf.push(principal ? principal.id_especialidad : null);
    }

    if (camposProf.length > 0) {
      valoresProf.push(idProfesional);
      await conn.query(
        `UPDATE profesionales SET ${camposProf.join(', ')} WHERE id_profesional = ?`,
        valoresProf
      );
    }

    // --- Reemplazar especialidades (si se envían) ---
    if (especialidades !== undefined) {
      await conn.query(
        `DELETE FROM profesional_especialidad WHERE id_profesional = ?`,
        [idProfesional]
      );
      const valoresPuente = especialidades.map((e) => [
        idProfesional, e.id_especialidad, e.es_principal ? 1 : 0
      ]);
      await conn.query(
        `INSERT INTO profesional_especialidad (id_profesional, id_especialidad, es_principal) VALUES ?`,
        [valoresPuente]
      );
    }

    await conn.commit();

    // --- Respuesta ---
    const [baseRows] = await pool.query(
      `SELECT p.id_profesional, p.id_usuario, u.rut, u.nombre, u.apellido, u.email,
              u.telefono, u.estado, p.numero_registro, p.titulo_profesional,
              p.anios_experiencia, p.biografia, p.estado_disponibilidad, p.activo,
              p.created_at, p.updated_at
         FROM profesionales p
         JOIN usuarios u ON u.id_usuario = p.id_usuario
        WHERE p.id_profesional = ?`,
      [idProfesional]
    );
    const mapaEsp = await cargarEspecialidades([idProfesional]);

    return res.status(200).json({
      success: true,
      message: 'Terapeuta actualizado correctamente',
      data: componerTerapeuta(baseRows[0], mapaEsp.get(idProfesional) || [])
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error en actualizarTerapeuta:', error);
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
  crearTerapeuta,
  listarTerapeutas,
  actualizarTerapeuta
};
