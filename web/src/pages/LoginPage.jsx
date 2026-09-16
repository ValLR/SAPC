import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoWithText from '../assets/logo-with-text.png';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import './LoginPage.css';

/**
 * Pantalla de Acceso Administrativo Privado (LoginPage.jsx)
 * Réplica exacta de la Imagen 1 de los Wireframes (Estados: Normal, Cargando, Error).
 */
export const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Administrador');

  // Estados de validación de error
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si ya está autenticado, redirigir al Dashboard
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
    if (emailError) setEmailError(validateEmail(val));
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
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
    const errMail = validateEmail(email);
    const errPass = password.trim() ? '' : 'Campo requerido';

    if (errMail || errPass) {
      setEmailError(errMail);
      setPasswordError(errPass);
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulación de delay de red (2. Pantalla 1.2: Cargando)
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Simulación de error de prueba si escribe "error"
      if (password.toLowerCase() === 'error') {
        setEmailError('El correo o la contraseña ingresada no son correctos.');
        setPasswordError('Verifica tus credenciales');
        setIsSubmitting(false);
        return;
      }

      await login(email, password, selectedRole);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setEmailError('Error al iniciar sesión');
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

          {/* Selector Mock de Rol para probar Wireframe 2 (Admin) y Wireframe 3 (Terapeuta) */}
          <div className="login-role-selector">
            <span className="login-role-label">Simular Rol:</span>
            <div className="login-role-buttons">
              <button
                type="button"
                className={`role-chip ${selectedRole === 'Administrador' ? 'active-admin' : ''}`}
                onClick={() => setSelectedRole('Administrador')}
              >
                Administrador (A)
              </button>
              <button
                type="button"
                className={`role-chip ${selectedRole === 'Terapeuta' ? 'active-terapeuta' : ''}`}
                onClick={() => setSelectedRole('Terapeuta')}
              >
                Terapeuta (T)
              </button>
            </div>
          </div>

          {/* Botón de Ingreso */}
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid}
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
