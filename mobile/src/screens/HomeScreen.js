import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import LogoChawal from '../components/LogoChawal';
import CustomButton from '../components/CustomButton';

/**
 * Se despliega al completar un inicio de sesión exitoso.
 *
 * @param {Object} props
 * @param {Object} [props.user] - Datos del usuario autenticado
 * @param {Function} props.onLogout - Callback para cerrar sesión y retornar al Login
 */
export const HomeScreen = ({ user, onLogout, onNavigateToClasses, onNavigateToAppointments }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LogoChawal variant="full" size={140} style={styles.logo} />

        <View style={styles.card}>
          <Text style={styles.welcomeTitle}>¡Bienvenido(a)!</Text>
          <Text style={styles.userEmail}>
            {user?.email || 'paciente@chawal.cl'}
          </Text>

          <Text style={styles.subtitle}>
            Portal de Agendamiento, Pagos y Contenidos - Centro Chawal
          </Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>Sesión Activa</Text>
          </View>

          {/* Action buttons for Mobile Features */}
          <CustomButton
            title="Talleres y Clases Grupales"
            onPress={onNavigateToClasses}
            variant="primary"
            style={styles.actionButton}
          />

          <CustomButton
            title="Reservar Cita Médica"
            onPress={onNavigateToAppointments}
            variant="secondary"
            style={styles.actionButton}
          />

          <CustomButton
            title="Cerrar Sesión"
            onPress={onLogout}
            variant="orange"
            style={styles.logoutButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.main,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  badge: {
    backgroundColor: colors.primary.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 24,
  },
  badgeText: {
    color: colors.primary.main,
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    width: '100%',
  },
  actionButton: {
    width: '100%',
    marginBottom: 12,
  },
});

export default HomeScreen;
