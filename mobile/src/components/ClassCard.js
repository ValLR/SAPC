import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../theme/colors';

/**
 * Component for displaying a group class card with real-time capacity badge and enrollment action.
 */
export const ClassCard = ({ item, onSelect }) => {
  const availableSlots = Number(item.available_slots ?? item.cupos_disponibles ?? 0);
  const isAvailable = availableSlots > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title || item.nombre_actividad}</Text>

      <Text style={styles.subtext}>
        Prof. {item.instructor} - {item.location || 'Sala 1'}
      </Text>

      <Text style={styles.timeText}>
        {item.fecha_clase || 'Mar.'} {item.start_time?.substring(0, 5) || '18:00'} - {item.end_time?.substring(0, 5) || '19:15'} hrs
      </Text>

      <View style={styles.footerRow}>
        {/* Badge de Aforo */}
        <View style={[styles.badge, isAvailable ? styles.badgeSuccess : styles.badgeError]}>
          <Text style={[styles.badgeText, isAvailable ? styles.badgeTextSuccess : styles.badgeTextError]}>
            {isAvailable ? `${availableSlots} cupos disponibles` : 'Aforo Completo (0 cupos)'}
          </Text>
        </View>

        {/* Botón Inscribirme */}
        <TouchableOpacity
          style={[styles.button, isAvailable ? styles.buttonActive : styles.buttonDisabled]}
          disabled={!isAvailable}
          onPress={() => onSelect(item)}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, !isAvailable && styles.buttonTextDisabled]}>
            Inscribirme
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.main,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeSuccess: {
    backgroundColor: '#DEF7EC',
  },
  badgeError: {
    backgroundColor: '#FDE8E8',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextSuccess: {
    color: '#03543F',
  },
  badgeTextError: {
    color: '#9B1C1C',
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonActive: {
    backgroundColor: colors.primary.main,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral.disabled,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
  },
});

export default ClassCard;
