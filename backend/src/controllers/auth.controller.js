// Controlador de Autenticación
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * POST /api/auth/login
 * Autenticación de usuario con JWT y validación bcrypt contra MySQL
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que email y password estén presentes
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email y contraseña son requeridos",
        error: "MISSING_CREDENTIALS"
      });
    }

    // Buscar usuario por email (JOIN con roles para obtener el nombre del rol)
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.rut, u.nombre, u.apellido, u.email,
              u.password_hash, u.estado, r.nombre_rol AS rol
         FROM usuarios u
         JOIN roles    r ON r.id_rol = u.id_rol
        WHERE u.email = ?
        LIMIT 1`,
      [email]
    );

    // Email inexistente -> misma respuesta que password incorrecta
    // (no se revela si el email existe o no)
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
        error: "INVALID_CREDENTIALS"
      });
    }

    const user = rows[0];

    // Validar contraseña con bcrypt.compare() - Validación criptográfica real
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
        error: "INVALID_CREDENTIALS"
      });
    }

    // Validar que la cuenta esté activa
    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({
        success: false,
        message: "La cuenta no está activa",
        error: "ACCOUNT_NOT_ACTIVE"
      });
    }

    // Generar JWT Token
    const tokenPayload = {
      user_id: user.id_usuario,
      rol: user.rol,
      email: user.email
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        issuer: 'SAPC-Chawal-API'
      }
    );

    // Actualizar último acceso (best-effort: no bloquea la respuesta)
    pool.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?',
      [user.id_usuario]
    ).catch(() => {});

    // Respuesta exitosa con token y datos del usuario (sin hash)
    return res.status(200).json({
      success: true,
      message: "Autenticación exitosa",
      token,
      user: {
        id_usuario: user.id_usuario,
        rut: user.rut,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol
      },
      expires_in: process.env.JWT_EXPIRES_IN || '8h'
    });

  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "INTERNAL_SERVER_ERROR"
    });
  }
};

module.exports = {
  login
};