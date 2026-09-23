import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScheduleConfigPage } from '../pages/ScheduleConfigPage';
import { useAuth } from '../context/AuthContext';
import schedulesService from '../services/schedulesService';

vi.mock('../context/AuthContext');
vi.mock('../services/schedulesService');

describe('ScheduleConfigPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulesService.getSchedules.mockResolvedValue({
      success: true,
      therapistId: 1,
      therapists: [
        { id: 1, name: 'Dra. Camila Morales', specialty: 'Kinesiología' },
        { id: 2, name: 'Lic. Matías Fuentes', specialty: 'Fonoaudiología' },
      ],
      data: [],
    });
  });

  it('renders Block 1 configuration form and Block 2 weekly grid for Administrator', async () => {
    useAuth.mockReturnValue({
      user: { email: 'admin@chawal.cl', role: 'Administrador' },
    });

    render(<ScheduleConfigPage />);

    expect(screen.getByText('Gestión de Jornadas y Disponibilidad Horaria')).toBeInTheDocument();
    expect(screen.getByText('Bloque 1: Configuración de Jornada')).toBeInTheDocument();
    expect(screen.getByText('Bloque 2: Agenda Semanal')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Generar y Publicar Horarios')).toBeInTheDocument();
    });
  });

  it('locks therapist selector for Terapeuta role', async () => {
    useAuth.mockReturnValue({
      user: { email: 'camila.rojas@chawal.cl', role: 'Terapeuta' },
    });

    render(<ScheduleConfigPage />);

    expect(screen.getByText('Gestión de Mi Jornada y Disponibilidad Horaria')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dra. Camila Morales (Tú)')).toBeInTheDocument();
    });
  });

  it('shows validation error banner when end time is before start time', async () => {
    useAuth.mockReturnValue({
      user: { email: 'admin@chawal.cl', role: 'Administrador' },
    });

    const { container } = render(<ScheduleConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Generar y Publicar Horarios')).toBeInTheDocument();
    });

    const timeInputs = container.querySelectorAll('input[type="time"]');
    if (timeInputs.length >= 2) {
      fireEvent.change(timeInputs[0], { target: { value: '17:00' } });
      fireEvent.change(timeInputs[1], { target: { value: '09:00' } });
    }

    const form = container.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/La hora de término debe ser estrictamente posterior/i)).toBeInTheDocument();
    });

    expect(schedulesService.publishSchedule).not.toHaveBeenCalled();
  });
});
