// =====================================================================
//  S.A.P.C. — CHAWAL  |  Catálogo de roles (fuente única de verdad)
//  Archivo: backend/src/utils/roles.js
//  Historia: US-03 (SCRUM-11) — Middlewares de autorización por roles
// =====================================================================
//  Los roles son un catálogo CERRADO que vive en la BD como
//  `roles.nombre_rol ENUM('ADMINISTRADOR','TERAPEUTA','PACIENTE')`
//  (schema.sql §1). El nombre —no el id— es lo que viaja firmado en el
//  payload del JWT, por eso el middleware `requireRole` compara contra
//  estos strings exactos.
//
//  Antes de este módulo el vocabulario estaba repetido en tres formas
//  desconectadas: el ENUM de la BD, los literales en cada ruta
//  (`requireRole('ADMINISTRADOR')`) y el número mágico `ROL_TERAPEUTA = 2`
//  en dos controladores. Ahora todo cambio de vocabulario se hace aquí.
// =====================================================================

/**
 * Nombres de rol tal como existen en `roles.nombre_rol`.
 * Se usan en `requireRole(...)` y viajan en el JWT (`payload.rol`).
 */
const ROLES = Object.freeze({
  ADMINISTRADOR: 'ADMINISTRADOR',
  TERAPEUTA: 'TERAPEUTA',
  PACIENTE: 'PACIENTE'
});

/**
 * ids de rol del seed (roles.id_rol). Se usan para los checks de dominio
 * contra columnas `id_rol` (p. ej. validar que el instructor de un taller
 * sea TERAPEUTA). Mantener sincronizado con `seed.sql` §1.
 */
const IDS_ROL = Object.freeze({
  ADMINISTRADOR: 1,
  TERAPEUTA: 2,
  PACIENTE: 3
});

/**
 * Nombres válidos. `requireRole` lo usa para avisar —en tiempo de montaje
 * de rutas, no de petición— si alguien escribe mal un rol: sin esta
 * validación la ruta quedaría inaccesible para todos en silencio.
 */
const ROLES_VALIDOS = Object.freeze(Object.values(ROLES));

module.exports = {
  ROLES,
  IDS_ROL,
  ROLES_VALIDOS
};
