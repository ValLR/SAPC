import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Users,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { reportsWebService } from '../services/reportsWebService';
import './ReportesPage.css';

export const ReportesPage = () => {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    citas: { total: 0, vigentes: 0, canceladas: 0, no_asistio: 0, por_especialista: [], por_especialidad: [] },
    ocupacionClases: { global: { clases: 0, aforo_total: 0, inscritos_total: 0, porcentaje_ocupacion: 0 }, detalle: [] },
    rango: { desde: null, hasta: null },
    generadoEn: null,
  });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsWebService.getOccupancyReport(desde, hasta);
      if (res.success) {
        setReportData({
          citas: res.citas,
          ocupacionClases: res.ocupacionClases,
          rango: res.rango,
          generadoEn: res.generadoEn,
        });
      } else {
        setError(res.message || 'No fue posible cargar las métricas en este momento');
      }
    } catch (err) {
      console.error('Error al cargar reporte:', err);
      setError('Error de conexión al cargar la reportería');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRefresh = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleClearFilters = () => {
    setDesde('');
    setHasta('');
  };

  const { citas, ocupacionClases } = reportData;
  const globalOcupacion = ocupacionClases.global || {};

  return (
    <div className="reportes-container">
      {/* 1. Header principal */}
      <header className="reportes-header">
        <div>
          <div className="reportes-title-group">
            <BarChart3 className="reportes-title-icon" size={28} />
            <h1 className="reportes-title">Reportes y Métricas en Línea</h1>
          </div>
          <p className="reportes-subtitle">
            Demanda de atenciones individuales y nivel de ocupación de talleres comunitarios (US-17)
            {reportData.generadoEn && (
              <span className="reportes-timestamp">
                {' '}• Generado: {new Date(reportData.generadoEn).toLocaleString('es-CL')}
              </span>
            )}
          </p>
        </div>

        {/* 2. Barra de Filtros por Fecha */}
        <form className="reportes-filter-bar" onSubmit={handleRefresh}>
          <div className="filter-input-group">
            <label htmlFor="fecha-desde" className="filter-label">
              <Calendar size={14} /> Desde:
            </label>
            <input
              id="fecha-desde"
              type="date"
              className="filter-date-input"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="fecha-hasta" className="filter-label">
              <Calendar size={14} /> Hasta:
            </label>
            <input
              id="fecha-hasta"
              type="date"
              className="filter-date-input"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="reportes-btn-refresh"
            disabled={loading}
            title="Refrescar métricas"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>

          {(desde || hasta) && (
            <button
              type="button"
              className="reportes-btn-clear"
              onClick={handleClearFilters}
            >
              Limpiar
            </button>
          )}
        </form>
      </header>

      {/* 3. Mensaje de Error (RBAC o Servidor) */}
      {error && (
        <div className="reportes-error-banner">
          <AlertCircle size={22} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Loader o Contenido */}
      {loading ? (
        <div className="reportes-loading-state">
          <RefreshCw className="spin reportes-spinner" size={36} />
          <p>Cargando métricas consolidadas de la base de datos relacional...</p>
        </div>
      ) : (
        <>
          {/* 5. Tarjetas KPI Resumen */}
          <section className="reportes-kpi-grid">
            <div className="reportes-kpi-card card-primary">
              <div className="kpi-icon-wrapper icon-teal">
                <UserCheck size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Total Citas Agendadas</span>
                <div className="kpi-value">{citas.total}</div>
                <span className="kpi-subtext">
                  {citas.vigentes} vigentes • {citas.canceladas} canceladas
                </span>
              </div>
            </div>

            <div className="reportes-kpi-card card-secondary">
              <div className="kpi-icon-wrapper icon-orange">
                <Activity size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Ocupación Promedio Talleres</span>
                <div className="kpi-value">{globalOcupacion.porcentaje_ocupacion || 0}%</div>
                <span className="kpi-subtext">
                  {globalOcupacion.inscritos_total || 0} inscritos de {globalOcupacion.aforo_total || 0} cupos
                </span>
              </div>
            </div>


          </section>

          {/* 6. Grillas / Tablas de Métricas */}
          <div className="reportes-tables-grid">
            {/* TABLA 1: Demanda por Especialista */}
            <section className="reportes-card-table">
              <div className="table-card-header">
                <Users size={20} className="table-header-icon" />
                <h2>Volumen de Citas por Especialista</h2>
              </div>
              <p className="table-card-desc">
                Conteo acumulado de agendamientos directos y atenciones por profesional terapeuta.
              </p>

              <div className="table-responsive">
                <table className="reportes-table">
                  <thead>
                    <tr>
                      <th>Profesional / Especialista</th>
                      <th>Especialidad</th>
                      <th className="text-center">Total Citas</th>
                      <th className="text-center">Vigentes</th>
                      <th className="text-center">Canceladas / Ausente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.por_especialista && citas.por_especialista.length > 0 ? (
                      citas.por_especialista.map((esp) => (
                        <tr key={esp.id_profesional}>
                          <td className="font-semibold">{esp.especialista}</td>
                          <td>
                            <span className="badge-especialidad">{esp.especialidad}</span>
                          </td>
                          <td className="text-center font-bold">{esp.total_citas}</td>
                          <td className="text-center text-success">{esp.vigentes}</td>
                          <td className="text-center text-muted">
                            {esp.canceladas + esp.no_asistio}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty">
                          No se registraron citas médicas en el período seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 2: Ocupación y Demanda de Talleres */}
            <section className="reportes-card-table">
              <div className="table-card-header">
                <BarChart3 size={20} className="table-header-icon icon-orange-text" />
                <h2>Demanda y Ocupación de Talleres Colectivos</h2>
              </div>
              <p className="table-card-desc">
                Nivel de aforo alcanzado e inscritos activos en clases grupales comunitarias.
              </p>

              <div className="table-responsive">
                <table className="reportes-table">
                  <thead>
                    <tr>
                      <th>Taller / Actividad</th>
                      <th>Sala</th>
                      <th className="text-center">Aforo Máx.</th>
                      <th className="text-center">Inscritos</th>
                      <th>% Demanda / Ocupación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocupacionClases.detalle && ocupacionClases.detalle.length > 0 ? (
                      ocupacionClases.detalle.map((clase) => {
                        const pct = clase.porcentaje_ocupacion || 0;
                        const isFull = clase.completa || pct >= 100;
                        return (
                          <tr key={clase.id_clase}>
                            <td className="font-semibold">{clase.nombre_actividad}</td>
                            <td>{clase.sala}</td>
                            <td className="text-center">{clase.aforo_maximo}</td>
                            <td className="text-center font-bold">{clase.inscritos}</td>
                            <td>
                              <div className="occupancy-bar-wrapper">
                                <div className="occupancy-bar-track">
                                  <div
                                    className={`occupancy-bar-fill ${
                                      isFull ? 'fill-full' : pct >= 75 ? 'fill-high' : 'fill-normal'
                                    }`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className={`occupancy-pct ${isFull ? 'text-full' : ''}`}>
                                  {pct}% {isFull && '(Aforo Completo)'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty">
                          No se registraron actividades grupales en el período seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesPage;
