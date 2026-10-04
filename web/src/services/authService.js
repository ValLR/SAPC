/**
 * Servicio de Autenticación para Portal Web Administrativo
 * Conexión directa al backend REST API Node.js / Express
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const authService = {
  /**
   * Petición de Inicio de Sesión
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, token?: string, user?: object, message?: string, error?: string}>}
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Credenciales incorrectas o error en el servidor.',
          error: data.error || 'AUTH_ERROR',
        };
      }

      // Normalizar nombre del rol para mantener compatibilidad con el frontend
      const rawRol = data.user?.rol || 'ADMINISTRADOR';
      const roleNormalized =
        rawRol.toUpperCase() === 'TERAPEUTA' ? 'Terapeuta' : 'Administrador';

      const userNormalized = {
        id: data.user?.id_usuario,
        rut: data.user?.rut,
        name: `${data.user?.nombre || ''} ${data.user?.apellido || ''}`.trim() || 'Usuario SAPC',
        email: data.user?.email,
        role: roleNormalized,
        rawRol,
      };

      return {
        success: true,
        token: data.token,
        user: userNormalized,
        message: data.message,
      };
    } catch (err) {
      console.error('Error en authService.login:', err);
      return {
        success: false,
        message: 'No se pudo conectar con el servidor SAPC. Revisa tu conexión a internet o el backend.',
        error: 'NETWORK_ERROR',
      };
    }
  },
};

export default authService;
