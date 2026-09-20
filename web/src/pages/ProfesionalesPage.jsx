import React, { useState, useEffect } from 'react';
import profesionalesService from '../services/profesionalesService';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import './ProfesionalesPage.css';

/**
 * Módulo Web para Mantenedor CRUD de Profesionales / Terapeutas (US-14)
 * Criterios de Aceptación:
 * - Escenario 1: Registro visual de un profesional (POST -> 201 Created -> Recarga dinámica)
 * - Escenario 2: Edición de datos desde la interfaz web (PUT -> 200 OK -> Actualiza fila y alerta)
 */
export const ProfesionalesPage = () => {
  const { role } = useAuth();
  const isAdmin = !role || role.toUpperCase() === 'ADMINISTRADOR' || role === 'Administrador';

  const [profesionales, setProfesionales] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado de Alerta General de Página (Éxito tras cerrar modal)
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: string }

  // Estado del Modal y Error Interno del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedProfId, setSelectedProfId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Formulario
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
    numero_registro: '',
    titulo_profesional: '',
    anios_experiencia: 0,
    biografia: '',
    id_especialidad: 1,
    estado_disponibilidad: 'DISPONIBLE',
    estado_cuenta: 'ACTIVO',
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [resProf, resEsp] = await Promise.all([
      profesionalesService.getProfesionales(),
      profesionalesService.getEspecialidades(),
    ]);

    if (resProf.success) {
      setProfesionales(resProf.data);
    }
    if (resEsp.success) {
      setEspecialidades(resEsp.data);
      if (resEsp.data.length > 0) {
        setFormData((prev) => ({ ...prev, id_especialidad: resEsp.data[0].id_especialidad }));
      }
    }
    setLoading(false);
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedProfId(null);
    setFormErrors({});
    setModalError('');
    setFormData({
      rut: '',
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      password: '',
      numero_registro: '',
      titulo_profesional: '',
      anios_experiencia: 0,
      biografia: '',
      id_especialidad: especialidades.length > 0 ? especialidades[0].id_especialidad : 1,
      estado_disponibilidad: 'DISPONIBLE',
      estado_cuenta: 'ACTIVO',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prof) => {
    setModalMode('edit');
    setSelectedProfId(prof.id_profesional);
    setFormErrors({});
    setModalError('');

    const espPrincipal = prof.especialidades?.find((e) => e.es_principal) || prof.especialidades?.[0];

    setFormData({
      rut: prof.rut || '',
      nombre: prof.nombre || '',
      apellido: prof.apellido || '',
      email: prof.email || '',
      telefono: prof.telefono || '',
      password: '',
      numero_registro: prof.numero_registro || '',
      titulo_profesional: prof.titulo_profesional || '',
      anios_experiencia: prof.anios_experiencia || 0,
      biografia: prof.biografia || '',
      id_especialidad: espPrincipal ? espPrincipal.id_especialidad : (especialidades[0]?.id_especialidad || 1),
      estado_disponibilidad: prof.estado_disponibilidad || 'DISPONIBLE',
      estado_cuenta: prof.estado_cuenta || 'ACTIVO',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setModalError('');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (modalError) setModalError('');
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validarFormulario = () => {
    const errors = {};
    if (!formData.rut.trim()) errors.rut = 'El RUT es requerido';
    if (!formData.nombre.trim()) errors.nombre = 'El nombre es requerido';
    if (!formData.apellido.trim()) errors.apellido = 'El apellido es requerido';
    if (!formData.email.trim()) errors.email = 'El correo es requerido';
    if (modalMode === 'create' && !formData.password) errors.password = 'La contraseña es requerida';
    if (!formData.numero_registro.trim()) errors.numero_registro = 'El N° de registro es requerido';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setIsSubmitting(true);
    setModalError('');
    setAlert(null);

    const payload = {
      rut: formData.rut,
      nombre: formData.nombre,
      apellido: formData.apellido,
      email: formData.email,
      telefono: formData.telefono,
      numero_registro: formData.numero_registro,
      titulo_profesional: formData.titulo_profesional,
      anios_experiencia: Number(formData.anios_experiencia) || 0,
      biografia: formData.biografia,
      estado_disponibilidad: formData.estado_disponibilidad,
      estado_cuenta: formData.estado_cuenta,
      especialidades: [
        {
          id_especialidad: Number(formData.id_especialidad),
          es_principal: true,
        },
      ],
    };

    if (modalMode === 'create') {
      payload.password = formData.password;

      // Escenario 1: Registro visual de un profesional (POST -> 201 Created)
      const res = await profesionalesService.crearProfesional(payload);

      if (res.success) {
        setIsModalOpen(false);
        setAlert({
          type: 'success',
          message: 'Profesional registrado con éxito en el sistema.',
        });
        await cargarDatos(); // Recarga dinámica de la tabla
      } else {
        // Error de backend (ej: 409 Conflict "Recurso duplicado"): Mostrar DENTRO del modal
        setModalError(res.message || 'Error al guardar terapeuta.');
      }
    } else {
      // Escenario 2: Edición de datos desde la interfaz web (PUT -> 200 OK)
      const res = await profesionalesService.actualizarProfesional(selectedProfId, payload);

      if (res.success) {
        setIsModalOpen(false);
        setAlert({
          type: 'success',
          message: 'Datos del profesional actualizados exitosamente.',
        });
        await cargarDatos(); // Actualización inmediata en pantalla
      } else {
        // Error de backend: Mostrar DENTRO del modal
        setModalError(res.message || 'Error al actualizar terapeuta.');
      }
    }

    setIsSubmitting(false);
  };

  const profesionalesFiltrados = profesionales.filter((p) => {
    const term = searchTerm.toLowerCase();
    const nombreCompleto = `${p.nombre} ${p.apellido}`.toLowerCase();
    const rut = (p.rut || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    return nombreCompleto.includes(term) || rut.includes(term) || email.includes(term);
  });

  return (
    <div className="profesionales-container">
      {/* Encabezado */}
      <div className="profesionales-header">
        <div className="profesionales-header-info">
          <h1>Gestión de Profesionales</h1>
          <p>Administración y nómina de especialistas de atención médica Chawal</p>
        </div>
        <div className="profesionales-actions">
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o email..."
            className="profesionales-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {isAdmin && (
            <Button variant="primary" onClick={handleOpenCreateModal}>
              + Nuevo Terapeuta
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de Éxito General de Página */}
      {alert && (
        <div className={`alert-banner ${alert.type}`} role="alert">
          <span>{alert.message}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => setAlert(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabla de Profesionales */}
      <div className="profesionales-table-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Cargando nómina de profesionales...
          </div>
        ) : (
          <div className="table-responsive">
            <table className="profesionales-table">
              <thead>
                <tr>
                  <th>Especialista</th>
                  <th>Contacto</th>
                  <th>Especialidad</th>
                  <th>N° Registro</th>
                  <th>Disponibilidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profesionalesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>
                      No se encontraron profesionales registrados.
                    </td>
                  </tr>
                ) : (
                  profesionalesFiltrados.map((prof) => {
                    const esp = prof.especialidades?.find((e) => e.es_principal) || prof.especialidades?.[0];
                    return (
                      <tr key={prof.id_profesional}>
                        <td>
                          <div className="user-cell">
                            <span className="user-name">{prof.nombre} {prof.apellido}</span>
                            <span className="user-sub">RUT: {prof.rut}</span>
                          </div>
                        </td>
                        <td>
                          <div className="user-cell">
                            <span>{prof.email}</span>
                            <span className="user-sub">{prof.telefono || 'Sin teléfono'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-specialty">
                            {esp?.nombre || 'General'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                            {prof.numero_registro}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${(prof.estado_disponibilidad || 'DISPONIBLE').toLowerCase().replace('_', '-')}`}
                          >
                            {prof.estado_disponibilidad || 'DISPONIBLE'}
                          </span>
                        </td>
                        <td>
                          {isAdmin ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleOpenEditModal(prof)}
                              style={{ padding: '6px 12px', fontSize: 12 }}
                            >
                              Editar
                            </Button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Lectura</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Alta / Edición de Terapeuta */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Registro de Nuevo Terapeuta' : 'Editar Datos de Terapeuta'}</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Alerta de Error INTERNA en el Modal */}
                {modalError && (
                  <div className="alert-banner error" style={{ marginBottom: 16 }} role="alert">
                    <span>{modalError}</span>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => setModalError('')}
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="form-grid">
                  <Input
                    label="RUT *"
                    placeholder="12345678-9"
                    value={formData.rut}
                    onChange={(e) => handleInputChange('rut', e.target.value)}
                    error={formErrors.rut}
                    disabled={modalMode === 'edit'}
                  />

                  <Input
                    label="Nombre *"
                    placeholder="Nombre"
                    value={formData.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    error={formErrors.nombre}
                  />

                  <Input
                    label="Apellido *"
                    placeholder="Apellido"
                    value={formData.apellido}
                    onChange={(e) => handleInputChange('apellido', e.target.value)}
                    error={formErrors.apellido}
                  />

                  <Input
                    label="Correo Electrónico *"
                    type="email"
                    placeholder="ejemplo@chawal.cl"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    error={formErrors.email}
                    disabled={modalMode === 'edit'}
                  />

                  <Input
                    label="Teléfono"
                    placeholder="+56912345678"
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                  />

                  {modalMode === 'create' && (
                    <Input
                      label="Contraseña Inicial *"
                      isPassword
                      placeholder="Password2026!"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      error={formErrors.password}
                    />
                  )}

                  <Input
                    label="N° Registro *"
                    placeholder="RNPI-2026-00000"
                    value={formData.numero_registro}
                    onChange={(e) => handleInputChange('numero_registro', e.target.value)}
                    error={formErrors.numero_registro}
                    disabled={modalMode === 'edit'}
                  />

                  <Input
                    label="Título Profesional"
                    placeholder="Ej: Kinesióloga"
                    value={formData.titulo_profesional}
                    onChange={(e) => handleInputChange('titulo_profesional', e.target.value)}
                  />

                  <Input
                    label="Años de Experiencia"
                    type="number"
                    value={formData.anios_experiencia}
                    onChange={(e) => handleInputChange('anios_experiencia', e.target.value)}
                  />

                  <div>
                    <label className="form-label">Especialidad Principal *</label>
                    <select
                      className="form-select"
                      value={formData.id_especialidad}
                      onChange={(e) => handleInputChange('id_especialidad', Number(e.target.value))}
                    >
                      {especialidades.map((esp) => (
                        <option key={esp.id_especialidad} value={esp.id_especialidad}>
                          {esp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Estado Disponibilidad</label>
                    <select
                      className="form-select"
                      value={formData.estado_disponibilidad}
                      onChange={(e) => handleInputChange('estado_disponibilidad', e.target.value)}
                    >
                      <option value="DISPONIBLE">DISPONIBLE</option>
                      <option value="NO_DISPONIBLE">NO DISPONIBLE</option>
                      <option value="LICENCIA">LICENCIA</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Estado de Cuenta</label>
                    <select
                      className="form-select"
                      value={formData.estado_cuenta}
                      onChange={(e) => handleInputChange('estado_cuenta', e.target.value)}
                    >
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="INACTIVO">INACTIVO</option>
                      <option value="BLOQUEADO">BLOQUEADO</option>
                    </select>
                  </div>

                  <div className="form-group-full">
                    <label className="form-label">Biografía / Perfil Clínico</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Breve reseña del especialista..."
                      value={formData.biografia}
                      onChange={(e) => handleInputChange('biografia', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  {modalMode === 'create' ? 'Guardar Terapeuta' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfesionalesPage;
