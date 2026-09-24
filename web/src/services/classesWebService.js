/**
 * Servicio de Clases Grupales y Monitoreo de Aforo (Portal Web Admin)
 * Conexión a la REST API Node.js / Express — US-11 / US-12
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('sapc_token');

/**
 * Calcula las métricas de ocupación para la UI web.
 * - alumnosInscritos = aforo_maximo - cupos_disponibles (o inscripciones_activas)
 * - porcentajeOcupacion = Math.round((alumnosInscritos / aforo_maximo) * 100)
 */
export const calculateOccupancyMetrics = (clase = {}) => {
  const maxCapacity = Number(clase.aforo_maximo ?? clase.max_capacity ?? 0);
  const availableSlots = Number(clase.cupos_disponibles ?? clase.available_slots ?? 0);
  const rawActiveEnrollments = clase.inscripciones_activas;

  const enrolledStudents =
    rawActiveEnrollments !== undefined && rawActiveEnrollments !== null
      ? Number(rawActiveEnrollments)
      : Math.max(0, maxCapacity - availableSlots);

  const occupancyPercentage =
    maxCapacity > 0 ? Math.min(100, Math.round((enrolledStudents / maxCapacity) * 100)) : 0;

  const isFull = availableSlots === 0 || occupancyPercentage >= 100;

  return {
    enrolledStudents,
    occupancyPercentage,
    isFull,
  };
};

/**
 * Normaliza los objetos provenientes del backend a un contrato estándar para la UI Web.
 */
export const normalizeWebClassItem = (item = {}) => {
  const { enrolledStudents, occupancyPercentage, isFull } = calculateOccupancyMetrics(item);

  return {
    id_clase: Number(item.id_clase ?? item.id_class ?? 0),
    nombre_actividad: item.nombre_actividad || item.title || 'Taller Grupal',
    id_instructor: Number(item.id_instructor ?? 0),
    instructor: item.instructor || 'Profesional SAPC',
    sala: item.sala || item.location || 'Sala 1',
    aforo_maximo: Number(item.aforo_maximo ?? item.max_capacity ?? 0),
    cupos_disponibles: Number(item.cupos_disponibles ?? item.available_slots ?? 0),
    inscripciones_activas: enrolledStudents,
    porcentaje_ocupacion: occupancyPercentage,
    is_full: isFull,
    fecha_clase: item.fecha_clase || item.class_date || '',
    hora_inicio: item.hora_inicio || item.start_time || '',
    hora_fin: item.hora_fin || item.end_time || '',
    estado_clase: item.estado_clase || item.status || 'PROGRAMADA',
  };
};

export const classesWebService = {
  /**
   * GET /api/clases
   * Obtiene la lista de clases grupales y calcula métricas de ocupación.
   */
  async fetchClasses(filters = {}) {
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams();

      if (filters.estado) queryParams.append('estado', filters.estado);
      if (filters.sala) queryParams.append('sala', filters.sala);
      if (filters.id_instructor) queryParams.append('id_instructor', filters.id_instructor);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await fetch(`${API_BASE_URL}/clases${queryString}`, {
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
          message: data.message || 'Error al obtener la lista de talleres',
          error: data.error || 'FETCH_ERROR',
          data: [],
        };
      }

      const rawList = Array.isArray(data.data) ? data.data : [];
      const normalizedList = rawList.map(normalizeWebClassItem);

      return {
        success: true,
        count: normalizedList.length,
        data: normalizedList,
      };
    } catch (err) {
      console.error('Error en classesWebService.fetchClasses:', err);
      return {
        success: false,
        message: 'No se pudo conectar con el servidor para obtener los talleres',
        error: 'NETWORK_ERROR',
        data: [],
      };
    }
  },

  /**
   * POST /api/clases
   * Registra un nuevo taller grupal con sala y aforo máximo (Solo ADMINISTRADOR).
   */
  async createClass(payload) {
    try {
      const token = getAuthToken();

      // Validación defensiva cliente
      if (!payload.nombre_actividad || !payload.id_instructor || !payload.sala || !payload.aforo_maximo) {
        return {
          success: false,
          message: 'Todos los campos obligatorios del taller deben estar completos',
          error: 'VALIDATION_ERROR',
        };
      }

      if (Number(payload.aforo_maximo) <= 0) {
        return {
          success: false,
          message: 'El aforo máximo debe ser mayor a 0',
          error: 'INVALID_CAPACITY',
        };
      }

      const response = await fetch(`${API_BASE_URL}/clases`, {
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
          message: data.message || 'Error al crear el taller grupal',
          error: data.error || 'CREATE_ERROR',
        };
      }

      return {
        success: true,
        message: data.message || 'Taller registrado y sala asignada con éxito',
        data: data.data ? normalizeWebClassItem(data.data) : null,
      };
    } catch (err) {
      console.error('Error en classesWebService.createClass:', err);
      return {
        success: false,
        message: 'Error de red al intentar registrar la clase grupal',
        error: 'NETWORK_ERROR',
      };
    }
  },
};

export default classesWebService;
