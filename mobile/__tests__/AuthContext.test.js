import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import authService from '../src/services/authService';
import storageService from '../src/services/storageService';

jest.mock('../src/services/authService');
jest.mock('../src/services/storageService');

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  it('restaura sesión al montar si hay token y usuario guardados', async () => {
    storageService.getToken.mockResolvedValue('fake-token-123');
    storageService.getUser.mockResolvedValue({ id: 1, name: 'Test User' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.token).toBe('fake-token-123');
    expect(result.current.user).toEqual({ id: 1, name: 'Test User' });
  });

  it('maneja el login exitoso guardando la sesión', async () => {
    storageService.getToken.mockResolvedValue(null);
    storageService.getUser.mockResolvedValue(null);
    authService.login.mockResolvedValue({
      success: true,
      token: 'jwt-token-xyz',
      user: { id: 2, email: 'admin@sapc.cl' },
      message: 'Inicio de sesión exitoso',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res;
    await act(async () => {
      res = await result.current.login('admin@sapc.cl', 'pass123');
    });

    expect(res.success).toBe(true);
    expect(result.current.token).toBe('jwt-token-xyz');
    expect(result.current.user).toEqual({ id: 2, email: 'admin@sapc.cl' });
    expect(storageService.saveToken).toHaveBeenCalledWith('jwt-token-xyz');
    expect(storageService.saveUser).toHaveBeenCalledWith({ id: 2, email: 'admin@sapc.cl' });
  });

  it('maneja error en login adecuadamente sin romper isLoading', async () => {
    storageService.getToken.mockResolvedValue(null);
    storageService.getUser.mockResolvedValue(null);
    authService.login.mockResolvedValue({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res;
    await act(async () => {
      res = await result.current.login('wrong@sapc.cl', 'wrongpass');
    });

    expect(res.success).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Correo o contraseña incorrectos.');
  });

  it('cierra sesión con logout limpiando storage y estado', async () => {
    storageService.getToken.mockResolvedValue('token');
    storageService.getUser.mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(storageService.clearSession).toHaveBeenCalled();
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
