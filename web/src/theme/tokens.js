/**
 * Tokens de Diseño - Portal Web Chawal (JS Export)
 * Permite acceder a los valores del sistema de diseño directamente desde componentes React.
 */

export const colors = {
  primary: {
    main: '#1B7B75',
    dark: '#155E59',
    light: '#E6F4F3',
  },
  secondary: {
    main: '#E08736',
    dark: '#C77022',
    light: '#FFF6ED',
  },
  neutral: {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    borderHover: '#CBD5E1',
    disabled: '#CBD5E1',
    disabledText: '#FFFFFF',
  },
  text: {
    primary: '#2D3748',
    secondary: '#718096',
    placeholder: '#A0AEC0',
    inverse: '#FFFFFF',
    disabled: '#94A3B8',
  },
  semantic: {
    error: '#EF4444',
    errorDark: '#DC2626',
    errorBg: '#FEF2F2',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
  },
};

export const layout = {
  sidebarWidth: '260px',
  headerHeight: '64px',
  radiusSm: '6px',
  radiusMd: '8px',
  radiusLg: '12px',
};

export const theme = {
  colors,
  layout,
};

export default theme;
