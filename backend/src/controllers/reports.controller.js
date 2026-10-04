// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Reportería (métricas de demanda)
//  Archivo: backend/src/controllers/reports.controller.js
//  Historia: US-15 (SCRUM-23)
// =====================================================================
//  Un solo endpoint de SOLO LECTURA resuelto con DOS consultas agregadas
//  (COUNT + GROUP BY), sin N+1 ni bucles por fila:
//
//    1. profesionales LEFT JOIN citas -> total / vigentes / canceladas
//       por especialista, más un rollup por especialidad principal.
//    2. clases_grupales LEFT JOIN inscripciones -> ocupación por taller
//       y agregado global.
//
//  Decisiones de definición (documentadas en docs-local/contrato-us15-reportes.md):
//
//  - "Por especialista" es por PROFESIONAL (la persona), con su
//    especialidad principal como etiqueta. El rollup por especialidad
//    usa `profesionales.id_especialidad_principal`, que es 1:1, así que
//    NO hay doble conteo (a diferencia del puente N:M
//    profesional_especialidad, donde un profesional con 2 especialidades
//    aparecería dos veces).
//  - "Total de citas" se acompaña del desglose por estado: un reporte de
//    demanda que mezcle canceladas infla el número. `vigentes` excluye
//    CANCELADA y NO_ASISTIO, el mismo criterio del SP y los triggers.
//  - "Ocupación" usa la MISMA fórmula que el portal web
//    (web/src/services/classesWebService.js):
//        inscritos   = COUNT(inscripciones_clase WHERE estado = 'ACTIVA')
//        porcentaje  = min(100, round(inscritos / aforo_maximo * 100))
//    Se cuenta la tabla de inscripciones y no `aforo_maximo -
//    cupos_disponibles`, porque `cupos_disponibles` es un contador
//    denormalizado que puede desincronizarse.
//
//  El filtro por fecha es opcional; sin él, el reporte es histórico.
// =====================================================================

const pool = require('../config/db');
const { esFechaISO } = require('../utils/tiempo');

const ESTADOS_QUE_NO_OCUPAN = ['CANCELADA', 'NO_ASISTIO'];

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

/** Valida los filtros opcionales `desde` / `hasta` (YYYY-MM-DD). */
const validarFiltros = (desde, hasta) => {
  const detalles = [];

  if (desde !== undefined && !esFechaISO(desde)) {
    detalles.push({ field: 'desde', issue: 'formato YYYY-MM-DD requerido' });
  }
  if (hasta !== undefined && !esFechaISO(hasta)) {
    detalles.push({ field: 'hasta', issue: 'formato YYYY-MM-DD requerido' });
  }
  if (detalles.length === 0 && desde && hasta && hasta < desde) {
    detalles.push({ field: 'hasta', issue: 'no puede ser anterior a desde' });
  }

  return detalles;
};

/**
 * Fragmento de filtro por fecha, pensado para concatenarse DESPUÉS de un
 * `WHERE` o de un `ON`. Sin filtros devuelve cadena vacía.
 * ⚠️ El nombre de la columna se interpola, pero NUNCA viene del cliente:
 * son literales fijos de este archivo. Los valores van parametrizados.
 */
const filtroFecha = (columna, desde, hasta) => {
  const condiciones = [];
  const params = [];

  if (desde) { condiciones.push(`${columna} >= ?`); params.push(desde); }
  if (hasta) { condiciones.push(`${columna} <= ?`); params.push(hasta); }

  return {
    sql: condiciones.length === 0 ? '' : ` AND ${condiciones.join(' AND ')}`,
    params
  };
};

/** Porcentaje de ocupación con la fórmula del portal (tope 100). */
const porcentajeOcupacion = (inscritos, aforo) =>
  aforo > 0 ? Math.min(100, Math.round((inscritos / aforo) * 100)) : 0;

/**
 * Citas por profesional.
 * ⚠️ El filtro de fechas va en el ON del LEFT JOIN, no en el WHERE: si
 * fuera al WHERE, los profesionales sin citas en el rango desaparecerían
 * del reporte en vez de aparecer con 0.
 */
const citasPorEspecialista = async (desde, hasta) => {
  const filtro = filtroFecha('c.fecha_cita', desde, hasta);

  const [rows] = await pool.query(
    `SELECT p.id_profesional,
            CONCAT(u.nombre, ' ', u.apellido) AS especialista,
            e.id_especialidad,
            COALESCE(e.nombre, 'Sin especialidad principal') AS especialidad,
            COUNT(c.id_cita) AS total_citas,
            COUNT(CASE WHEN c.estado NOT IN (?, ?) THEN 1 END) AS vigentes,
            COUNT(CASE WHEN c.estado = 'CANCELADA'  THEN 1 END) AS canceladas,
            COUNT(CASE WHEN c.estado = 'NO_ASISTIO' THEN 1 END) AS no_asistio
       FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
  LEFT JOIN especialidades e
         ON e.id_especialidad = p.id_especialidad_principal
  LEFT JOIN citas c
         ON c.id_profesional = p.id_profesional${filtro.sql}
      WHERE p.activo = 1
   GROUP BY p.id_profesional, u.nombre, u.apellido, e.id_especialidad, e.nombre
   ORDER BY total_citas DESC, especialista ASC`,
    [...ESTADOS_QUE_NO_OCUPAN, ...filtro.params]
  );

  return rows;
};

/** Ocupación de talleres: una fila por clase con sus inscripciones activas. */
const ocupacionPorClase = async (desde, hasta) => {
  const filtro = filtroFecha('c.fecha_clase', desde, hasta);

  const [rows] = await pool.query(
    `SELECT c.id_clase,
            c.nombre_actividad,
            c.sala,
            DATE_FORMAT(c.fecha_clase, '%Y-%m-%d') AS fecha_clase,
            TIME_FORMAT(c.hora_inicio, '%H:%i')    AS hora_inicio,
            TIME_FORMAT(c.hora_fin,    '%H:%i')    AS hora_fin,
            c.estado_clase,
            c.aforo_maximo,
            c.cupos_disponibles,
            COUNT(CASE WHEN i.estado_inscripcion = 'ACTIVA' THEN 1 END) AS inscritos
       FROM clases_grupales c
  LEFT JOIN inscripciones_clases i ON i.id_clase = c.id_clase
      WHERE 1 = 1${filtro.sql}
   GROUP BY c.id_clase, c.nombre_actividad, c.sala, c.fecha_clase, c.hora_inicio,
            c.hora_fin, c.estado_clase, c.aforo_maximo, c.cupos_disponibles
   ORDER BY c.fecha_clase ASC, c.hora_inicio ASC`,
    filtro.params
  );

  return rows;
};

/** Comprime las filas por profesional en la lista + el rollup por especialidad. */
const componerMetricasDeCitas = (filas) => {
  const porEspecialista = filas.map((f) => ({
    id_profesional: f.id_profesional,
    especialista: f.especialista,
    id_especialidad: f.id_especialidad,
    especialidad: f.especialidad,
    total_citas: Number(f.total_citas),
    vigentes: Number(f.vigentes),
    canceladas: Number(f.canceladas),
    no_asistio: Number(f.no_asistio)
  }));

  // Rollup por especialidad principal (1:1 -> sin doble conteo).
  const acumulado = new Map();
  for (const f of porEspecialista) {
    const clave = f.id_especialidad ?? 0;
    const acc = acumulado.get(clave) ?? {
      id_especialidad: f.id_especialidad,
      especialidad: f.especialidad,
      total_citas: 0,
      vigentes: 0
    };
    acc.total_citas += f.total_citas;
    acc.vigentes += f.vigentes;
    acumulado.set(clave, acc);
  }

  const porEspecialidad = [...acumulado.values()]
    .sort((a, b) => b.total_citas - a.total_citas || a.especialidad.localeCompare(b.especialidad));

  const totales = porEspecialista.reduce(
    (acc, f) => ({
      total: acc.total + f.total_citas,
      vigentes: acc.vigentes + f.vigentes,
      canceladas: acc.canceladas + f.canceladas,
      no_asistio: acc.no_asistio + f.no_asistio
    }),
    { total: 0, vigentes: 0, canceladas: 0, no_asistio: 0 }
  );

  return {
    total: totales.total,
    vigentes: totales.vigentes,
    canceladas: totales.canceladas,
    no_asistio: totales.no_asistio,
    por_especialista: porEspecialista,
    por_especialidad: porEspecialidad
  };
};

/** Compone el detalle por clase + el agregado global. */
const componerMetricasDeOcupacion = (filas) => {
  const detalle = filas.map((c) => {
    const aforo = Number(c.aforo_maximo);
    const inscritos = Number(c.inscritos);
    const cupos = Number(c.cupos_disponibles);
    const porcentaje = porcentajeOcupacion(inscritos, aforo);

    return {
      id_clase: c.id_clase,
      nombre_actividad: c.nombre_actividad,
      sala: c.sala,
      fecha_clase: c.fecha_clase,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      estado_clase: c.estado_clase,
      aforo_maximo: aforo,
      inscritos,
      cupos_disponibles: cupos,
      porcentaje_ocupacion: porcentaje,
      // Mismo criterio que el portal (classesWebService.isFull).
      completa: cupos === 0 || porcentaje >= 100
    };
  });

  // El global ignora las clases canceladas: un taller que no se dicta no
  // aporta aforo. Se reporta cuántas se excluyeron para que sea trazable.
  const vigentes = detalle.filter((c) => c.estado_clase !== 'CANCELADA');
  const aforoTotal = vigentes.reduce((s, c) => s + c.aforo_maximo, 0);
  const inscritosTotal = vigentes.reduce((s, c) => s + c.inscritos, 0);

  return {
    global: {
      clases: vigentes.length,
      aforo_total: aforoTotal,
      inscritos_total: inscritosTotal,
      porcentaje_ocupacion: porcentajeOcupacion(inscritosTotal, aforoTotal),
      clases_canceladas_excluidas: detalle.length - vigentes.length
    },
    detalle
  };
};

// ---------------------------------------------------------------------
//  GET /api/reports/ocupacion   (ADMINISTRADOR)
//
//  Escenario 1 del AC -> 200 con el payload consolidado.
//  Escenario 2 del AC -> 403 (lo aplica requireRole en la ruta, US-03).
//
//  Query params opcionales: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ---------------------------------------------------------------------
const obtenerOcupacion = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    const detalles = validarFiltros(desde, hasta);
    if (detalles.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Filtro de fechas inválido',
        error: 'VALIDATION_ERROR',
        details: detalles
      });
    }

    const [filasCitas, filasClases] = await Promise.all([
      citasPorEspecialista(desde, hasta),
      ocupacionPorClase(desde, hasta)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Métricas consolidadas generadas correctamente',
      generado_en: new Date().toISOString(),
      rango: { desde: desde ?? null, hasta: hasta ?? null },
      citas: componerMetricasDeCitas(filasCitas),
      ocupacion_clases: componerMetricasDeOcupacion(filasClases)
    });

  } catch (error) {
    console.error('Error en obtenerOcupacion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  obtenerOcupacion
};
