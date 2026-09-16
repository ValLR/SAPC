// Controlador de Autenticación - US-01 (SCRUM-9)
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Usuario mock con hash real de bcrypt para "Password2026!"
const MOCK_USER = {
  id_usuario: 1,
  rut: "12345678-9",
  nombre: "Admin",
  apellido: "Chawal",
  email: "admin@chawal.cl",
  // Hash generado: await bcrypt.hash("Password2026!", 10)
  password_hash: "$2b$10$8K.3VZ.7E.K7v5J5Y.JxN.xYV3zv.v.v.v.v.v.v.v.v.v.v.v.v.v",
  rol: "ADMINISTRADOR"
};

// Generar hash real al inicializar (para desarrollo)
const initializeMockUser = async () => {
  try {
    const hashedPassword = await bcrypt.hash("Password2026!", 10);
    MOCK_USER.password_hash = hashedPassword;
    console.log("Hash de contraseña mock generado correctamente");
  } catch (error) {
    console.error("Error generando hash mock:", error);
  }
};

// Inicializar al cargar el módulo
initializeMockUser();

/**
 * POST /api/auth/login
 * Autenticación de usuario con JWT y validación bcrypt
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

    // Validar email existe
    if (email !== MOCK_USER.email) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
        error: "INVALID_CREDENTIALS"
      });
    }

    // Validar contraseña con bcrypt.compare() - Validación criptográfica real
    const isPasswordValid = await bcrypt.compare(password, MOCK_USER.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
        error: "INVALID_CREDENTIALS"
      });
    }

    // Generar JWT Token
    const tokenPayload = {
      user_id: MOCK_USER.id_usuario,
      rol: MOCK_USER.rol,
      email: MOCK_USER.email
    };

    const token = jwt.sign(
      tokenPayload, 
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        issuer: 'SAPC-Chawal-API'
      }
    );

    // Respuesta exitosa con token y datos del usuario (sin hash)
    return res.status(200).json({
      success: true,
      message: "Autenticación exitosa",
      token,
      user: {
        id_usuario: MOCK_USER.id_usuario,
        rut: MOCK_USER.rut,
        nombre: MOCK_USER.nombre,
        apellido: MOCK_USER.apellido,
        email: MOCK_USER.email,
        rol: MOCK_USER.rol
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