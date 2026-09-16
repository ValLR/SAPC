import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sapc_web_admin_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restauración de sesión mock desde localStorage al recargar la página
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        const parsedUser = JSON.parse(savedSession);
        setUser(parsedUser);
      }
    } catch (err) {
      console.error('Error cargando sesión previa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Función mock de login
   * @param {string} email
   * @param {string} password
   * @param {'Administrador' | 'Terapeuta'} [selectedRole='Administrador']
   */
  const login = async (email, password, selectedRole = 'Administrador') => {
    // Simulación de respuesta exitosa
    const userData = {
      name: selectedRole === 'Administrador' ? 'Administrador Chawal' : 'Terapeuta Chawal',
      email,
      role: selectedRole,
      token: 'jwt_mock_token_sapc_' + Date.now(),
    };

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    return userData;
  };

  /**
   * Cierre de sesión y limpieza de credenciales (Escenario 2)
   */
  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    role: user?.role || null,
    isLoading,
    login,
    logout,
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
