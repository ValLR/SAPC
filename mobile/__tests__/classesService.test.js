import { classesService, normalizeClassItem } from '../src/services/classesService';
import storageService from '../src/services/storageService';

jest.mock('../src/services/storageService', () => ({
  getToken: jest.fn(),
}));

global.fetch = jest.fn();

describe('classesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageService.getToken.mockResolvedValue('fake-jwt-token');
  });

  describe('normalizeClassItem() Data Contract', () => {
    it('normalizes raw database fields to standardized ClassItem', () => {
      const raw = {
        id_clase: 10,
        nombre_actividad: 'Yoga Restaurativo',
        descripcion: 'Taller de relajación profunda',
        instructor: 'Dra. María Paz',
        cupos_disponibles: 5,
        aforo_maximo: 15,
        fecha_clase: '2026-09-25',
        hora_inicio: '10:00:00',
        hora_fin: '11:15:00',
        ubicacion: 'Sala A',
        categoria: 'Yoga',
      };

      const normalized = normalizeClassItem(raw);

      expect(normalized).toEqual({
        id_class: 10,
        title: 'Yoga Restaurativo',
        description: 'Taller de relajación profunda',
        instructor: 'Dra. María Paz',
        available_slots: 5,
        max_capacity: 15,
        class_date: '2026-09-25',
        start_time: '10:00:00',
        end_time: '11:15:00',
        location: 'Sala A',
        category: 'Yoga',
      });
    });

    it('provides safe fallback defaults for missing or null properties', () => {
      const normalized = normalizeClassItem({});

      expect(normalized).toEqual({
        id_class: 0,
        title: 'Taller Grupal',
        description: '',
        instructor: 'Profesional SAPC',
        available_slots: 0,
        max_capacity: 0,
        class_date: '',
        start_time: '',
        end_time: '',
        location: 'Sala 1',
        category: 'Todos',
      });
    });
  });

  describe('getClasses() REST API integration', () => {
    it('fetches class catalog and returns normalized array', async () => {
      const mockApiResponse = {
        success: true,
        count: 1,
        data: [
          {
            id_clase: 1,
            nombre_actividad: 'Pilates Reformer',
            instructor: 'Carlos Soto',
            cupos_disponibles: 3,
            aforo_maximo: 8,
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const res = await classesService.getClasses();

      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.data[0].id_class).toBe(1);
      expect(res.data[0].available_slots).toBe(3);
    });

    it('handles network error gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network request failed'));

      const res = await classesService.getClasses();

      expect(res.success).toBe(false);
      expect(res.error).toBe('NETWORK_ERROR');
      expect(res.data).toEqual([]);
    });
  });

  describe('reserveClass() REST API integration', () => {
    it('sends reservation request and returns success payload', async () => {
      const mockReserveResponse = {
        success: true,
        message: 'Inscripción realizada con éxito',
        data: { id_class: 1, status: 'CONFIRMED' },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReserveResponse,
      });

      const res = await classesService.reserveClass(1);

      expect(res.success).toBe(true);
      expect(res.message).toContain('Inscripción realizada');
    });

    it('returns error status 403 when user is not a patient', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: 'NOT_A_PATIENT',
          message: 'Solo los pacientes pueden inscribirse en una clase grupal',
        }),
      });

      const res = await classesService.reserveClass(1);

      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toBe('NOT_A_PATIENT');
    });

    it('returns error status 409 when class capacity is full', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: 'CLASS_FULL',
          message: 'La clase ya no cuenta con aforo disponible',
        }),
      });

      const res = await classesService.reserveClass(1);

      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
      expect(res.error).toBe('CLASS_FULL');
    });
  });
});
