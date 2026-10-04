/**
 * Helper para formatear fechas a estándar chileno (dd/mm/yyyy)
 */
export const formatDateCL = (dateString) => {
  if (!dateString) return '';

  // Si viene en ISO (YYYY-MM-DD) o con timestamp
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');

  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }

  return dateString;
};
