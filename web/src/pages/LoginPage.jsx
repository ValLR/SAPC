import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoWithText from '../assets/logo-with-text.png';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import './LoginPage.css';

/**
 * Pantalla de Acceso Administrativo Privado (LoginPage.jsx)
 * Conectada al backend REST de SAPC Chawal.
 */
export const LoginPage = () => {
  const { isAuthenticated, login, authError, clearError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de validación de error
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirigir al Dashboard si ya hay sesión iniciada
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val.trim()) return 'Campo requerido';
    if (!regex.test(val.trim())) return 'Formato de correo no válido';
    return '';
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setFormErrorMessage('');
    if (clearError) clearError();
    if (emailError) setEmailError(validateEmail(val));
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setFormErrorMessage('');
    if (clearError) clearError();
    if (passwordError) setPasswordError(val.trim() ? '' : 'Campo requerido');
  };

  const handleBlurEmail = () => {
    if (email.length > 0) setEmailError(validateEmail(email));
  };

  const handleBlurPassword = () => {
    if (password.length > 0 && !password.trim()) setPasswordError('Campo requerido');
  };

  const isEmailValid = email.trim() !== '' && validateEmail(email) === '';
  const isPasswordValid = password.trim() !== '';
  const isFormValid = isEmailValid && isPasswordValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrorMessage('');
    const errMail = validateEmail(email);
    const errPass = password.trim() ? '' : 'Campo requerido';

    if (errMail || errPass) {
      setEmailError(errMail);
      setPasswordError(errPass);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login(email, password);

      if (res.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setFormErrorMessage(res.message || 'Credenciales no válidas');
        setEmailError('El correo o la contraseña ingresada no son correctos.');
        setPasswordError('Verifica tus credenciales');
      }
    } catch (err) {
      console.error('Error al enviar formulario de login:', err);
      setFormErrorMessage('Error inesperado al intentar conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Logo Institucional Centrado */}
        <div className="login-logo-container">
          <img src={logoWithText} alt="S.A.P.C. Chawal" className="login-logo-img" />
        </div>

        {/* Título de la vista */}
        <h1 className="login-title">Acceso Administrativo Privado</h1>

        {/* Mensaje de Error General si Backend Retorna Error */}
        {(formErrorMessage || authError) && (
          <div className="login-error-banner" role="alert">
            {formErrorMessage || authError}
          </div>
        )}

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="login-form">
          <Input
            label="Correo"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleBlurEmail}
            error={emailError}
            autoComplete="username"
          />

          <Input
            label="Contraseña"
            isPassword
            placeholder="••••••••••••••••"
            value={password}
            onChange={handlePasswordChange}
            onBlur={handleBlurPassword}
            error={passwordError}
            autoComplete="current-password"
          />

          {/* Botón de Ingreso */}
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid || isSubmitting}
            loading={isSubmitting}
            className="login-submit-btn"
          >
            Ingresa
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
