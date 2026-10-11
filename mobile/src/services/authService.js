import { API_BASE_URL } from './apiConfig';

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // Timeout de 6 segundos

    try {
      const targetUrl = `${API_BASE_URL}/auth/login`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
if (process.env.NODE_ENV !== 'test') {
  console.error('Error en authService.login:', error);
}

      let message =
        'No se pudo establecer conexión con el servidor SAPC. Verifica tu red o el estado del servidor backend.';

      if (error.name === 'AbortError') {
        message =
          'El servidor tardó demasiado en responder. Por favor, verifica tu conexión e inténtalo nuevamente.';
      }

      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: message,
      };
    }
  },
};

export default authService;
