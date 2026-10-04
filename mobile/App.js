import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ClassesScreen from './src/screens/ClassesScreen';
import AppointmentBookingScreen from './src/screens/AppointmentBookingScreen';
import { colors } from './src/theme/colors';

function Navigation() {
  const { user, logout, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('home');

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <LoginScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {currentScreen === 'classes' && (
        <ClassesScreen onBack={() => setCurrentScreen('home')} />
      )}
      {currentScreen === 'appointments' && (
        <AppointmentBookingScreen onBack={() => setCurrentScreen('home')} />
      )}
      {currentScreen === 'home' && (
        <HomeScreen
          user={user}
          onLogout={logout}
          onNavigateToClasses={() => setCurrentScreen('classes')}
          onNavigateToAppointments={() => setCurrentScreen('appointments')}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
