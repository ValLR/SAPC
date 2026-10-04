import { describe, it, expect, vi, beforeEach } from 'vitest';
import schedulesService from '../services/schedulesService';

global.fetch = vi.fn();

describe('schedulesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getSchedules()', () => {
    it('returns schedule data successfully on 200 OK', async () => {
      const mockData = {
        success: true,
        therapistId: 1,
        therapists: [{ id: 1, name: 'Dra. Camila Morales', specialty: 'Kinesiología' }],
        data: [{ id_block: 1, id_therapist: 1, day_of_week: 1, start_time: '09:00', end_time: '09:45' }],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const res = await schedulesService.getSchedules(1);

      expect(res.success).toBe(true);
      expect(res.therapistId).toBe(1);
      expect(res.data.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles server error gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal server error' }),
      });

      const res = await schedulesService.getSchedules(1);

      expect(res.success).toBe(false);
      expect(res.message).toBe('Internal server error');
    });

    it('handles network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const res = await schedulesService.getSchedules(1);

      expect(res.success).toBe(false);
      expect(res.error).toBe('NETWORK_ERROR');
    });
  });

  describe('publishSchedule()', () => {
    it('returns validation error client-side when end time is before start time', async () => {
      const invalidPayload = {
        therapist_id: 1,
        days: [1, 2, 3],
        start_time: '17:00',
        end_time: '09:00',
        slot_duration: 45,
      };

      const res = await schedulesService.publishSchedule(invalidPayload);

      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_TIME_RANGE');
      expect(res.message).toContain('posterior a la hora de inicio');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('publishes valid schedules successfully on 200 OK', async () => {
      const validPayload = {
        therapist_id: 1,
        days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00',
        slot_duration: 45,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          message: 'Jornada y disponibilidad publicadas con éxito',
          data: [],
        }),
      });

      const res = await schedulesService.publishSchedule(validPayload);

      expect(res.success).toBe(true);
      expect(res.message).toBe('Jornada y disponibilidad publicadas con éxito');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
