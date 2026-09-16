import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * Componente de entrada de texto reutilizable con soporte para validación inline y campos de contraseña.
 * Utiliza íconos de Material UI (MaterialIcons) en lugar de emojis.
 *
 * @param {Object} props
 * @param {string} props.label - Etiqueta superior del campo
 * @param {string} props.value - Valor del input
 * @param {Function} props.onChangeText - Callback al cambiar texto
 * @param {string} [props.placeholder] - Texto de ayuda inicial
 * @param {string} [props.error] - Mensaje de error (si existe, resalta el borde en rojo)
 * @param {boolean} [props.isPassword=false] - Indica si es un campo de contraseña (agrega toggle de ojo)
 * @param {Function} [props.onBlur] - Evento al perder el foco
 * @param {Object} [props.keyboardType='default'] - Tipo de teclado
 * @param {Object} [props.autoCapitalize='none'] - Autocapitalización
 */
export const CustomInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  isPassword = false,
  onBlur,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  ...restProps
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  // Determinación dinámica del color del borde
  let borderColor = colors.input.borderNormal;
  if (hasError) {
    borderColor = colors.input.borderError;
  } else if (isFocused) {
    borderColor = colors.input.borderFocus;
  }

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputContainer, { borderColor }]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.placeholder}
          secureTextEntry={isPassword && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          {...restProps}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: colors.input.bg,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.semantic.error,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default CustomInput;
