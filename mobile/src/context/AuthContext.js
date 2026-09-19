import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';
import storageService from '../services/storageService';

const AuthContext = createContext({
  user: null,
  token: null,
  isLoading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
  clearError: () => {},
});

/**
 * Proveedor de AuthContext
 * Administra el estado global de la sesión del usuario, token JWT,
 * persistencia en SecureStore y auto-login al arrancar la app.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Solo para la verificación inicial al arrancar
  const [error, setError] = useState(null);

  // Auto-login al montar el componente (Verifica JWT guardado)
  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = async () => {
    try {
      setIsLoading(true);
      const savedToken = await storageService.getToken();
      const savedUser = await storageService.getUser();

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
      }
    } catch (err) {
      console.error('Error durante la verificación de sesión inicial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Proceso de Inicio de Sesión
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  const login = async (email, password) => {
    setError(null);

    const result = await authService.login(email, password);

    if (result.success) {
      setUser(result.user);
      setToken(result.token);

      await storageService.saveToken(result.token);
      await storageService.saveUser(result.user);

      return { success: true, message: result.message };
    } else {
      setError(result.message);
      return {
        success: false,
        error: result.error,
        message: result.message,
      };
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    await storageService.clearSession();
    setUser(null);
    setToken(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para consumir el contexto de autenticación
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
