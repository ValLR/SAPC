/**
 * Tokens de Diseño - Sistema Chawal (Design System)
 * Definición centralizada de colores, estados y semántica.
 */

export const colors = {
  // Marca e Identidad Chawal
  primary: {
    main: '#1B7B75',       // Verde azulado / Teal institucional
    dark: '#155E59',        // Teal oscuro (pressed/hover)
    light: '#28A099',       // Teal claro
    background: '#E6F4F3',  // Fondo tenue institucional
  },

  secondary: {
    main: '#E08736',       // Naranja cálido para contrastes e interactividad
    dark: '#C77022',        // Naranja oscuro
    light: '#F8A555',       // Naranja claro
    background: '#FFF6ED',  // Fondo tenue naranja
  },

  // Neutros y Superficies
  neutral: {
    white: '#FFFFFF',
    background: '#F8F9FA',  // Gris claro neutro
    surface: '#FFFFFF',
    border: '#E2E8F0',      // Borde estándar
    disabled: '#CBD5E1',    // Gris atenuado para elementos deshabilitados
    disabledText: '#FFFFFF',// Texto sobre elemento deshabilitado
  },

  // Tipografía y Textos
  text: {
    primary: '#2D3748',     // Texto principal oscuro
    secondary: '#718096',   // Texto secundario / etiquetas
    placeholder: '#A0AEC0', // Texto placeholder en inputs
    inverse: '#FFFFFF',     // Texto blanco
    disabled: '#94A3B8',    // Texto inactivo
  },

  // Estados Semánticos
  semantic: {
    error: '#EF4444',       // Rojo error
    errorDark: '#DC2626',
    errorBackground: '#FEF2F2',
    success: '#10B981',     // Verde éxito
    warning: '#F59E0B',     // Amarillo advertencia
    info: '#3B82F6',        // Azul información
  },

  // Especificaciones de Componentes UI
  button: {
    primaryBg: '#1B7B75',
    primaryText: '#FFFFFF',
    disabledBg: '#CBD5E1',
    disabledText: '#FFFFFF',
    accentBg: '#E08736',
    accentText: '#FFFFFF',
  },

  input: {
    borderNormal: '#CBD5E1',
    borderFocus: '#1B7B75',
    borderError: '#EF4444',
    bg: '#FFFFFF',
  },

  overlay: 'rgba(0, 0, 0, 0.5)',
};

export default colors;
