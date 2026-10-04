import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfesionalesPage from '../pages/ProfesionalesPage';
import profesionalesService from '../services/profesionalesService';

vi.mock('../services/profesionalesService');
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ role: 'Administrador' }),
}));

describe('ProfesionalesPage - US-14 CRUD', () => {
  const mockListaProfesionales = [
    {
      id_profesional: 1,
      id_usuario: 2,
      rut: '11111111-1',
      nombre: 'Camila',
      apellido: 'Rojas',
      email: 'camila.rojas@chawal.cl',
      telefono: '+56922222222',
      numero_registro: 'RNPI-2020-00123',
      titulo_profesional: 'Kinesióloga',
      anios_experiencia: 8,
      estado_disponibilidad: 'DISPONIBLE',
      estado_cuenta: 'ACTIVO',
      especialidades: [{ id_especialidad: 1, nombre: 'Kinesiología', es_principal: true }],
    },
  ];

  const mockEspecialidades = [
    { id_especialidad: 1, nombre: 'Kinesiología' },
    { id_especialidad: 2, nombre: 'Fonoaudiología' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    profesionalesService.getProfesionales.mockResolvedValue({
      success: true,
      data: mockListaProfesionales,
    });
    profesionalesService.getEspecialidades.mockResolvedValue({
      success: true,
      data: mockEspecialidades,
    });
  });

  it('renderiza la lista de profesionales en la tabla', async () => {
    render(<ProfesionalesPage />);

    await waitFor(() => {
      expect(screen.getByText('Camila Rojas')).toBeInTheDocument();
      expect(screen.getByText('camila.rojas@chawal.cl')).toBeInTheDocument();
    });
  });

  it('Escenario 1: Abre el modal, envía datos de nuevo profesional (POST 201) y recarga la tabla dinámicamente', async () => {
    profesionalesService.crearProfesional.mockResolvedValueOnce({
      success: true,
      message: 'Terapeuta creado correctamente',
      data: { id_profesional: 2, nombre: 'Matías', apellido: 'Fuentes' },
    });

    render(<ProfesionalesPage />);

    await waitFor(() => expect(screen.getByText('Camila Rojas')).toBeInTheDocument());

    // Click en + Nuevo Terapeuta
    fireEvent.click(screen.getByText('+ Nuevo Terapeuta'));

    expect(screen.getByText('Registro de Nuevo Terapeuta')).toBeInTheDocument();

    // Llenar formulario
    fireEvent.change(screen.getByPlaceholderText('12345678-9'), { target: { value: '22222222-2' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Matías' } });
    fireEvent.change(screen.getByPlaceholderText('Apellido'), { target: { value: 'Fuentes' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@chawal.cl'), { target: { value: 'matias@chawal.cl' } });
    fireEvent.change(screen.getByPlaceholderText('Password2026!'), { target: { value: 'Password2026!' } });
    fireEvent.change(screen.getByPlaceholderText('RNPI-2026-00000'), { target: { value: 'RNPI-2026-002' } });

    // Enviar
    fireEvent.click(screen.getByText('Guardar Terapeuta'));

    await waitFor(() => {
      expect(profesionalesService.crearProfesional).toHaveBeenCalled();
      expect(screen.getByText('Profesional registrado con éxito en el sistema.')).toBeInTheDocument();
    });
  });

  it('Escenario 2: Presiona Editar, modifica el modal y confirma cambios vía PUT (200 OK) mostrando alerta de éxito', async () => {
    profesionalesService.actualizarProfesional.mockResolvedValueOnce({
      success: true,
      message: 'Terapeuta actualizado correctamente',
    });

    render(<ProfesionalesPage />);

    await waitFor(() => expect(screen.getByText('Camila Rojas')).toBeInTheDocument());

    // Click en Editar
    fireEvent.click(screen.getByText('Editar'));

    expect(screen.getByText('Editar Datos de Terapeuta')).toBeInTheDocument();

    // Modificar título profesional
    const tituloInput = screen.getByPlaceholderText('Ej: Kinesióloga');
    fireEvent.change(tituloInput, { target: { value: 'Kinesióloga Senior' } });

    // Guardar cambios
    fireEvent.click(screen.getByText('Guardar Cambios'));

    await waitFor(() => {
      expect(profesionalesService.actualizarProfesional).toHaveBeenCalled();
      expect(screen.getByText('Datos del profesional actualizados exitosamente.')).toBeInTheDocument();
    });
  });
});
