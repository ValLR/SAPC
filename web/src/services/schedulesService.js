const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('sapc_token');

export const schedulesService = {
  /**
   * GET /api/schedules
   */
  async getSchedules(therapistId) {
    try {
      const token = getAuthToken();
      const queryParam = therapistId ? `?therapistId=${therapistId}` : '';
      const response = await fetch(`${API_BASE_URL}/schedules${queryParam}`, {
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
          message: data.message || 'Error al obtener la configuración de agendas',
          error: data.error || 'FETCH_ERROR',
        };
      }

      return {
        success: true,
        therapistId: data.therapistId,
        therapists: data.therapists || [],
        data: data.data || [],
      };
    } catch (err) {
      console.error('Error in schedulesService.getSchedules:', err);
      return {
        success: false,
        message: 'No se pudo conectar con el servidor',
        error: 'NETWORK_ERROR',
      };
    }
  },

  /**
   * POST /api/schedules/publish
   */
  async publishSchedule(payload) {
    try {
      const token = getAuthToken();

      // Client-side validation: Check time range before sending
      if (payload.start_time && payload.end_time) {
        const startMins = parseTimeToMinutes(payload.start_time);
        const endMins = parseTimeToMinutes(payload.end_time);

        if (isNaN(startMins) || isNaN(endMins) || endMins <= startMins) {
          return {
            success: false,
            message: 'La hora de término debe ser estrictamente posterior a la hora de inicio',
            error: 'INVALID_TIME_RANGE',
          };
        }
      }

      const response = await fetch(`${API_BASE_URL}/schedules/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          status: response.status,
          message: data.message || 'Error al publicar los bloques horarios',
          error: data.error || 'PUBLISH_ERROR',
        };
      }

      return {
        success: true,
        message: data.message || 'Jornada y disponibilidad publicadas con éxito',
        data: data.data,
      };
    } catch (err) {
      console.error('Error in schedulesService.publishSchedule:', err);
      return {
        success: false,
        message: 'Error de red al intentar publicar los horarios',
        error: 'NETWORK_ERROR',
      };
    }
  },
};

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return NaN;
  const parts = timeStr.split(':');
  if (parts.length < 2) return NaN;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export default schedulesService;
