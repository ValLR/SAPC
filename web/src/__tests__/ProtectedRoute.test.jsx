import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../routes/ProtectedRoute';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext');

describe('ProtectedRoute - Web Guard', () => {
  it('muestra spinner cuando AuthContext está cargando', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Dashboard Protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Cargando portal...')).toBeInTheDocument();
  });

  it('redirige a /login cuando el usuario NO está autenticado (Escenario 1)', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
          <Route path="/login" element={<div>Pantalla de Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Pantalla de Login')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Protegido')).not.toBeInTheDocument();
  });

  it('permite el acceso al contenido a través del Outlet cuando el usuario SÍ está autenticado', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Protegido')).toBeInTheDocument();
  });
});
