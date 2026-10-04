import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import CustomButton from './CustomButton';

/**
 * Modal de diálogo para errores de autenticación
 *
 * @param {Object} props
 * @param {boolean} props.visible - Controla la visibilidad del modal
 * @param {Function} props.onClose - Callback al presionar "Entendido" o cerrar el modal
 * @param {string} [props.title="Error de Autenticación"] - Título del diálogo
 * @param {string} [props.message] - Mensaje explicativo del error
 */
export const AuthErrorModal = ({
  visible,
  onClose,
  title = 'Error de Autenticación',
  message = 'El correo o la contraseña ingresada no son correctos. Por favor, verifica tus datos e inténtalo nuevamente',
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.iconContainer}>
                <MaterialIcons
                  name="priority-high"
                  size={32}
                  color={colors.text.primary}
                />
              </View>

              <Text style={styles.title}>{title}</Text>

              <Text style={styles.message}>{message}</Text>

              <CustomButton
                title="Entendido"
                onPress={onClose}
                variant="orange"
                style={styles.button}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 46,
  },
});

export default AuthErrorModal;
