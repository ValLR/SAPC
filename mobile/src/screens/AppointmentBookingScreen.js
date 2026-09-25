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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import paymentsService from '../services/paymentsService';

const LOGO_ICON = require('../../assets/logo-icon.png');

export const AppointmentBookingScreen = ({ onBack }) => {

  const [step, setStep] = useState(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todos');
  const [selectedTerapeuta, setSelectedTerapeuta] = useState(null);
  const [selectedDay, setSelectedDay] = useState(23); // Mié 23
  const [selectedSlot, setSelectedSlot] = useState('10:00 - 10:45');
  const [paymentMethod, setPaymentMethod] = useState('WEBPAY');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState(null);

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

  const handleGoToCheckout = () => {
    setStep(3);
  };

  const handleCancelCheckout = async () => {
    // Escenario 2 Gherkin: libera el bloque y vuelve al resumen/calendario
    await paymentsService.cancelAppointmentHold(1);
    setStep(2);
  };

  const handleProcessPayment = async () => {
    setIsProcessingPayment(true);

    const res = await paymentsService.simulatePayment(1, {
      monto: 25000,
      metodoPago: paymentMethod,
    });

    setIsProcessingPayment(false);

    if (res.success) {
      setPaymentReceipt(res);
      setStep(4);
    } else {
      Alert.alert('Error de Pago', res.message || 'No se pudo procesar el pago ficticio.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Header con Logo Icon sin letras */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (step === 1) onBack();
              else if (step === 3) handleCancelCheckout();
              else setStep(step - 1);
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
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

              <Text style={styles.sectionTitle}>Terapeutas disponibles:</Text>

              {/* Lista de Terapeutas */}
              {terapeutasMock.map((t) => (
                <View key={t.id} style={styles.terapeutaCard}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ fontSize: 24 }}>👩‍⚕️</Text>
                  </View>
                  <View style={styles.terapeutaInfo}>
                    <Text style={styles.terapeutaName}>{t.name}</Text>
                    <Text style={styles.terapeutaSub}>{t.specialty}</Text>
                    <TouchableOpacity style={styles.btnHorarios} onPress={() => handleSelectTerapeuta(t)}>
                      <Text style={styles.btnHorariosText}>Ver Horarios</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* PASO 2: Selecciona Fecha y Hora */}
          {step === 2 && (
            <View>
              <Text style={styles.screenTitle}>Selecciona Fecha y Hora</Text>

              {/* Card de Terapeuta seleccionado */}
              <View style={styles.selectedHeaderCard}>
                <View style={styles.avatarPlaceholderSmall}>
                  <Text style={{ fontSize: 20 }}>👩‍⚕️</Text>
                </View>
                <View>
                  <Text style={styles.selectedName}>{selectedTerapeuta?.name}</Text>
                  <Text style={styles.selectedSub}>{selectedTerapeuta?.specialty}</Text>
                </View>
              </View>

              {/* Selector Semanal */}
              <View style={styles.weekSelectorHeader}>
                <Text style={styles.monthTitle}>Septiembre 2026</Text>
              </View>

              <View style={styles.daysRow}>
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

              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleGoToCheckout}>
                <Text style={styles.primaryActionBtnText}>Continuar al Pago</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PASO 3: Checkout de Pago Simulado (US-16) */}
          {step === 3 && (
            <View>
              <Text style={styles.screenTitle}>Pago de Consulta Médica</Text>

              {/* Card de Resumen de Arancel */}
              <View style={styles.checkoutSummaryCard}>
                <Text style={styles.checkoutCardTitle}>Resumen de la Cita</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Especialista:</Text>
                  <Text style={styles.detailValue}>{selectedTerapeuta?.name || 'Dra. Camila Morales'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Especialidad:</Text>
                  <Text style={styles.detailValue}>{selectedTerapeuta?.specialty || 'Psicología Clínica'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fecha y Hora:</Text>
                  <Text style={styles.detailValue}>
                    Miércoles {selectedDay} de Septiembre, {selectedSlot} hrs
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Arancel Consulta:</Text>
                  <Text style={styles.priceValue}>$25.000 CLP</Text>
                </View>
              </View>

              {/* Selector de Método de Pago */}
              <Text style={styles.sectionTitle}>Método de Pago Ficticio:</Text>

              <TouchableOpacity
                style={[styles.methodOption, paymentMethod === 'WEBPAY' && styles.methodOptionActive]}
                onPress={() => setPaymentMethod('WEBPAY')}
              >
                <Text style={styles.radioDot}>{paymentMethod === 'WEBPAY' ? '◉' : '◯'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>WebPay / Débito Simulado (Transbank)</Text>
                  <Text style={styles.methodSub}>Simulación instantánea de tarjeta de débito</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodOption, paymentMethod === 'TRANSFER' && styles.methodOptionActive]}
                onPress={() => setPaymentMethod('TRANSFER')}
              >
                <Text style={styles.radioDot}>{paymentMethod === 'TRANSFER' ? '◉' : '◯'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Transferencia Ficticia</Text>
                  <Text style={styles.methodSub}>Validación simulada de transferencia bancaria</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>
                  ℹ️ Entorno de pruebas: No se realizará ningún cargo bancario real a tu cuenta.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleProcessPayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Pagar Reserva ($25.000)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={handleCancelCheckout}
                disabled={isProcessingPayment}
              >
                <Text style={styles.secondaryActionBtnText}>Volver al resumen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PASO 4: Comprobante Visual de Pago y Confirmación (US-16) */}
          {step === 4 && (
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={styles.successIconCircle}>
                <Text style={{ fontSize: 36, color: '#FFFFFF' }}>✓</Text>
              </View>

              <Text style={styles.screenTitle}>¡Cita Confirmada con Éxito!</Text>

              <View style={styles.receiptBadge}>
                <Text style={styles.receiptBadgeText}>Estado: Confirmada / Pagada</Text>
              </View>

              <View style={styles.confirmationCard}>
                <Text style={styles.confirmHeader}>Detalles del Comprobante:</Text>
                <Text style={styles.confirmLine}>
                  <Text style={{ fontWeight: '700' }}>N° Operación: </Text>
                  {paymentReceipt?.operationCode || '#TX-98432-CH'}
                </Text>
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
                  <Text style={{ fontWeight: '700' }}>Monto Pagado: </Text>
                  $25.000 CLP
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setStep(1)}>
                <Text style={styles.primaryActionBtnText}>Reservar Otra Cita</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
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
  backIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: -2,
  },
  logoIcon: {
    width: 36,
    height: 36,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 12,
  },
  terapeutaCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justify.content: 'center',
    marginRight: 12,
  },
  terapeutaInfo: {
    flex: 1,
  },
  terapeutaName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  terapeutaSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  btnHorarios: {
    backgroundColor: colors.primary.main,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  btnHorariosText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  avatarPlaceholderSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  selectedSub: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  weekSelectorHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dayItem: {
    width: 55,
    height: 65,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayItemActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  dayLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  dayLabelActive: {
    color: '#FFFFFF',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  dayNumActive: {
    color: '#FFFFFF',
  },
  sectionSub: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  slotBtn: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary.main,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotActive: {
    backgroundColor: colors.primary.main,
  },
  slotDisabled: {
    borderColor: colors.neutral.border,
    backgroundColor: '#F3F4F6',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.main,
  },
  slotTextActive: {
    color: '#FFFFFF',
  },
  slotTextDisabled: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  /* Estilos de Checkout US-16 */
  checkoutSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: 20,
  },
  checkoutCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary.main,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  methodOptionActive: {
    borderColor: colors.primary.main,
    backgroundColor: '#F0FDFA',
  },
  radioDot: {
    fontSize: 18,
    color: colors.primary.main,
    marginRight: 12,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  methodSub: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  primaryActionBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  successIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  receiptBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  receiptBadgeText: {
    color: '#03543F',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: 20,
  },
  confirmHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },
  confirmLine: {
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: 6,
  },
});

export default AppointmentBookingScreen;
