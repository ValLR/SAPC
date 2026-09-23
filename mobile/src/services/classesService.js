import Constants from 'expo-constants';
import storageService from './storageService';

const getBackendHost = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000/api`;
  }
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getBackendHost();

export const classesService = {
  /**
   * GET /api/classes
   */
  async getClasses() {
    try {
      const token = await storageService.getToken();
      const response = await fetch(`${API_BASE_URL}/classes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          status: response.status,
          message: data.message || 'Error al obtener el catálogo de clases',
          error: data.error || 'FETCH_ERROR',
          data: [],
        };
      }

      return {
        success: true,
        data: data.data || [],
        count: data.count || 0,
      };
    } catch (err) {
      console.error('Error en classesService.getClasses:', err);
      return {
        success: false,
        message: 'No se pudo conectar con el servidor para obtener las clases',
        error: 'NETWORK_ERROR',
        data: [],
      };
    }
  },

  /**
   * POST /api/classes/:idClass/reserve
   */
  async reserveClass(idClass) {
    try {
      const token = await storageService.getToken();
      const response = await fetch(`${API_BASE_URL}/classes/${idClass}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          status: response.status,
          message: data.message || 'La clase no cuenta con aforo disponible',
          error: data.error || 'RESERVE_ERROR',
        };
      }

      return {
        success: true,
        message: data.message || 'Inscripción realizada con éxito',
        data: data.data,
      };
    } catch (err) {
      console.error('Error en classesService.reserveClass:', err);
      return {
        success: false,
        message: 'Error de red al intentar procesar la inscripción',
        error: 'NETWORK_ERROR',
      };
    }
  },
};

export default classesService;
