import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

/**
 * Componente Input Reutilizable con soporte para etiquetas, errores y toggle ojo para contraseñas.
 */
export const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  isPassword = false,
  className = '',
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = Boolean(error);

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}

      <div className={`input-wrapper ${hasError ? 'input-error-border' : ''}`}>
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className="input-field"
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="input-eye-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {hasError && <span className="input-error-msg">{error}</span>}
    </div>
  );
};

export default Input;
