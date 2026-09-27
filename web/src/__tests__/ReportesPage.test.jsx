import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReportesPage from '../pages/ReportesPage';
import { reportsWebService } from '../services/reportsWebService';

vi.mock('../services/reportsWebService');

describe('ReportesPage Component (US-17)', () => {
  const mockReportSuccess = {
    success: true,
    status: 200,
    message: 'Métricas consolidadas generadas correctamente',
    generadoEn: '2026-09-25T12:00:00.000Z',
    rango: { desde: null, hasta: null },
    citas: {
      total: 45,
      vigentes: 40,
      canceladas: 3,
      no_asistio: 2,
      por_especialista: [
        {
          id_profesional: 1,
          especialista: 'Dra. Camila Morales',
          id_especialidad: 1,
          especialidad: 'Psicología',
          total_citas: 25,
          vigentes: 22,
          canceladas: 2,
          no_asistio: 1,
        },
        {
          id_profesional: 2,
          especialista: 'Dr. Roberto Gómez',
          id_especialidad: 2,
          especialidad: 'Kinesiología',
          total_citas: 20,
          vigentes: 18,
          canceladas: 1,
          no_asistio: 1,
        },
      ],
      por_especialidad: [],
    },
    ocupacionClases: {
      global: {
        clases: 2,
        aforo_total: 20,
        inscritos_total: 15,
        porcentaje_ocupacion: 75,
        clases_canceladas_excluidas: 0,
      },
      detalle: [
        {
          id_clase: 1,
          nombre_actividad: 'Yoga Restaurativo',
          sala: 'Sala 1',
          aforo_maximo: 10,
          inscritos: 8,
          porcentaje_ocupacion: 80,
          completa: false,
        },
        {
          id_clase: 2,
          nombre_actividad: 'Pilates Suave',
          sala: 'Sala 2',
          aforo_maximo: 10,
          inscritos: 7,
          porcentaje_ocupacion: 70,
          completa: false,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    reportsWebService.getOccupancyReport.mockResolvedValue(mockReportSuccess);
  });

  it('renderiza la cabecera y el loader durante la carga inicial', async () => {
    render(<ReportesPage />);
    expect(screen.getByText(/Reportes y Métricas en Línea/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Dra. Camila Morales')).toBeInTheDocument();
    });
  });

  it('renderiza correctamente las tarjetas KPI y las tablas con datos del backend real', async () => {
    render(<ReportesPage />);

    await waitFor(() => {
      expect(screen.getByText('Dra. Camila Morales')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Roberto Gómez')).toBeInTheDocument();
    expect(screen.getByText('Yoga Restaurativo')).toBeInTheDocument();
    expect(screen.getByText('Pilates Suave')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('despliega banner de error RBAC 403 cuando el servicio retorna denegado', async () => {
    reportsWebService.getOccupancyReport.mockResolvedValueOnce({
      success: false,
      status: 403,
      message: 'Acceso denegado. Se requieren privilegios de Administrador (RBAC).',
      citas: null,
      ocupacionClases: null,
    });

    render(<ReportesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Acceso denegado. Se requieren privilegios de Administrador/i)
      ).toBeInTheDocument();
    });
  });

  it('despliega mensaje amigable cuando ocurre un error de red o servidor', async () => {
    reportsWebService.getOccupancyReport.mockResolvedValueOnce({
      success: false,
      status: 500,
      message: 'No fue posible cargar las métricas en este momento',
      citas: null,
      ocupacionClases: null,
    });

    render(<ReportesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No fue posible cargar las métricas en este momento/i)
      ).toBeInTheDocument();
    });
  });
});
