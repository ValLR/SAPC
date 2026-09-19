import React from 'react';
import { CalendarCheck, UserCheck, Users, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css';

/**
 * Pantalla Principal de Dashboard Ejecutivo (DashboardPage.jsx)
 * Réplica exacta de los componentes de las Imágenes 2 y 3.
 */
export const DashboardPage = () => {
  const { user } = useAuth();

  // Datos mock para las 3 Tarjetas KPI
  const kpiCards = [
    {
      title: 'Consultas del Día',
      value: '24',
      subtitle: 'Citas individuales agendadas',
      icon: CalendarCheck,
      color: 'var(--color-primary)',
    },
    {
      title: 'Terapeutas Activos',
      value: '8',
      subtitle: 'Profesionales en jornada',
      icon: UserCheck,
      color: 'var(--color-secondary)',
    },
    {
      title: 'Ocupación de Talleres',
      value: '85%',
      subtitle: 'Promedio de aforo semanal',
      icon: Users,
      color: '#3B82F6',
    },
  ];

  // Datos mock para la tabla "Próximas Citas Médicas"
  const proximasCitas = [
    { id: 1, hora: '09:00 AM', paciente: 'Camila Rojas', especialista: 'Dra. María Paz', estado: 'Confirmada' },
    { id: 2, hora: '10:30 AM', paciente: 'Lucas Sepúlveda', especialista: 'Ps. Alejandro Soto', estado: 'En Curso' },
    { id: 3, hora: '11:45 AM', paciente: 'Constanza Morales', especialista: 'Nut. Sofía Larraín', estado: 'Pendiente' },
    { id: 4, hora: '02:15 PM', paciente: 'Gabriel Silva', especialista: 'Dr. Rodrigo Fuenzalida', estado: 'Confirmada' },
  ];

  // Datos mock para la tabla "Estado de Aforos en Salas"
  const aforoSalas = [
    { id: 101, taller: 'Yogaterapia Grupal', horario: '10:00 - 11:30', disponibles: 3, total: 12 },
    { id: 102, taller: 'Mindfulness & Manejo de Estrés', horario: '12:00 - 13:00', disponibles: 1, total: 10 },
    { id: 103, taller: 'Taller de Expresión Corporal', horario: '15:30 - 17:00', disponibles: 5, total: 15 },
  ];

  return (
    <div className="dashboard-container">
      {/* 1. Header de la vista */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Bienvenido(a), <strong>{user?.name || 'Administrador'}</strong> — Resumen ejecutivo en tiempo real
          </p>
        </div>
      </header>

      {/* 2. Tarjetas de Métricas KPI Superiores */}
      <section className="kpi-grid">
        {kpiCards.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <div key={index} className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">{kpi.title}</span>
                <div className="kpi-icon-wrapper" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>
                  <IconComponent size={22} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <span className="kpi-subtitle">{kpi.subtitle}</span>
            </div>
          );
        })}
      </section>

      {/* 3. Sección Principal: Tablas Resumen */}
      <section className="dashboard-tables-grid">
        {/* Tabla 1: Próximas Citas */}
        <div className="table-card">
          <div className="table-card-header">
            <Clock size={18} className="table-header-icon" />
            <h2>Próximas Citas Médicas</h2>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Especialista</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {proximasCitas.map((cita) => (
                  <tr key={cita.id}>
                    <td className="font-semibold">{cita.hora}</td>
                    <td>{cita.paciente}</td>
                    <td>{cita.especialista}</td>
                    <td>
                      <span className={`badge-status status-${cita.estado.toLowerCase().replace(/\s+/g, '')}`}>
                        {cita.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla 2: Estado de Aforos en Salas */}
        <div className="table-card">
          <div className="table-card-header">
            <CheckCircle2 size={18} className="table-header-icon" />
            <h2>Estado de Aforos en Salas</h2>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Taller / Actividad</th>
                  <th>Horario</th>
                  <th>Cupos Disp.</th>
                  <th>Aforo Total</th>
                </tr>
              </thead>
              <tbody>
                {aforoSalas.map((sala) => (
                  <tr key={sala.id}>
                    <td className="font-semibold">{sala.taller}</td>
                    <td>{sala.horario}</td>
                    <td>
                      <span className="cupos-tag">{sala.disponibles} Libres</span>
                    </td>
                    <td>{sala.total} personas</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
