import classesService from '../src/services/classesService';
import storageService from '../src/services/storageService';

jest.mock('../src/services/storageService');
global.fetch = jest.fn();

describe('classesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageService.getToken.mockResolvedValue('fake_jwt_token_123');
  });

  describe('getClasses()', () => {
    test('returns catalog data successfully on 200 OK', async () => {
      const mockClasses = [
        {
          id_class: 1,
          title: 'Taller de Yoga Hatha',
          instructor: 'Camila Rojas',
          max_capacity: 15,
          available_slots: 5,
          class_date: '2026-09-22',
          start_time: '18:00:00',
          end_time: '19:15:00',
          category: 'Yoga',
        },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 1, data: mockClasses }),
      });

      const res = await classesService.getClasses();

      expect(res.success).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0].title).toBe('Taller de Yoga Hatha');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('handles server error gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal server error' }),
      });

      const res = await classesService.getClasses();

      expect(res.success).toBe(false);
      expect(res.message).toBe('Internal server error');
    });

    test('handles network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

      const res = await classesService.getClasses();

      expect(res.success).toBe(false);
      expect(res.error).toBe('NETWORK_ERROR');
    });
  });

  describe('reserveClass()', () => {
    test('reserves class successfully on 200 OK', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Inscripción realizada con éxito',
          data: { id_class: 1, title: 'Taller de Yoga Hatha', available_slots: 4 },
        }),
      });

      const res = await classesService.reserveClass(1);

      expect(res.success).toBe(true);
      expect(res.data.available_slots).toBe(4);
    });

    test('returns CLASS_FULL when 409 conflict occurs', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          message: 'La clase alcanzó su límite de capacidad (Aforo Completo)',
          error: 'CLASS_FULL',
        }),
      });

      const res = await classesService.reserveClass(2);

      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
      expect(res.error).toBe('CLASS_FULL');
    });
  });
});
