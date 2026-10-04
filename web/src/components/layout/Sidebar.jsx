import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  UsersRound,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoIcon from '../../assets/logo-icon.png';
import './Sidebar.css';

/**
 * Sidebar Izquierdo con fondo Verde Institucional (#1B7B75)
 * Réplica exacta del menú lateral visto en las imágenes 2 y 3.
 */
export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    // Escenario 2: Limpia la sesión y bloquea retorno navegando con replace: true
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Profesionales', path: '/profesionales', icon: Users },
    { label: 'Agendas y Horarios', path: '/agendas', icon: Calendar },
    { label: 'Talleres', path: '/talleres', icon: UsersRound },
    { label: 'Reportería', path: '/reportes', icon: BarChart3 },
  ];

  const roleLabel = user?.role || 'Administrador';
  const avatarLetter = roleLabel.charAt(0).toUpperCase(); // 'A' para Administrador, 'T' para Terapeuta
  const isTerapeuta = roleLabel === 'Terapeuta';

  return (
    <aside className="sidebar">
      {/* 1. Header con Logo Institucional */}
      <div className="sidebar-header">
        <img src={logoIcon} alt="Logo Chawal" className="sidebar-logo-img" />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">S.A.P.C. - Chawal</span>
          <span className="sidebar-brand-sub">Sistema de Gestión</span>
        </div>
      </div>

      <hr className="sidebar-divider" />

      {/* 2. Menú de Navegación */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} className="sidebar-icon" />
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* 3. Footer con Perfil y Cierre de Sesión (Wireframe 2 & 3) */}
      <div className="sidebar-footer">
        <hr className="sidebar-divider" />

        <div className="sidebar-user-info">
          <div
            className={`sidebar-avatar ${
              isTerapeuta ? 'avatar-terapeuta' : 'avatar-admin'
            }`}
          >
            {avatarLetter}
          </div>
          <span className="sidebar-role-text">{roleLabel}</span>
        </div>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
