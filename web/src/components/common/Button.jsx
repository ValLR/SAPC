import React from 'react';
import { Loader2 } from 'lucide-react';
import './Button.css';

/**
 * Componente de Botón Reutilizable del Sistema de Diseño Web Chawal
 * @param {Object} props
 * @param {string} [props.variant='primary'] - 'primary' | 'orange' | 'secondary'
 * @param {boolean} [props.disabled=false] - Estado deshabilitado
 * @param {boolean} [props.loading=false] - Muestra spinner de carga
 */
export const Button = ({
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const btnClass = `btn btn-${variant} ${disabled ? 'btn-disabled' : ''} ${className}`;

  return (
    <button
      type={type}
      className={btnClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className="btn-loading-content">
          <Loader2 className="btn-spinner" size={18} />
          <span>Cargando...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
