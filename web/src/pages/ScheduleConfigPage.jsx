import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import schedulesService from '../services/schedulesService';
import { ChevronLeft, ChevronRight, Lock, CalendarCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import './ScheduleConfigPage.css';

export const ScheduleConfigPage = () => {
  const { user } = useAuth();
  const isTerapeuta = user?.role === 'Terapeuta';

  const [therapists, setTherapists] = useState([
    { id: 1, name: 'Dra. Camila Morales', specialty: 'Kinesiología' },
    { id: 2, name: 'Lic. Matías Fuentes', specialty: 'Fonoaudiología' },
    { id: 3, name: 'Ps. Valentina Soto', specialty: 'Psicología' },
  ]);
  const [selectedTherapistId, setSelectedTherapistId] = useState(1);

  const [workingDays, setWorkingDays] = useState({
    1: true, // Lun
    2: true, // Mar
    3: true, // Mié
    4: true, // Jue
    5: true, // Vie
  });

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('45');

  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schedulesData, setSchedulesData] = useState([]);

  useEffect(() => {
    loadSchedules(selectedTherapistId);
  }, [selectedTherapistId]);

  const loadSchedules = async (therapistId) => {
    setIsLoading(true);
    const res = await schedulesService.getSchedules(therapistId);
    if (res.success) {
      if (res.therapists && res.therapists.length > 0) {
        setTherapists(res.therapists);
      }
      setSchedulesData(res.data);
    }
    setIsLoading(false);
  };

  const handleDayToggle = (dayNum) => {
    setWorkingDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  const handlePublishSchedule = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMessage('');

    // Client-side validation: Start time vs End time
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      setValidationError('Error de validación: La hora de término debe ser estrictamente posterior a la hora de inicio.');
      return;
    }

    const selectedDaysList = Object.keys(workingDays)
      .filter((day) => workingDays[day])
      .map(Number);

    if (selectedDaysList.length === 0) {
      setValidationError('Error de validación: Debe seleccionar al menos un día laboral.');
      return;
    }

    setIsLoading(true);

    const payload = {
      therapist_id: selectedTherapistId,
      days: selectedDaysList,
      start_time: startTime,
      end_time: endTime,
      slot_duration: Number(slotDuration),
    };

    const res = await schedulesService.publishSchedule(payload);
    setIsLoading(false);

    if (res.success) {
      setSuccessMessage('Jornada y disponibilidad horaria publicadas correctamente.');
      await loadSchedules(selectedTherapistId);
    } else {
      setValidationError(res.message || 'Error al guardar la disponibilidad horaria.');
    }
  };

  const timeSlotRows = [
    { label: '09:00 - 09:45', start: '09:00' },
    { label: '10:00 - 10:45', start: '10:00' },
    { label: '11:00 - 11:45', start: '11:00' },
    { label: '12:00 - 12:45', start: '12:00' },
    { label: '15:00 - 15:45', start: '15:00' },
    { label: '16:00 - 16:45', start: '16:00' },
  ];

  const [weekOffset, setWeekOffset] = useState(0);

  const getDaysHeader = () => {
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const baseStart = new Date(2026, 8, 21); // Lunes 21 de Septiembre, 2026
    return dayNames.map((name, index) => {
      const d = new Date(baseStart);
      d.setDate(baseStart.getDate() + weekOffset * 7 + index);
      return {
        dayNum: index + 1,
        name: `${name} ${d.getDate()}`,
      };
    });
  };

  const daysHeader = getDaysHeader();

  const getSlotStatus = (dayNum, startStr) => {
    if (!workingDays[dayNum]) return 'Libre';

    const match = schedulesData.find(
      (b) => b.day_of_week === dayNum && b.start_time?.substring(0, 5) === startStr
    );

    if (!match) {
      if (dayNum === 3 && startStr === '09:00') return 'Ocupado';
      if (dayNum === 3 && startStr === '10:00') return 'Ocupado';
      if (dayNum === 2 && startStr === '10:00') return 'Ocupado';
      if (dayNum === 4 && startStr === '10:00') return 'Bloqueado';
      return 'Disponible';
    }

    return 'Disponible';
  };

  const getWeekRangeLabel = () => {
    const baseStart = new Date(2026, 8, 21); // 21 de Septiembre, 2026
    const currentStart = new Date(baseStart);
    currentStart.setDate(baseStart.getDate() + weekOffset * 7);

    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6);

    const formatDay = (d) => d.getDate();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const startStr = `${formatDay(currentStart)}`;
    const endStr = `${formatDay(currentEnd)} de ${months[currentEnd.getMonth()]}, ${currentEnd.getFullYear()}`;

    if (currentStart.getMonth() === currentEnd.getMonth()) {
      return `Semana del ${startStr} al ${endStr}`;
    }
    return `Semana del ${startStr} de ${months[currentStart.getMonth()]} al ${endStr}`;
  };

  return (
    <div className="schedule-page-container">
      {/* Title section */}
      <div className="schedule-page-header">
        <h1 className="schedule-page-title">
          {isTerapeuta ? 'Gestión de Mi Jornada y Disponibilidad Horaria' : 'Gestión de Jornadas y Disponibilidad Horaria'}
        </h1>
        <p className="schedule-page-subtitle">
          Parametrización de bloques de atención y publicación de agenda semanal para especialistas.
        </p>
      </div>

      {/* Block 1: Working Schedule Configuration */}
      <div className="schedule-block-card">
        <h2 className="schedule-block-header">Bloque 1: Configuración de Jornada</h2>

        {validationError && (
          <div className="schedule-alert alert-error">
            <AlertTriangle size={18} className="alert-icon" />
            <span>{validationError}</span>
          </div>
        )}

        {successMessage && (
          <div className="schedule-alert alert-success">
            <CheckCircle size={18} className="alert-icon" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handlePublishSchedule} className="schedule-form">
          <div className="form-grid">
            {/* Therapist selection */}
            <div className="form-group full-width">
              <label className="form-label">
                {isTerapeuta ? 'Terapeuta' : 'Seleccionar Terapeuta'}
              </label>
              {isTerapeuta ? (
                <div className="therapist-locked-box">
                  <span className="therapist-locked-text">Dra. Camila Morales (Tú)</span>
                  <Lock size={16} className="lock-icon" />
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedTherapistId}
                  onChange={(e) => setSelectedTherapistId(Number(e.target.value))}
                >
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.specialty}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Working days checkboxes */}
            <div className="form-group full-width">
              <label className="form-label">Días Laborales:</label>
              <div className="checkbox-days-row">
                {[
                  { id: 1, label: 'Lun' },
                  { id: 2, label: 'Mar' },
                  { id: 3, label: 'Mié' },
                  { id: 4, label: 'Jue' },
                  { id: 5, label: 'Vie' },
                ].map((d) => (
                  <label key={d.id} className="day-checkbox-item">
                    <input
                      type="checkbox"
                      checked={Boolean(workingDays[d.id])}
                      onChange={() => handleDayToggle(d.id)}
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Range & Duration */}
            <div className="form-group inline-group">
              <label className="form-label">Hora Inicio:</label>
              <input
                type="time"
                className="form-input time-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group inline-group">
              <label className="form-label">Hora Término:</label>
              <input
                type="time"
                className="form-input time-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group inline-group">
              <label className="form-label">Duración de Bloque:</label>
              <select
                className="form-select duration-select"
                value={slotDuration}
                onChange={(e) => setSlotDuration(e.target.value)}
              >
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-publish-schedule"
              disabled={isLoading}
            >
              <CalendarCheck size={18} className="btn-icon" />
              <span>{isLoading ? 'Publicando...' : 'Generar y Publicar Horarios'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Block 2: Weekly Schedule Grid */}
      <div className="schedule-block-card">
        <h2 className="schedule-block-header">
          {isTerapeuta ? 'Bloque 2: Mi Agenda Semanal' : 'Bloque 2: Agenda Semanal'}
        </h2>

        {/* Week navigation */}
        <div className="week-navigation-bar">
          <div className="week-controls">
            <button
              type="button"
              className="week-nav-btn"
              title="Semana anterior"
              onClick={() => setWeekOffset((prev) => prev - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="week-range-text">{getWeekRangeLabel()}</span>
            <button
              type="button"
              className="week-nav-btn"
              title="Semana siguiente"
              onClick={() => setWeekOffset((prev) => prev + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            className="today-btn"
            onClick={() => setWeekOffset(0)}
          >
            [ Hoy ]
          </button>
        </div>

        {/* Weekly Grid Table */}
        <div className="table-responsive">
          <table className="schedule-grid-table">
            <thead>
              <tr>
                <th className="th-time">Horario</th>
                {daysHeader.map((d) => (
                  <th key={d.dayNum} className="th-day">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlotRows.map((slot) => (
                <tr key={slot.start}>
                  <td className="td-time">{slot.label}</td>
                  {daysHeader.map((d) => {
                    const status = getSlotStatus(d.dayNum, slot.start);
                    let badgeClass = 'badge-libre';
                    if (status === 'Disponible') badgeClass = 'badge-disponible';
                    if (status === 'Ocupado') badgeClass = 'badge-ocupado';
                    if (status === 'Bloqueado') badgeClass = 'badge-bloqueado';

                    return (
                      <td key={d.dayNum} className="td-slot">
                        <span className={`slot-badge ${badgeClass}`}>
                          {status}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="schedule-legend-bar">
          <span className="legend-title">Estados:</span>
          <span className="legend-item"><span className="legend-dot dot-disponible"></span>Disponible (verde)</span>
          <span className="legend-item"><span className="legend-dot dot-ocupado"></span>Ocupado (naranja/gris)</span>
          <span className="legend-item"><span className="legend-dot dot-bloqueado"></span>Bloqueado (rojo)</span>
          <span className="legend-item"><span className="legend-dot dot-libre"></span>Libre</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleConfigPage;
