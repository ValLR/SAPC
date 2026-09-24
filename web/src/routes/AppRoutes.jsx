import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '../components/layout/AdminLayout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ProfesionalesPage from '../pages/ProfesionalesPage';
import ScheduleConfigPage from '../pages/ScheduleConfigPage';
import TalleresPage from '../pages/TalleresPage';
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

        {/* Rutas Protegidas por ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profesionales" element={<ProfesionalesPage />} />

            <Route path="/agendas" element={<ScheduleConfigPage />} />

            <Route path="/talleres" element={<TalleresPage />} />

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
