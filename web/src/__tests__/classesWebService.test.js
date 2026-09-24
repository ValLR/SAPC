import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classesWebService,
  calculateOccupancyMetrics,
  normalizeWebClassItem,
} from '../services/classesWebService';

describe('classesWebService & occupancy helpers (US-12)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('calculateOccupancyMetrics', () => {
    it('calcula correctamente el porcentaje y número de inscritos cuando hay cupos libres', () => {
      const metrics = calculateOccupancyMetrics({
        aforo_maximo: 10,
        cupos_disponibles: 4,
      });

      expect(metrics.enrolledStudents).toBe(6);
      expect(metrics.occupancyPercentage).toBe(60);
      expect(metrics.isFull).toBe(false);
    });

    it('identifica aforo completo cuando cupos_disponibles es 0', () => {
      const metrics = calculateOccupancyMetrics({
        aforo_maximo: 12,
        cupos_disponibles: 0,
      });

      expect(metrics.enrolledStudents).toBe(12);
      expect(metrics.occupancyPercentage).toBe(100);
      expect(metrics.isFull).toBe(true);
    });

    it('utiliza inscripciones_activas directamente si se proporciona', () => {
      const metrics = calculateOccupancyMetrics({
        aforo_maximo: 10,
        cupos_disponibles: 2,
        inscripciones_activas: 8,
      });

      expect(metrics.enrolledStudents).toBe(8);
      expect(metrics.occupancyPercentage).toBe(80);
      expect(metrics.isFull).toBe(false);
    });
  });

  describe('normalizeWebClassItem', () => {
    it('normaliza las propiedades y añade métricas de ocupación', () => {
      const raw = {
        id_clase: 5,
        nombre_actividad: 'Yoga Vinyasa',
        instructor: 'Camila Morales',
        sala: 'Sala 1 - Multiuso',
        aforo_maximo: 15,
        cupos_disponibles: 5,
        fecha_clase: '2026-10-25',
        hora_inicio: '10:00:00',
        hora_fin: '11:15:00',
        estado_clase: 'PROGRAMADA',
      };

      const normalized = normalizeWebClassItem(raw);

      expect(normalized.id_clase).toBe(5);
      expect(normalized.nombre_actividad).toBe('Yoga Vinyasa');
      expect(normalized.inscripciones_activas).toBe(10);
      expect(normalized.porcentaje_ocupacion).toBe(67);
      expect(normalized.is_full).toBe(false);
    });
  });

  describe('fetchClasses API call', () => {
    it('agrega la cabecera Authorization cuando el token existe', async () => {
      localStorage.setItem('sapc_token', 'mocked_admin_token');

      const mockResponse = {
        success: true,
        data: [
          {
            id_clase: 1,
            nombre_actividad: 'Pilates Reformer',
            aforo_maximo: 8,
            cupos_disponibles: 2,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await classesWebService.fetchClasses();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/clases'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mocked_admin_token',
          }),
        })
      );

      expect(res.success).toBe(true);
      expect(res.data[0].inscripciones_activas).toBe(6);
      expect(res.data[0].porcentaje_ocupacion).toBe(75);
    });
  });
});
