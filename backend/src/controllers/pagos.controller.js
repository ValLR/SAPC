// =====================================================================
//  S.A.P.C. — CHAWAL  |  Controlador de Pagos (simulación de transacción)
//  Archivo: backend/src/controllers/pagos.controller.js
//  Ticket: FIX-02 (Refix US-16 — cierre del flujo de reserva móvil)
// =====================================================================
//  Contexto: la app móvil (mobile/src/services/paymentsService.js) llama a
//  `POST /api/pagos/simular` y, si recibe 404, fabrica la respuesta en el
//  cliente ("fallback transitorio mientras backend habilita
//  /api/pagos/simular"). Este controlador cierra ese hueco: la simulación
//  la resuelve el servidor y el cliente deja de inventar el resultado.
//
//  DECISIÓN — es un SIMULADOR: no persiste nada en `pagos`.
//    · El AC pide un "código de referencia ficticio" y el endpoint se llama
//      `simular`: no corresponde escribir una transacción financiera.
//    · Persistir exigiría un `id_cita` (o `id_inscripcion_clase`) real por el
//      CHECK `chk_pago_servicio_exclusivo`, y `uq_pagos_cita` es 1:1, así que
//      simular dos veces la misma cita reventaría con duplicado.
//    · Un pago real (con persistencia, verificación de que la cita existe y
//      pertenece al paciente) sería OTRO endpoint: `POST /api/pagos`.
//
//  Consecuencia buscada: este controlador NO consulta la base de datos.
//  Valida la carga útil y responde una transacción simulada; no depende de
//  MySQL, que es justo lo que se espera de una pasarela en modo pruebas.
// =====================================================================

const crypto = require('node:crypto');

/**
 * Métodos aceptados = los del ENUM `pagos.metodo_pago` + los de la pasarela
 * simulada. ⚠️ No se valida contra el ENUM de la BD a propósito: el móvil
 * envía por defecto `DEBITO_SIMULADO`, que no es un valor del ENUM.
 */
const METODOS_ACEPTADOS = [
  'EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'SEGURO',
  'DEBITO_SIMULADO', 'CREDITO_SIMULADO', 'WEBPAY'
];

const MONTO_MAXIMO = 10_000_000;  // techo defensivo para una simulación
const MONEDA = 'CLP';             // valor por defecto de configuracion('pagos.moneda')

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

/** Código de referencia ficticio con el formato del AC: `#TX-12345-CH`. */
const generarReferencia = () => `#TX-${crypto.randomInt(10000, 100000)}-CH`;

/**
 * Valida la carga útil del pago simulado.
 * Acepta los alias que usa el cliente móvil (`citaId`, `metodoPago`) y los
 * nombres snake_case del dominio (`id_cita`, `metodo_pago`).
 * @returns {{detalles: Array, idCita: number, monto: number, metodo: string|null}}
 */
const validarPago = (body) => {
  const datos = body && typeof body === 'object' ? body : {};
  const detalles = [];

  // --- Cita a pagar ---
  const idCita = datos.citaId ?? datos.id_cita;
  if (idCita === undefined || idCita === null || idCita === '') {
    detalles.push({ field: 'citaId', issue: 'requerido (id de la cita que se paga)' });
  } else if (!Number.isInteger(Number(idCita)) || Number(idCita) <= 0) {
    detalles.push({ field: 'citaId', issue: 'debe ser un entero positivo' });
  }

  // --- Monto ---
  const monto = Number(datos.monto);
  if (datos.monto === undefined || datos.monto === null || datos.monto === '') {
    detalles.push({ field: 'monto', issue: 'requerido' });
  } else if (!Number.isFinite(monto) || monto <= 0) {
    detalles.push({ field: 'monto', issue: 'debe ser un número mayor que 0' });
  } else if (monto > MONTO_MAXIMO) {
    detalles.push({ field: 'monto', issue: `no puede superar ${MONTO_MAXIMO}` });
  }

  // --- Método de pago ---
  const metodo = datos.metodoPago ?? datos.metodo_pago ?? datos.metodo;
  if (metodo === undefined || metodo === null || metodo === '') {
    detalles.push({ field: 'metodoPago', issue: 'requerido' });
  } else if (typeof metodo !== 'string' || !METODOS_ACEPTADOS.includes(metodo.toUpperCase())) {
    detalles.push({ field: 'metodoPago', issue: `debe ser uno de: ${METODOS_ACEPTADOS.join(', ')}` });
  }

  return {
    detalles,
    idCita: Number(idCita),
    monto,
    metodo: typeof metodo === 'string' ? metodo.toUpperCase() : null
  };
};

// ---------------------------------------------------------------------
//  POST /api/pagos/simular   (solo PACIENTE)
//
//  Escenario 1 del AC (FIX-02) -> 200 con mensaje de éxito y código de
//  referencia ficticio. El rol lo aplica `requireRole` en la ruta (US-03).
// ---------------------------------------------------------------------
const simularPago = (req, res) => {
  const { detalles, idCita, monto, metodo } = validarPago(req.body);

  if (detalles.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Datos de pago inválidos',
      error: 'VALIDATION_ERROR',
      details: detalles
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Pago simulado procesado con éxito',
    data: {
      id_cita: idCita,
      monto: Math.round(monto * 100) / 100,
      moneda: MONEDA,
      metodo_pago: metodo,
      estado_pago: 'PAGADO',
      referencia: generarReferencia(),
      fecha_pago: new Date().toISOString(),
      // Marca explícita de que NO es una transacción real ni persistida.
      simulado: true
    }
  });
};

module.exports = {
  simularPago,
  METODOS_ACEPTADOS
};
