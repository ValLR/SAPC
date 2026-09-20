/**
 * Servicio de Gestión de Profesionales / Terapeutas - US-14 / US-13
 * Conexión con endpoints REST de SAPC Backend Node.js / Express
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Helper para obtener las cabeceras HTTP con token de sesión
 */
const getAuthHeaders = () => {
  let token = '';
  try {
    const savedSession = localStorage.getItem('sapc_web_admin_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      token = parsed.token || '';
    }
  } catch (err) {
    console.error('Error al obtener token de localStorage:', err);
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const profesionalesService = {
  /**
   * Obtiene la lista completa de terapeutas
   * GET /api/terapeutas
   */
  async getProfesionales() {
    try {
      const response = await fetch(`${API_BASE_URL}/terapeutas`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Error al obtener la lista de profesionales',
          data: [],
        };
      }

      return {
        success: true,
        data: data.data || [],
        count: data.count || 0,
      };
    } catch (err) {
      console.error('Error en getProfesionales:', err);
      return {
        success: false,
        message: 'No se pudo conectar con el servidor para obtener los profesionales',
        data: [],
      };
    }
  },

  /**
   * Obtiene el catálogo de especialidades clínicas
   * GET /api/especialidades
   */
  async getEspecialidades() {
    try {
      const response = await fetch(`${API_BASE_URL}/especialidades`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          data: [],
        };
      }

      return {
        success: true,
        data: data.data || [],
      };
    } catch (err) {
      console.error('Error en getEspecialidades:', err);
      return {
        success: false,
        data: [],
      };
    }
  },

  /**
   * Registra un nuevo especialista (Alta de Terapeuta) - Escenario 1 (201 Created)
   * POST /api/terapeutas
   */
  async crearProfesional(payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/terapeutas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'No se pudo registrar el profesional',
          error: data.error || 'CREATE_ERROR',
        };
      }

      return {
        success: true,
        message: data.message || 'Terapeuta creado correctamente',
        data: data.data,
      };
    } catch (err) {
      console.error('Error en crearProfesional:', err);
      return {
        success: false,
        message: 'Error de red al intentar registrar al profesional',
        error: 'NETWORK_ERROR',
      };
    }
  },

  /**
   * Edita los datos de un especialista existente - Escenario 2 (200 OK)
   * PUT /api/terapeutas/:id_profesional
   */
  async actualizarProfesional(idProfesional, payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/terapeutas/${idProfesional}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'No se pudo actualizar el profesional',
          error: data.error || 'UPDATE_ERROR',
        };
      }

      return {
        success: true,
        message: data.message || 'Terapeuta actualizado correctamente',
        data: data.data,
      };
    } catch (err) {
      console.error('Error en actualizarProfesional:', err);
      return {
        success: false,
        message: 'Error de red al intentar actualizar al profesional',
        error: 'NETWORK_ERROR',
      };
    }
  },
};

export default profesionalesService;
