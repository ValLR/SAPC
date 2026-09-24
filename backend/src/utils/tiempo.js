// =====================================================================
//  S.A.P.C. — CHAWAL  |  Helpers de fecha y hora (dominio)
//  Archivo: backend/src/utils/tiempo.js
// =====================================================================
//  Módulo compartido para las validaciones de fecha/hora de la API.
//  Es al tiempo lo que `src/utils/roles.js` es a los roles: un único
//  lugar donde vive el vocabulario del dominio.
//
//  ⚠️ Las reglas son más estrictas que las copias locales que aún viven
//  en `clases.controller.js` y `agendas.controller.js`: aquí además se
//  valida el RANGO (00-23 h, 00-59 min), así que "25:00" o "09:75" se
//  rechazan en vez de normalizarse a una hora imposible.
//  Pendiente (fuera de US-05): migrar esos dos controladores a este módulo.
// =====================================================================

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida formato YYYY-MM-DD y que sea una fecha real (no 2026-02-30). */
const esFechaISO = (valor) => {
  if (typeof valor !== 'string' || !RE_FECHA_ISO.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
};

// "9:30", "09:30" y "09:30:00" son válidos; "25:00" o "09:60" no.
const RE_HORA = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "09:30" o "09:30:00" -> minutos desde medianoche. NaN si es inválida. */
const horaAMinutos = (hora) => {
  if (typeof hora !== 'string' || !RE_HORA.test(hora.trim())) return NaN;
  const [hh, mm] = hora.trim().split(':');
  return Number(hh) * 60 + Number(mm);
};

/** Normaliza "9:30" -> "09:30:00". Devuelve null si la hora es inválida. */
const normalizarHora = (hora) => {
  const min = horaAMinutos(hora);
  if (Number.isNaN(min)) return null;
  const hh = String(Math.floor(min / 60)).padStart(2, '0');
  const mm = String(min % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

module.exports = {
  esFechaISO,
  horaAMinutos,
  normalizarHora
};
