import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import colors from '../theme/colors';

const LOGO_ICON = require('../../assets/logo-icon.png');

export const AppointmentBookingScreen = ({ onBack }) => {
  // Pasos: 1 = Buscar Terapeuta, 2 = Seleccionar Fecha y Hora, 3 = Confirmada
  const [step, setStep] = useState(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todos');
  const [selectedTerapeuta, setSelectedTerapeuta] = useState(null);
  const [selectedDay, setSelectedDay] = useState(23); // Mié 23
  const [selectedSlot, setSelectedSlot] = useState('10:00 - 10:45');

  const terapeutasMock = [
    {
      id: 1,
      name: 'Dra. Camila Morales',
      specialty: 'Psicología Clínica (Salud Mental)',
      category: 'Salud Mental',
    },
    {
      id: 2,
      name: 'Lic. Andrés Silva',
      specialty: 'Nutrición Integral',
      category: 'Nutrición',
    },
    {
      id: 3,
      name: 'Ps. María Paz Castro',
      specialty: 'Psicoterapeuta',
      category: 'Salud Mental',
    },
  ];

  const timeSlots = [
    { time: '09:00 - 09:45', available: true },
    { time: '10:00 - 10:45', available: true },
    { time: '11:00 - 11:45', available: false },
    { time: '15:00 - 15:45', available: true },
  ];

  const handleSelectTerapeuta = (terapeuta) => {
    setSelectedTerapeuta(terapeuta);
    setStep(2);
  };

  const handleConfirmAppointment = () => {
    setStep(3);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Header con Logo Icon sin letras */}
        <View style={styles.header}>
          <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(step - 1)} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Image source={LOGO_ICON} style={styles.logoIcon} resizeMode="contain" />
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollContent}>
          {/* PASO 1: Reservar Hora Médica */}
          {step === 1 && (
            <View>
              <Text style={styles.screenTitle}>Reservar Hora Médica</Text>

              {/* Buscador */}
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  placeholder="Buscar terapeuta o especialidad..."
                  style={styles.searchInput}
                  placeholderTextColor={colors.text.placeholder}
                />
              </View>

              {/* Categorías Chips */}
              <View style={styles.categoriesRow}>
                {['Todos', 'Salud Mental', 'Nutrición', 'Kinesiología'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, selectedSpecialty === cat && styles.chipActive]}
                    onPress={() => setSelectedSpecialty(cat)}
                  >
                    <Text style={[styles.chipText, selectedSpecialty === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionSub}>Terapeutas disponibles:</Text>

              {/* Lista de Terapeutas */}
              {terapeutasMock.map((item) => (
                <View key={item.id} style={styles.terapeutaCard}>
                  <View style={styles.terapeutaInfo}>
                    <View style={styles.avatarCircle}>
                      <Text style={{ fontSize: 20 }}>👩‍⚕️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.terapeutaName}>{item.name}</Text>
                      <Text style={styles.terapeutaSpec}>{item.specialty}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.verHorariosBtn} onPress={() => handleSelectTerapeuta(item)}>
                    <Text style={styles.verHorariosBtnText}>Ver Horarios</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* PASO 2: Selecciona Fecha y Hora */}
          {step === 2 && selectedTerapeuta && (
            <View>
              <Text style={styles.screenTitle}>Selecciona Fecha y Hora</Text>

              {/* Card Terapeuta Seleccionado */}
              <View style={styles.selectedTerapeutaCard}>
                <View style={styles.avatarCircle}>
                  <Text style={{ fontSize: 20 }}>👩‍⚕️</Text>
                </View>
                <View>
                  <Text style={styles.terapeutaName}>{selectedTerapeuta.name}</Text>
                  <Text style={styles.terapeutaSpec}>{selectedTerapeuta.specialty}</Text>
                </View>
              </View>

              {/* Calendario Fila */}
              <Text style={styles.calendarMonth}>Septiembre 2026</Text>
              <View style={styles.calendarRow}>
                {[
                  { day: 'Lun', num: 21 },
                  { day: 'Mar', num: 22 },
                  { day: 'Mié', num: 23 },
                  { day: 'Jue', num: 24 },
                  { day: 'Vie', num: 25 },
                ].map((d) => (
                  <TouchableOpacity
                    key={d.num}
                    style={[styles.dayItem, selectedDay === d.num && styles.dayItemActive]}
                    onPress={() => setSelectedDay(d.num)}
                  >
                    <Text style={[styles.dayLabel, selectedDay === d.num && styles.dayLabelActive]}>{d.day}</Text>
                    <Text style={[styles.dayNum, selectedDay === d.num && styles.dayNumActive]}>{d.num}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Grid de Horas */}
              <Text style={styles.sectionSub}>Horas disponibles para el día seleccionado</Text>

              <View style={styles.slotsGrid}>
                {timeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.time}
                    disabled={!slot.available}
                    style={[
                      styles.slotBtn,
                      !slot.available && styles.slotDisabled,
                      selectedSlot === slot.time && slot.available && styles.slotActive,
                    ]}
                    onPress={() => setSelectedSlot(slot.time)}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        !slot.available && styles.slotTextDisabled,
                        selectedSlot === slot.time && slot.available && styles.slotTextActive,
                      ]}
                    >
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleConfirmAppointment}>
                <Text style={styles.primaryActionBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PASO 3: Cita Confirmada con Éxito */}
          {step === 3 && (
            <View style={{ alignItems: 'center', paddingTop: 20 }}>
              <View style={styles.successIconCircle}>
                <Text style={{ fontSize: 36, color: '#FFFFFF' }}>✓</Text>
              </View>

              <Text style={styles.screenTitle}>¡Cita Confirmada con Éxito!</Text>

              <View style={styles.confirmationCard}>
                <Text style={styles.confirmHeader}>Detalles de la Cita:</Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Especialista: </Text>
                  {selectedTerapeuta?.name}
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Especialidad: </Text>
                  {selectedTerapeuta?.specialty}
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Fecha: </Text>
                  Miércoles {selectedDay} de Septiembre
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Horario: </Text>
                  {selectedSlot} hrs
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Lugar: </Text>
                  Centro Chawal Quillota (Presencial)
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>Paciente: </Text>
                  Juan Pérez
                </Text>
                <Text style={styles.confirmStatus}>Estado: Confirmada</Text>
              </View>

              <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setStep(1)}>
                <Text style={styles.primaryActionBtnText}>Simular Pago</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryActionBtn} onPress={onBack}>
                <Text style={styles.secondaryActionBtnText}>Volver al Inicio</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: colors.neutral.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: -2 },
  logoIcon: { width: 36, height: 36 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginVertical: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 14, color: colors.text.primary },
  categoriesRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: '#FFFFFF' },
  sectionSub: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: 12 },
  terapeutaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  terapeutaInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  terapeutaName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  terapeutaSpec: { fontSize: 13, color: colors.text.secondary },
  verHorariosBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  verHorariosBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  selectedTerapeutaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: 20,
  },
  calendarMonth: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 12, textAlign: 'center' },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  dayItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  dayItemActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  dayLabel: { fontSize: 12, color: colors.text.secondary },
  dayLabelActive: { color: '#FFFFFF' },
  dayNum: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  dayNumActive: { color: '#FFFFFF' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  slotBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary.main,
    alignItems: 'center',
  },
  slotActive: { backgroundColor: colors.primary.main },
  slotDisabled: { borderColor: colors.neutral.border, backgroundColor: '#F1F5F9' },
  slotText: { fontSize: 14, fontWeight: '600', color: colors.primary.main },
  slotTextActive: { color: '#FFFFFF' },
  slotTextDisabled: { color: colors.text.disabled, textDecorationLine: 'line-through' },
  primaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryActionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  secondaryActionBtnText: { color: colors.text.primary, fontWeight: '600', fontSize: 14 },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: 20,
  },
  confirmHeader: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 10 },
  confirmLine: { fontSize: 14, color: colors.text.primary, marginBottom: 6 },
  confirmStatus: { fontSize: 14, fontWeight: '700', color: colors.primary.main, marginTop: 10 },
});

export default AppointmentBookingScreen;
