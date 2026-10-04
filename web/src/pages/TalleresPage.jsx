import React, { useState, useEffect } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale/es';
import { format, parse } from 'date-fns';
import classesWebService from '../services/classesWebService';
import profesionalesService from '../services/profesionalesService';
import { formatDateCL } from '../utils/formatters';
import './TalleresPage.css';

export const TalleresPage = () => {
  const [classes, setClasses] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    nombre_actividad: '',
    id_instructor: '',
    sala: 'Sala 1 - Multiuso',
    fecha_clase: '',
    hora_inicio: '10:00',
    hora_fin: '11:15',
    aforo_maximo: 10,
  });

  const [selectedDate, setSelectedDate] = useState(null);

  const salasDisponibles = [
    'Sala 1 - Multiuso',
    'Sala 2 - Acondicionamiento',
    'Sala 3 - Kinesiología y Rehabilitación',
    'Sala 4 - Terapia Corporal',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [classesRes, profRes] = await Promise.all([
      classesWebService.fetchClasses(),
      profesionalesService.getProfesionales(),
    ]);

    if (classesRes.success) {
      setClasses(classesRes.data);
    }
    if (profRes.success) {
      setProfesionales(profRes.data);
      if (profRes.data.length > 0 && !formData.id_instructor) {
        setFormData((prev) => ({
          ...prev,
          id_instructor: profRes.data[0].id_profesional || profRes.data[0].id || 1,
        }));
      }
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre_actividad.trim()) {
      showNotification('error', 'Debes ingresar el nombre del taller o actividad.');
      return;
    }
    if (!formData.id_instructor) {
      showNotification('error', 'Debes seleccionar un instructor a cargo.');
      return;
    }
    if (!formData.fecha_clase) {
      showNotification('error', 'Debes seleccionar la fecha en que se realizará la clase.');
      return;
    }
    if (Number(formData.aforo_maximo) <= 0) {
      showNotification('error', 'El aforo máximo debe ser mayor a 0.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      nombre_actividad: formData.nombre_actividad.trim(),
      id_instructor: Number(formData.id_instructor),
      sala: formData.sala,
      fecha_clase: formData.fecha_clase,
      hora_inicio: formData.hora_inicio.length === 5 ? `${formData.hora_inicio}:00` : formData.hora_inicio,
      hora_fin: formData.hora_fin.length === 5 ? `${formData.hora_fin}:00` : formData.hora_fin,
      aforo_maximo: Number(formData.aforo_maximo),
    };

    const res = await classesWebService.createClass(payload);

    setIsSubmitting(false);

    if (res.success) {
      showNotification('success', 'Clase registrada y sala asignada con éxito.');
      setFormData({
        nombre_actividad: '',
        id_instructor: profesionales.length > 0 ? (profesionales[0].id_profesional || 1) : '',
        sala: 'Sala 1 - Multiuso',
        fecha_clase: '',
        hora_inicio: '10:00',
        hora_fin: '11:15',
        aforo_maximo: 10,
      });
      setSelectedDate(null);
      await loadData();
    } else if (res.status === 409 || res.error === 'ROOM_CONFLICT') {
      showNotification(
        'error',
        res.message || 'Conflicto de horario: La sala ya se encuentra ocupada en ese bloque horario.'
      );
    } else {
      showNotification('error', res.message || 'Ocurrió un error al intentar crear el taller.');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <div className="talleres-container">
        {/* Header del Módulo */}
        <div className="talleres-header">
          <div>
            <h1 className="talleres-title">Talleres Grupales y Aforos</h1>
            <p className="talleres-subtitle">
              Módulo administrativo para la programación de clases, asignación de salas y monitoreo de aforo en tiempo real.
            </p>
          </div>
        </div>

        {/* Banner de Notificación con Iconos MUI */}
        {notification && (
          <div className={`notification-toast toast-${notification.type}`} role="alert">
            <span className="toast-icon">
              {notification.type === 'success' ? (
                <CheckCircleIcon fontSize="small" />
              ) : (
                <WarningIcon fontSize="small" />
              )}
            </span>
            <span className="toast-text">{notification.text}</span>
          </div>
        )}

        {/* Formulario de Alta de Clase / Taller */}
        <div className="card form-card">
          <h2 className="card-title">Programar Nuevo Taller Grupal</h2>
          <form onSubmit={handleSubmit} className="talleres-form">
            <div className="form-grid">
              <div className="form-group span-2">
                <label htmlFor="nombre_actividad" className="form-label">Nombre del Taller / Actividad *</label>
                <input
                  id="nombre_actividad"
                  type="text"
                  name="nombre_actividad"
                  className="form-control"
                  placeholder="Ej. Yoga Vinyasa, Pilates Postural, Fit-Dance"
                  value={formData.nombre_actividad}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="id_instructor" className="form-label">Instructor a Cargo *</label>
                <select
                  id="id_instructor"
                  name="id_instructor"
                  className="form-control"
                  value={formData.id_instructor}
                  onChange={handleInputChange}
                  required
                >
                  {profesionales.length === 0 && <option value="">No hay profesionales disponibles en BD</option>}
                  {profesionales.map((p) => (
                    <option key={p.id_profesional || p.id} value={p.id_profesional || p.id}>
                      {p.nombre} {p.apellido} ({p.especialidad || 'Especialista'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="sala" className="form-label">Sala Asignada *</label>
                <select
                  id="sala"
                  name="sala"
                  className="form-control"
                  value={formData.sala}
                  onChange={handleInputChange}
                  required
                >
                  {salasDisponibles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="fecha_clase" className="form-label">Fecha de la Clase *</label>
                <DatePicker
                  format="dd/MM/yyyy"
                  value={selectedDate}
                  onChange={(newDate) => {
                    setSelectedDate(newDate);
                    if (newDate && !isNaN(newDate)) {
                      const isoStr = format(newDate, 'yyyy-MM-dd');
                      setFormData((prev) => ({
                        ...prev,
                        fecha_clase: isoStr,
                      }));
                    } else {
                      setFormData((prev) => ({ ...prev, fecha_clase: '' }));
                    }
                  }}
                  slotProps={{
                    textField: {
                      id: 'fecha_clase',
                      name: 'fecha_clase',
                      className: 'mui-datepicker-field',
                      placeholder: 'dd/mm/yyyy',
                      required: true,
                    },
                  }}
                  slots={{
                    openPickerIcon: CalendarMonthIcon,
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hora_inicio" className="form-label">Hora Inicio *</label>
                <input
                  id="hora_inicio"
                  type="time"
                  name="hora_inicio"
                  className="form-control"
                  value={formData.hora_inicio}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="hora_fin" className="form-label">Hora Término *</label>
                <input
                  id="hora_fin"
                  type="time"
                  name="hora_fin"
                  className="form-control"
                  value={formData.hora_fin}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="aforo_maximo" className="form-label">Aforo Máximo (Capacidad Sala) *</label>
                <input
                  id="aforo_maximo"
                  type="number"
                  name="aforo_maximo"
                  min="1"
                  max="100"
                  className="form-control"
                  value={formData.aforo_maximo}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando Taller...' : 'Guardar y Publicar Taller'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de Monitoreo de Ocupación */}
        <div className="card table-card">
          <div className="table-card-header">
            <h2 className="card-title">Monitoreo de Aforo y Ocupación</h2>
            <button className="btn btn-secondary" onClick={loadData} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshIcon fontSize="small" />
              {loading ? 'Refrescando...' : 'Actualizar Lista'}
            </button>
          </div>

          {loading ? (
            <div className="table-loading">Cargando monitoreo de clases...</div>
          ) : classes.length === 0 ? (
            <div className="table-empty">No hay clases o talleres programados en el sistema.</div>
          ) : (
            <div className="table-responsive">
              <table className="talleres-table">
                <thead>
                  <tr>
                    <th>Taller</th>
                    <th>Instructor</th>
                    <th>Sala</th>
                    <th>Horario</th>
                    <th>Capacidad Total</th>
                    <th>Inscritos / Libres</th>
                    <th>% Ocupación</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls) => {
                    const { porcentaje_ocupacion, inscripciones_activas, cupos_disponibles, aforo_maximo, is_full } = cls;

                    return (
                      <tr key={cls.id_clase}>
                        <td>
                          <strong className="class-title-text">{cls.nombre_actividad}</strong>
                        </td>
                        <td>{cls.instructor}</td>
                        <td>
                          <span className="location-badge">{cls.sala}</span>
                        </td>
                        <td>
                          {formatDateCL(cls.fecha_clase)} <br />
                          <small className="time-subtext">
                            {cls.hora_inicio?.substring(0, 5)} - {cls.hora_fin?.substring(0, 5)} hrs
                          </small>
                        </td>
                        <td className="text-center">{aforo_maximo} alumnos</td>
                        <td className="text-center">
                          <span className="slots-text">
                            <strong>{inscripciones_activas}</strong> inscritos /{' '}
                            <span className={cupos_disponibles === 0 ? 'text-danger' : 'text-success'}>
                              {cupos_disponibles} libres
                            </span>
                          </span>
                        </td>
                        <td className="progress-cell">
                          <div className="progress-bar-container">
                            <div
                              className={`progress-bar-fill ${is_full ? 'fill-full' : 'fill-normal'}`}
                              style={{ width: `${porcentaje_ocupacion}%` }}
                            />
                          </div>
                          <span className="progress-percentage-text">{porcentaje_ocupacion}%</span>
                        </td>
                        <td>
                          <span className={`status-pill ${is_full ? 'pill-full' : 'pill-available'}`}>
                            {is_full ? 'Aforo Completo' : 'Con Cupos'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LocalizationProvider>
  );
};

export default TalleresPage;
