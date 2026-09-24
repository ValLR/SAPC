import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TalleresPage from '../pages/TalleresPage';
import classesWebService from '../services/classesWebService';
import profesionalesService from '../services/profesionalesService';

vi.mock('../services/classesWebService');
vi.mock('../services/profesionalesService');

describe('TalleresPage Component (US-12)', () => {
  const mockClasses = [
    {
      id_clase: 1,
      nombre_actividad: 'Yoga Vinyasa',
      instructor: 'Camila Rojas',
      sala: 'Sala 1 - Multiuso',
      fecha_clase: '2026-10-25',
      hora_inicio: '10:00:00',
      hora_fin: '11:15:00',
      aforo_maximo: 10,
      cupos_disponibles: 4,
      inscripciones_activas: 6,
      porcentaje_ocupacion: 60,
      is_full: false,
    },
    {
      id_clase: 2,
      nombre_actividad: 'Pilates Reformer',
      instructor: 'Andrés Silva',
      sala: 'Sala 2 - Acondicionamiento',
      fecha_clase: '2026-10-26',
      hora_inicio: '16:00:00',
      hora_fin: '17:15:00',
      aforo_maximo: 8,
      cupos_disponibles: 0,
      inscripciones_activas: 8,
      porcentaje_ocupacion: 100,
      is_full: true,
    },
  ];

  const mockProfesionales = [
    { id_profesional: 1, nombre: 'Camila', apellido: 'Rojas', especialidad: 'Kinesiología' },
    { id_profesional: 2, nombre: 'Andrés', apellido: 'Silva', especialidad: 'Nutrición' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    classesWebService.fetchClasses.mockResolvedValue({ success: true, data: mockClasses });
    profesionalesService.getProfesionales.mockResolvedValue({ success: true, data: mockProfesionales });
  });

  it('renderiza la vista inicial con la tabla de talleres y métricas de ocupación', async () => {
    render(<TalleresPage />);

    expect(screen.getByText(/Talleres Grupales y Aforos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Yoga Vinyasa')).toBeInTheDocument();
      expect(screen.getByText('Pilates Reformer')).toBeInTheDocument();
    });

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    expect(screen.getByText('Con Cupos')).toBeInTheDocument();
    expect(screen.getByText('Aforo Completo')).toBeInTheDocument();
  });

  it('procesa el alta de un nuevo taller (Gherkin Escenario 1)', async () => {
    classesWebService.createClass.mockResolvedValue({
      success: true,
      message: 'Taller registrado y sala asignada con éxito',
    });

    render(<TalleresPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre del Taller/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nombre del Taller/i), {
      target: { value: 'Fit-Dance Postural' },
    });

    fireEvent.change(screen.getByLabelText(/Fecha de la Clase/i), {
      target: { value: '2026-11-01' },
    });

    fireEvent.change(screen.getByLabelText(/Aforo Máximo/i), {
      target: { value: '15' },
    });

    const submitBtn = screen.getByRole('button', { name: /Guardar y Publicar Taller/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(classesWebService.createClass).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre_actividad: 'Fit-Dance Postural',
          aforo_maximo: 15,
          fecha_clase: '2026-11-01',
        })
      );
      expect(screen.getByText(/Clase registrada y sala asignada con éxito/i)).toBeInTheDocument();
    });
  });
});
