import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guardián de Rutas Protegidas (Escenario 1)
 * Redirige forzosamente a /login si no existe una sesión activa.
 */
export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: 12, color: 'var(--color-text-secondary)' }}>Cargando portal...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Escenario 1: Redirección forzosa al login del portal administrativo
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const styles = {
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-bg-app)',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--color-border)',
    borderTop: '3px solid var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

export default ProtectedRoute;
