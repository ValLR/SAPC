import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ClassCard from '../src/components/ClassCard';

describe('ClassCard Component', () => {
  const mockClassAvailable = {
    id_class: 1,
    title: 'Taller de Yoga Hatha',
    instructor: 'Camila Rojas',
    location: 'Sala 1',
    available_slots: 5,
    fecha_clase: 'Martes 22',
    start_time: '18:00:00',
    end_time: '19:15:00',
  };

  const mockClassFull = {
    id_class: 2,
    title: 'Pilates Reformer Advanced',
    instructor: 'Andrés Silva',
    location: 'Sala 2',
    available_slots: 0,
    fecha_clase: 'Jueves 24',
    start_time: '10:00:00',
    end_time: '11:00:00',
  };

  test('renders available slots and enables enrollment button', () => {
    const handleSelect = jest.fn();
    const { getByText } = render(<ClassCard item={mockClassAvailable} onSelect={handleSelect} />);

    expect(getByText('Taller de Yoga Hatha')).toBeTruthy();
    expect(getByText('5 cupos disponibles')).toBeTruthy();

    const button = getByText('Inscribirme');
    fireEvent.press(button);

    expect(handleSelect).toHaveBeenCalledWith(mockClassAvailable);
  });

  test('renders full capacity badge and disables enrollment when capacity is 0', () => {
    const handleSelect = jest.fn();
    const { getByText } = render(<ClassCard item={mockClassFull} onSelect={handleSelect} />);

    expect(getByText('Pilates Reformer Advanced')).toBeTruthy();
    expect(getByText('Aforo Completo (0 cupos)')).toBeTruthy();

    const button = getByText('Inscribirme');
    fireEvent.press(button);

    expect(handleSelect).not.toHaveBeenCalled();
  });
});
