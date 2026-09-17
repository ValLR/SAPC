// =====================================================================
//  S.A.P.C. — CHAWAL  |  Middleware de autenticación y autorización
//  Archivo: backend/src/middlewares/auth.middleware.js
// =====================================================================
//  verifyToken  -> valida el JWT del header Authorization: Bearer <token>
//  requireRole  -> restringe el acceso a uno o más roles
// =====================================================================

const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT y adjunta el payload a req.user.
 * Responde 401 si el token falta, es inválido o expiró.
 */
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado',
      error: 'MISSING_TOKEN'
    });
  }

  const token = header.slice(7).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'SAPC-Chawal-API'
    });
    req.user = payload;   // { user_id, rol, email, iat, exp }
    return next();
  } catch (error) {
    const expired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: expired ? 'Token expirado' : 'Token inválido',
      error: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

/**
 * Restringe el acceso a los roles indicados.
 * Debe usarse SIEMPRE después de verifyToken.
 *
 * @param {...string} rolesPermitidos  Ej: requireRole('ADMINISTRADOR')
 */
const requireRole = (...rolesPermitidos) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado',
      error: 'MISSING_TOKEN'
    });
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

module.exports = {
  verifyToken,
  requireRole
};
