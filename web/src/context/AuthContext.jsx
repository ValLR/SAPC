import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sapc_web_admin_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        const { user: savedUser, token: savedToken } = JSON.parse(savedSession);
        if (savedUser && savedToken) {
          setUser(savedUser);
          setToken(savedToken);
        }
      }
    } catch (err) {
      console.error('Error cargando sesión previa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Inicio de Sesión con Backend REST API
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  const login = async (email, password) => {
    setAuthError(null);

    // Llamado al servicio REST de backend
    const result = await authService.login(email, password);

    if (result.success) {
      const sessionData = {
        user: result.user,
        token: result.token,
      };

      setUser(sessionData.user);
      setToken(sessionData.token);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      } catch (e) {
        console.error('No se pudo guardar la sesión en localStorage:', e);
      }

      return { success: true, message: result.message };
    } else {
      setAuthError(result.message);
      return {
        success: false,
        message: result.message,
        error: result.error,
      };
    }
  };

  /**
   * Cierre de sesión y limpieza de credenciales
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('No se pudo eliminar la sesión de localStorage:', e);
    }
  };

  const clearError = () => {
    setAuthError(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    role: user?.role || null,
    isLoading,
    authError,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
