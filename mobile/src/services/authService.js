import { Platform } from 'react-native';

// URL base de la API backend (Node.js + Express)
// Se puede configurar con la variable EXPO_PUBLIC_API_URL en .env
// En emulador Android, localhost apunta a 10.0.2.2; en web e iOS a localhost.
const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  default: 'http://localhost:3000/api',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

/**
 * Cliente HTTP y Servicio de Autenticación para la API SAPC Chawal
 */
export const authService = {
  /**
   * Petición de Inicio de Sesión
   * Endpoint: POST /api/auth/login
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, token?: string, user?: Object, message?: string, error?: string}>}
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: data.error || 'AUTH_ERROR',
          message:
            data.message ||
            'El correo o la contraseña ingresada no son correctos. Por favor, verifica tus datos e inténtalo nuevamente.',
        };
      }

      return {
        success: true,
        status: response.status,
        token: data.token,
        user: data.user,
        message: data.message || 'Autenticación exitosa',
      };
    } catch (error) {
      console.error('Error de red en authService.login:', error);
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message:
          'No se pudo establecer conexión con el servidor SAPC. Verifica tu red o el estado del servidor backend.',
      };
    }
  },
};

export default authService;
