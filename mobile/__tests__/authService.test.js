import authService from '../src/services/authService';

// Mock del objeto global fetch
global.fetch = jest.fn();

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login() retorna success: true y token cuando las credenciales son válidas (200 OK)', async () => {
    const mockSuccessResponse = {
      success: true,
      message: 'Autenticación exitosa',
      token: 'jwt_token_mock_abcdef',
      user: {
        id_usuario: 1,
        rut: '12345678-9',
        nombre: 'Admin',
        apellido: 'Chawal',
        email: 'admin@chawal.cl',
        rol: 'ADMINISTRADOR',
      },
      expires_in: '8h',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const result = await authService.login('admin@chawal.cl', 'Password2026!');

    expect(result.success).toBe(true);
    expect(result.token).toBe('jwt_token_mock_abcdef');
    expect(result.user.email).toBe('admin@chawal.cl');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('login() retorna success: false con error INVALID_CREDENTIALS cuando la contraseña o email es incorrecto (401)', async () => {
    const mockErrorResponse = {
      success: false,
      message: 'Credenciales incorrectas',
      error: 'INVALID_CREDENTIALS',
    };

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => mockErrorResponse,
    });

    const result = await authService.login('admin@chawal.cl', 'ClaveInvalida');

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe('INVALID_CREDENTIALS');
    expect(result.message).toContain('Credenciales incorrectas');
  });

  test('login() gestiona errores de red o servidor no disponible (NETWORK_ERROR)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Failed to connect'));

    const result = await authService.login('admin@chawal.cl', 'Password2026!');

    expect(result.success).toBe(false);
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.message).toContain('No se pudo establecer conexión');
  });
});
