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

  if (!token) {
    token = localStorage.getItem('sapc_token') || '';
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const reportsWebService = {
  /**
   * Obtiene métricas consolidadas de demanda y ocupación
   * GET /api/reportes/ocupacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   */
  async getOccupancyReport(desde = '', hasta = '') {
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const url = `${API_BASE_URL}/reportes/ocupacion${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            status: 401,
            message: 'Sesión expirada o no autorizada. Por favor inicie sesión nuevamente.',
            citas: null,
            ocupacionClases: null,
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            status: 403,
            message: 'Acceso denegado. Se requieren privilegios de Administrador (RBAC).',
            citas: null,
            ocupacionClases: null,
          };
        }
        return {
          success: false,
          status: response.status,
          message: data.message || 'Error al obtener el reporte de ocupación',
          citas: null,
          ocupacionClases: null,
        };
      }

      return {
        success: true,
        status: 200,
        message: data.message,
        generadoEn: data.generado_en,
        rango: data.rango,
        citas: data.citas || { total: 0, vigentes: 0, canceladas: 0, no_asistio: 0, por_especialista: [], por_especialidad: [] },
        ocupacionClases: data.ocupacion_clases || { global: { clases: 0, aforo_total: 0, inscritos_total: 0, porcentaje_ocupacion: 0 }, detalle: [] },
      };
    } catch (error) {
      console.error('Error de red en getOccupancyReport:', error);
      return {
        success: false,
        status: 500,
        message: 'No se pudo conectar con el servidor de reportes.',
        citas: null,
        ocupacionClases: null,
      };
    }
  },
};

export default reportsWebService;
