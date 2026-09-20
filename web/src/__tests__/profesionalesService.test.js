import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import profesionalesService from '../services/profesionalesService';

describe('profesionalesService - Web API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('obtiene la lista de profesionales correctamente (GET)', async () => {
    const mockResponse = {
      success: true,
      count: 1,
      data: [
        {
          id_profesional: 1,
          nombre: 'Camila',
          apellido: 'Rojas',
          rut: '11111111-1',
          especialidades: [{ id_especialidad: 1, nombre: 'Kinesiología', es_principal: true }],
        },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await profesionalesService.getProfesionales();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].nombre).toBe('Camila');
  });

  it('registra un nuevo profesional retornando 201 Created (Escenario 1)', async () => {
    const payload = {
      rut: '12345678-9',
      nombre: 'Nuevo',
      apellido: 'Terapeuta',
      email: 'nuevo@chawal.cl',
      password: 'Password2026!',
      numero_registro: 'RNPI-2026-100',
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: 'Terapeuta creado correctamente',
        data: { id_profesional: 10, ...payload },
      }),
    });

    const result = await profesionalesService.crearProfesional(payload);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Terapeuta creado correctamente');
    expect(result.data.id_profesional).toBe(10);
  });

  it('actualiza un profesional retornando 200 OK (Escenario 2)', async () => {
    const payload = {
      telefono: '+56999998888',
      titulo_profesional: 'Kinesióloga Senior',
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Terapeuta actualizado correctamente',
        data: { id_profesional: 1, ...payload },
      }),
    });

    const result = await profesionalesService.actualizarProfesional(1, payload);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Terapeuta actualizado correctamente');
  });

  it('maneja errores de duplicados HTTP 409 Conflict', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        message: 'Recurso duplicado',
        error: 'DUPLICATE_RESOURCE',
      }),
    });

    const result = await profesionalesService.crearProfesional({ rut: '11111111-1' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Recurso duplicado');
  });
});
