import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const logoWithText = require('../../assets/logo-with-text.png');
const logoIconOnly = require('../../assets/logo-icon.png');

/**
 * Componente de marca institucional SAPC - Chawal
 * @param {Object} props
 * @param {'full' | 'icon'} [props.variant='full'] - Variante del logo (con o sin texto)
 * @param {number} [props.size=140] - Ancho del logo
 * @param {Object} [props.style] - Estilos adicionales para el contenedor
 */
export const LogoChawal = ({ variant = 'full', size = 140, style }) => {
  const isFull = variant === 'full';
  const source = isFull ? logoWithText : logoIconOnly;
  
  // Mantiene la proporción de aspect ratio adecuada
  const aspectRatio = isFull ? 1 : 1; 
  const height = size / aspectRatio;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={source}
        style={{ width: size, height: height }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LogoChawal;
