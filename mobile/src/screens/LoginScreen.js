import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import LogoChawal from '../components/LogoChawal';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import AuthErrorModal from '../components/AuthErrorModal';
import { useAuth } from '../context/AuthContext';

/**
 * Pantalla de Inicio de Sesión (LoginScreen)
 *
 * @param {Object} props
 * @param {Function} [props.onLoginSuccess] - Callback opcional al iniciar sesión con éxito
 */
export const LoginScreen = ({ onLoginSuccess }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

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

  const isEmailValid = email.trim() !== '' && validateEmail(email) === '';
  const isPasswordValid = password.trim() !== '';
  const isFormValid = isEmailValid && isPasswordValid;

  const handleLogin = async () => {
    const errMail = validateEmail(email);
    const errPass = password.trim() ? '' : 'Campo requerido';

    if (errMail || errPass) {
      setEmailError(errMail);
      setPasswordError(errPass);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(email, password);

      if (result && result.success) {
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }
      } else {
        setModalMessage(
          (result && result.message) ||
            'El correo o la contraseña ingresada no son correctos. Por favor, verifica tus datos e inténtalo nuevamente.'
        );
        setShowErrorModal(true);
      }
    } catch (err) {
      console.error('Error durante handleLogin:', err);
      setModalMessage(
        'El correo o la contraseña ingresada no son correctos. Por favor, verifica tus datos e inténtalo nuevamente.'
      );
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
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
            <LogoChawal variant="full" size={180} style={styles.logo} />

            <Text style={styles.title}>Hola de nuevo</Text>

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

              <CustomButton
                title="Ingresa"
                onPress={handleLogin}
                disabled={!isFormValid || isSubmitting}
                loading={isSubmitting}
                style={styles.loginButton}
              />
            </View>

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
