// =====================================================================
//  S.A.P.C. — CHAWAL  |  Middleware de autenticación y autorización
//  Archivo: backend/src/middlewares/auth.middleware.js
// =====================================================================
//  verifyToken  -> valida el JWT del header Authorization: Bearer <token>
//  requireRole  -> restringe el acceso a uno o más roles
// =====================================================================
//  US-03 (SCRUM-11):
//    Escenario 1 — rol insuficiente        -> 403 FORBIDDEN
//    Escenario 2 — token ausente/caducado  -> 401 UNAUTHORIZED
//
//  El rol NO se consulta en la BD: viaja firmado en el payload del JWT
//  (así lo exige el AC). Por eso el 401 corta la petición antes de que
//  cualquier controlador ejecute una sola consulta.
//
//  Esquema de autenticación según RFC 7235:
//    - El esquema ("Bearer") es case-insensitive y se separa del token
//      por uno o más espacios.
//    - Toda respuesta 401 debe incluir la cabecera WWW-Authenticate.
// =====================================================================

const jwt = require('jsonwebtoken');
const { ROLES_VALIDOS } = require('../utils/roles');

const ISSUER = 'SAPC-Chawal-API';
const ALGORITMOS_ACEPTADOS = ['HS256'];   // el login firma siempre con HS256

/**
 * Extrae el token de una cabecera `Authorization: Bearer <token>`.
 * @returns {string|null} el token, o null si la cabecera falta o es inválida.
 */
const extraerBearer = (header) => {
  if (typeof header !== 'string') return null;

  const [esquema, token] = header.trim().split(/\s+/);
  if (!token || esquema.toLowerCase() !== 'bearer') return null;

  return token;
};

/** Respuesta 401 uniforme (incluye WWW-Authenticate, exigido por RFC 7235). */
const noAutorizado = (res, message, error) =>
  res
    .status(401)
    .set('WWW-Authenticate', `Bearer realm="${ISSUER}"`)
    .json({ success: false, message, error });

/**
 * Verifica el JWT y adjunta el payload a req.user.
 * Responde 401 si el token falta, es inválido o expiró.
 */
const verifyToken = (req, res, next) => {
  const token = extraerBearer(req.headers.authorization);

  if (!token) {
    return noAutorizado(res, 'Token no proporcionado', 'MISSING_TOKEN');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: ISSUER,
      algorithms: ALGORITMOS_ACEPTADOS
    });
    req.user = payload;   // { user_id, rol, email, iat, exp }
    return next();
  } catch (error) {
    const expired = error.name === 'TokenExpiredError';
    return noAutorizado(
      res,
      expired ? 'Token expirado' : 'Token inválido',
      expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    );
  }
};

/**
 * Restringe el acceso a los roles indicados (US-03, Escenario 1).
 * Debe usarse SIEMPRE después de verifyToken.
 *
 * La comparación es una igualdad exacta contra el catálogo cerrado
 * `roles.nombre_rol`: no hay consulta a la BD ni comodines por rol.
 *
 * @param {...string} rolesPermitidos  Ej: requireRole(ROLES.ADMINISTRADOR)
 */
const requireRole = (...rolesPermitidos) => {
  // Se valida en tiempo de MONTAJE de rutas, no de petición: si alguien
  // escribe mal un rol, la ruta quedaría inaccesible para todos y el
  // error pasaría inadvertido. Mejor un aviso ruidoso al arrancar.
  const desconocidos = rolesPermitidos.filter((rol) => !ROLES_VALIDOS.includes(rol));
  if (desconocidos.length > 0) {
    console.warn(
      `⚠️  requireRole() con rol no reconocido: ${desconocidos.join(', ')}. ` +
      `Roles válidos: ${ROLES_VALIDOS.join(', ')}`
    );
  }

  return (req, res, next) => {
    if (!req.user) {
      return noAutorizado(res, 'No autenticado', 'MISSING_TOKEN');
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: `Se requiere rol ${rolesPermitidos.join(' o ')} para esta operación`,
        error: 'FORBIDDEN'
      });
    }

    return next();
  };
};

module.exports = {
  verifyToken,
  requireRole
};
