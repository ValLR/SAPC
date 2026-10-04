import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import authService from '../services/authService';

describe('authService - Web API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('procesa login exitoso y normaliza el rol ADMINISTRADOR', async () => {
    const mockApiResponse = {
      success: true,
      message: 'Autenticación exitosa',
      token: 'jwt-token-12345',
      user: {
        id_usuario: 1,
        rut: '12345678-9',
        nombre: 'Administrador',
        apellido: 'Chawal',
        email: 'admin@sapc.cl',
        rol: 'ADMINISTRADOR',
      },
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await authService.login('admin@sapc.cl', 'pass123');

    expect(result.success).toBe(true);
    expect(result.token).toBe('jwt-token-12345');
    expect(result.user.role).toBe('Administrador');
    expect(result.user.email).toBe('admin@sapc.cl');
  });

  it('normaliza el rol TERAPEUTA correctamente', async () => {
    const mockApiResponse = {
      success: true,
      message: 'Autenticación exitosa',
      token: 'jwt-token-tera',
      user: {
        id_usuario: 5,
        nombre: 'Dr. Roberto',
        apellido: 'Gómez',
        email: 'terapeuta@sapc.cl',
        rol: 'TERAPEUTA',
      },
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await authService.login('terapeuta@sapc.cl', 'pass123');

    expect(result.success).toBe(true);
    expect(result.user.role).toBe('Terapeuta');
  });

  it('retorna error cuando las credenciales son incorrectas (401)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        message: 'Credenciales incorrectas',
        error: 'INVALID_CREDENTIALS',
      }),
    });

    const result = await authService.login('err@sapc.cl', 'badpass');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Credenciales incorrectas');
    expect(result.error).toBe('INVALID_CREDENTIALS');
  });

  it('maneja fallas de red adecuadamente', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await authService.login('admin@sapc.cl', 'pass123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.message).toContain('No se pudo conectar con el servidor SAPC');
  });
});
