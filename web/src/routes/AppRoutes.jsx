import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '../components/layout/AdminLayout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import PlaceholderPage from '../pages/PlaceholderPage';

/**
 * Configuración del Enrutador Principal del Portal Web (React Router DOM)
 */
export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta Pública: Login Privado Administrativo */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas Protegidas por ProtectedRoute (Escenario 1) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route
              path="/profesionales"
              element={
                <PlaceholderPage
                  code="US-14"
                  title="Mantenedor de Profesionales y Terapeutas"
                  description="Módulo para gestión CRUD de datos personales, especialidades y acreditaciones de terapeutas del centro."
                />
              }
            />

            <Route
              path="/agendas"
              element={
                <PlaceholderPage
                  code="US-08"
                  title="Agendas y Horarios"
                  description="Módulo para configuración de jornadas laborales, bloques disponibles y asignación de pabellones/box de atención."
                />
              }
            />

            <Route
              path="/talleres"
              element={
                <PlaceholderPage
                  code="US-12"
                  title="Talleres Grupales y Aforos"
                  description="Módulo para la administración de clases grupales, control de listas de asistencia y límite de aforo por sala."
                />
              }
            />

            <Route
              path="/reportes"
              element={
                <PlaceholderPage
                  code="US-17"
                  title="Reportería y Métricas en Línea"
                  description="Módulo para generación de estadísticas de atención, volumen de agendamientos e indicadores financieros."
                />
              }
            />
          </Route>
        </Route>

        {/* Redirección por defecto */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
