import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import './AdminLayout.css';

/**
 * Layout Contenedor Principal para Rutas Protegidas del Portal Administrativo
 */
export const AdminLayout = () => {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
