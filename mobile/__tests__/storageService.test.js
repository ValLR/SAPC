import storageService from '../src/services/storageService';
import * as SecureStore from 'expo-secure-store';

// Mock de expo-secure-store
jest.mock('expo-secure-store', () => {
  const store = {};
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    getItemAsync: jest.fn(async (key) => {
      return store[key] || null;
    }),
    deleteItemAsync: jest.fn(async (key) => {
      delete store[key];
    }),
  };
});

describe('storageService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await storageService.clearSession();
  });

  test('Guarda y recupera el token JWT correctamente', async () => {
    const mockToken = 'mock_jwt_token_12345';
    await storageService.saveToken(mockToken);

    const token = await storageService.getToken();
    expect(token).toBe(mockToken);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sapc_jwt_token', mockToken);
  });

  test('Elimina el token JWT al cerrar sesión', async () => {
    await storageService.saveToken('token_test');
    await storageService.removeToken();

    const token = await storageService.getToken();
    expect(token).toBeNull();
  });

  test('Guarda y recupera la información del usuario en JSON', async () => {
    const mockUser = {
      id_usuario: 1,
      rut: '12345678-9',
      nombre: 'Admin',
      apellido: 'Chawal',
      email: 'admin@chawal.cl',
      rol: 'ADMINISTRADOR',
    };

    await storageService.saveUser(mockUser);
    const user = await storageService.getUser();

    expect(user).toEqual(mockUser);
  });

  test('Limpia la sesión completa (Token y Usuario) con clearSession', async () => {
    await storageService.saveToken('some_token');
    await storageService.saveUser({ name: 'Test' });

    await storageService.clearSession();

    const token = await storageService.getToken();
    const user = await storageService.getUser();

    expect(token).toBeNull();
    expect(user).toBeNull();
  });
});
