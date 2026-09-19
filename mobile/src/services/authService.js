import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Obtiene la IP local del servidor de desarrollo Metro en Expo
 * Esto permite que dispositivos físicos (celulares) escaneando el código QR
 * puedan conectarse al backend en el puerto 3000 automáticamente.
 */
const getHostIp = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(':')[0]; // Devuelve la IP real de tu PC en la red local (ej: 192.168.1.127)
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEFAULT_API_URL = `http://${getHostIp()}:3000/api`;
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
          email: email.trim(),
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
      console.error('Error en authService.login:', error);

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
