import storageService from './storageService';
import { API_BASE_URL } from './apiConfig';

export const paymentsService = {
  /**
   * Simula la transacción de pago para una reserva médica
   */
  async simulatePayment(citaId, paymentData = {}) {
    try {
      const token = await storageService.getToken();
      const response = await fetch(`${API_BASE_URL}/pagos/simular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          citaId,
          id_cita: citaId,
          monto: paymentData.monto || 25000,
          metodoPago: paymentData.metodoPago || 'WEBPAY',
          metodo_pago: paymentData.metodoPago || 'WEBPAY',
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        return {
          success: false,
          status: response.status,
          message: data.message || `Error en el servidor al procesar el pago (${response.status})`,
          error: data.error || 'PAYMENT_ERROR',
        };
      }

      return {
        success: true,
        status: 200,
        operationCode: data.data?.referencia || data.operationCode || `#TX-${Math.floor(10000 + Math.random() * 90000)}-CH`,
        transactionDate: data.data?.fecha_pago || new Date().toISOString(),
        amount: data.data?.monto || paymentData.monto || 25000,
        paymentMethod: paymentData.metodoPago || 'WEBPAY',
        message: data.message || 'Pago simulado procesado con éxito',
      };
    } catch (err) {
      return {
        success: false,
        status: 500,
        message: 'Sin conexión con el servidor de pagos. Verifica tu red e inténtalo nuevamente.',
        error: err.message || 'NETWORK_ERROR',
      };
    }
  },

  /**
   * Invoca la cancelación / liberación de la cita en el backend.
   */
  async cancelAppointmentHold(citaId) {
    if (!citaId) {
      return { success: true, message: 'Sin reserva activa para liberar' };
    }
    try {
      const token = await storageService.getToken();
      const response = await fetch(`${API_BASE_URL}/citas/${citaId}/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        return {
          success: false,
          status: response.status,
          message: data.message || `Error al cancelar la cita (${response.status})`,
          error: data.error || 'CANCEL_ERROR',
        };
      }

      return {
        success: true,
        status: 200,
        message: data.message || 'Bloque liberado con éxito',
      };
    } catch (err) {
      return {
        success: false,
        status: 500,
        message: 'Error de conexión al intentar liberar la cita.',
        error: err.message || 'NETWORK_ERROR',
      };
    }
  },
};

export default paymentsService;
