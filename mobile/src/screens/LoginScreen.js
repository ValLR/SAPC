import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { colors } from '../theme/colors';
import LogoChawal from '../components/LogoChawal';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import AuthErrorModal from '../components/AuthErrorModal';

/**
 * Pantalla de Inicio de Sesión (LoginScreen)
 * Implementa los estados y validaciones visuales definidos en los Wireframes 1, 2 y 3.
 *
 * @param {Object} props
 * @param {Function} props.onLoginSuccess - Callback simulado al iniciar sesión con éxito
 */
export const LoginScreen = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de validación de error por campo
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Estado para visibilidad del modal de error de autenticación (Wireframe 2)
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Validación de formato de correo electrónico
  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!text.trim()) {
      return 'Campo requerido';
    }
    if (!emailRegex.test(text.trim())) {
      return 'Correo no válido (ej: usuario@correo.com)';
    }
    return '';
  };

  // Handler para cambio en input Correo
  const handleEmailChange = (text) => {
    setEmail(text);
    if (emailError) {
      setEmailError(validateEmail(text));
    }
  };

  const handleEmailBlur = () => {
    if (email.length > 0) {
      setEmailError(validateEmail(email));
    }
  };

  // Handler para cambio en input Contraseña
  const handlePasswordChange = (text) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError(text.trim() ? '' : 'Campo requerido');
    }
  };

  const handlePasswordBlur = () => {
    if (!password.trim() && password.length > 0) {
      setPasswordError('Campo requerido');
    }
  };

  // Verificación si el formulario es completamente válido para habilitar el botón
  const isEmailValid = email.trim() !== '' && validateEmail(email) === '';
  const isPasswordValid = password.trim() !== '';
  const isFormValid = isEmailValid && isPasswordValid;

  // Handler al presionar el botón "Ingresa"
  const handleLogin = () => {
    // Si por alguna razón la función se dispara sin validación
    const errMail = validateEmail(email);
    const errPass = password.trim() ? '' : 'Campo requerido';

    if (errMail || errPass) {
      setEmailError(errMail);
      setPasswordError(errPass);
      return;
    }

    // Simulación de credenciales de prueba:
    // Si la contraseña es "error" o "123", dispara el Modal de Error (Wireframe 2)
    if (password.toLowerCase() === 'error' || password === '123') {
      setModalMessage(
        'El correo o la contraseña ingresada no son correctos. Por favor, verifica tus datos e inténtalo nuevamente'
      );
      setShowErrorModal(true);
      return;
    }

    // Si las credenciales son válidas (Mock de éxito -> Escenario 1)
    if (onLoginSuccess) {
      onLoginSuccess({ email });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* 1. Header con Logo Institucional SAPC Chawal */}
            <LogoChawal variant="full" size={180} style={styles.logo} />

            {/* 2. Título de Bienvenida */}
            <Text style={styles.title}>Hola de nuevo</Text>

            {/* 3. Formulario Transaccional */}
            <View style={styles.form}>
              <CustomInput
                label="Correo"
                value={email}
                onChangeText={handleEmailChange}
                onBlur={handleEmailBlur}
                placeholder="ejemplo@correo.co"
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailError}
              />

              <CustomInput
                label="Contraseña"
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={handlePasswordBlur}
                placeholder="••••••••••••"
                isPassword
                error={passwordError}
              />

              {/* 4. Botón de Ingreso (Habilitado Teal #1B7B75 | Deshabilitado Gris #CBD5E1) */}
              <CustomButton
                title="Ingresa"
                onPress={handleLogin}
                disabled={!isFormValid}
                style={styles.loginButton}
              />
            </View>

            {/* Modal de Error de Autenticación (Wireframe 2) */}
            <AuthErrorModal
              visible={showErrorModal}
              onClose={() => setShowErrorModal(false)}
              message={modalMessage}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logo: {
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  loginButton: {
    marginTop: 12,
  },
});

export default LoginScreen;
