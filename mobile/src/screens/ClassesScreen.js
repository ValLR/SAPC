import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import classesService from '../services/classesService';
import ClassCard from '../components/ClassCard';
import colors from '../theme/colors';

const LOGO_ICON = require('../../assets/logo-icon.png');

export const ClassesScreen = ({ onBack }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Confirmation modal state
  const [selectedClass, setSelectedClass] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ['Todos', 'Yoga', 'Pilates', 'Cardio'];

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    const res = await classesService.getClasses();
    if (res.success) {
      setClasses(res.data);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const handleSelectClass = (item) => {
    setSelectedClass(item);
  };

  const handleConfirmReservation = async () => {
    if (!selectedClass) return;
    setIsSubmitting(true);

    const res = await classesService.reserveClass(selectedClass.id_class || selectedClass.id_clase);

    setIsSubmitting(false);
    setSelectedClass(null);

    if (res.success) {
      Alert.alert('Inscripción Exitosa', 'Tu cupo ha sido reservado correctamente.');
      await loadClasses(); // Actualización en tiempo real de aforos
    } else {
      Alert.alert('Aforo Completo', res.message || 'La clase ya no cuenta con cupos disponibles.');
      await loadClasses();
    }
  };

  const filteredClasses = classes.filter((item) => {
    if (selectedCategory === 'Todos') return true;
    const cat = item.category || item.categoria || '';
    const name = item.title || item.nombre_actividad || '';
    return cat.toLowerCase().includes(selectedCategory.toLowerCase()) ||
           name.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Header with logo icon */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Image source={LOGO_ICON} style={styles.logoIcon} resizeMode="contain" />
          <View style={{ width: 40 }} />
        </View>

        {/* Título de la vista */}
        <Text style={styles.screenTitle}>Talleres y Clases</Text>

        {/* Filtro por Chips (Todos, Yoga, Pilates, Cardio) */}
        <View style={styles.categoriesContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista de Tarjetas de Clases */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.loadingText}>Cargando catálogo y aforos...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredClasses}
            keyExtractor={(item) => (item.id_class || item.id_clase || Math.random()).toString()}
            renderItem={({ item }) => (
              <ClassCard item={item} onSelect={handleSelectClass} />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary.main]} />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay clases disponibles en esta categoría.</Text>
            }
          />
        )}

        {/* Enrollment confirmation modal */}
        <Modal visible={Boolean(selectedClass)} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconContainer}>
                <Text style={{ fontSize: 32 }}>📅</Text>
              </View>

              <Text style={styles.modalTitle}>Confirmar Inscripción</Text>

              {selectedClass && (
                <View style={styles.modalDetails}>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Taller: </Text>
                    {selectedClass.title || selectedClass.nombre_actividad}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Instructor: </Text>
                    {selectedClass.instructor}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Fecha: </Text>
                    {selectedClass.fecha_clase || 'Martes 22 de Septiembre'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Horario: </Text>
                    {selectedClass.start_time?.substring(0, 5) || '18:00'} - {selectedClass.end_time?.substring(0, 5) || '19:15'} hrs
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Ubicación: </Text>
                    {selectedClass.location || 'Sala 1 (Planta Baja)'}
                  </Text>

                  <Text style={styles.noteText}>
                    Nota: Se reservará 1 cupo a tu nombre.
                  </Text>
                </View>
              )}

              {/* Botón Confirmar mi Cupo */}
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmReservation}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirmar mi Cupo</Text>
                )}
              </TouchableOpacity>

              {/* Botón Cancelar */}
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedClass(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginVertical: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 40,
  },
  /* Modal Overlay Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  modalDetails: {
    width: '100%',
    marginBottom: 20,
  },
  detailLine: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 6,
  },
  detailLabel: {
    fontWeight: '700',
  },
  noteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text.secondary,
    marginTop: 8,
  },
  modalConfirmBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelBtn: {
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});

export default ClassesScreen;
