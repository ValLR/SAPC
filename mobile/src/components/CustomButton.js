import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';

/**
 * Componente de botón reutilizable con variantes para el Sistema de Diseño Chawal.
 *
 * @param {Object} props
 * @param {string} props.title - Texto del botón
 * @param {Function} props.onPress - Función ejecutada al hacer clic
 * @param {boolean} [props.disabled=false] - Deshabilita el botón y cambia el estilo a gris (#CBD5E1)
 * @param {'primary' | 'orange' | 'secondary'} [props.variant='primary'] - Estilo de variante (Verde Teal o Naranja acento)
 * @param {boolean} [props.loading=false] - Muestra un indicador de carga
 * @param {Object} [props.style] - Estilos de contenedor adicionales
 * @param {Object} [props.textStyle] - Estilos de texto adicionales
 */
export const CustomButton = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  loading = false,
  style,
  textStyle,
  ...restProps
}) => {
  const isOrange = variant === 'orange' || variant === 'secondary';

  // Determinación de colores según estado y variante
  let backgroundColor = colors.button.primaryBg;
  let textColor = colors.button.primaryText;

  if (disabled) {
    backgroundColor = colors.button.disabledBg;
    textColor = colors.button.disabledText;
  } else if (isOrange) {
    backgroundColor = colors.button.accentBg;
    textColor = colors.button.accentText;
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor },
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...restProps}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledButton: {
    elevation: 0,
    shadowOpacity: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CustomButton;
