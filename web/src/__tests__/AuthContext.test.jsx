import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import authService from '../services/authService';

vi.mock('../services/authService');

describe('AuthContext - Web', () => {
  const STORAGE_KEY = 'sapc_web_admin_session';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  it('restaura la sesión desde localStorage al cargar', async () => {
    const mockSession = {
      user: { id: 1, name: 'Admin', role: 'Administrador' },
      token: 'jwt-saved-token',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSession));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockSession.user);
    expect(result.current.token).toBe('jwt-saved-token');
  });

  it('inicia sesión exitosamente y almacena credenciales en localStorage', async () => {
    authService.login.mockResolvedValueOnce({
      success: true,
      token: 'jwt-new-token',
      user: { id: 2, name: 'Terapeuta Juan', role: 'Terapeuta' },
      message: 'Autenticación exitosa',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res;
    await act(async () => {
      res = await result.current.login('juan@sapc.cl', 'secret');
    });

    expect(res.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('Terapeuta');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('jwt-new-token');
  });

  it('maneja errores de login sin guardar sesión', async () => {
    authService.login.mockResolvedValueOnce({
      success: false,
      message: 'Credenciales incorrectas',
      error: 'INVALID_CREDENTIALS',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res;
    await act(async () => {
      res = await result.current.login('wrong@sapc.cl', 'badpass');
    });

    expect(res.success).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.authError).toBe('Credenciales incorrectas');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('cierra sesión con logout() eliminando localStorage', async () => {
    const mockSession = {
      user: { id: 1, name: 'Admin' },
      token: 'jwt-token',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSession));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
