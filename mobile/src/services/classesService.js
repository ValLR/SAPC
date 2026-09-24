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

/**
 * Normalizes raw API response objects into standard ClassItem data contract.
 */
export const normalizeClassItem = (item = {}) => ({
  id_class: Number(item.id_class ?? item.id_clase ?? 0),
  title: item.title || item.nombre_actividad || 'Taller Grupal',
  description: item.description || item.descripcion || '',
  instructor: item.instructor || 'Profesional SAPC',
  available_slots: Number(item.available_slots ?? item.cupos_disponibles ?? 0),
  max_capacity: Number(item.max_capacity ?? item.aforo_maximo ?? 0),
  class_date: item.class_date || item.fecha_clase || '',
  start_time: item.start_time || item.hora_inicio || '',
  end_time: item.end_time || item.hora_fin || '',
  location: item.location || item.ubicacion || 'Sala 1',
  category: item.category || item.categoria || 'Todos',
});

export const classesService = {
  /**
   * GET /api/classes
   * Retrieves group classes catalog and normalizes capacity data contract.
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

      const rawItems = Array.isArray(data.data) ? data.data : [];
      const normalizedItems = rawItems.map(normalizeClassItem);

      return {
        success: true,
        data: normalizedItems,
        count: normalizedItems.length,
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
   * Sends class enrollment request and returns updated slot status.
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
