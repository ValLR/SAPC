import paymentsService from '../src/services/paymentsService';

describe('paymentsService (US-16)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('procesa simulación de pago exitosa retornando código de operación transaccional', async () => {
    const res = await paymentsService.simulatePayment(1, {
      monto: 25000,
      metodoPago: 'WEBPAY',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
    expect(res.amount).toBe(25000);
    expect(res.operationCode).toMatch(/^#TX-\d+-CH$/);
  });

  it('procesa la liberación del bloque horario en cancelación (Escenario 2 Gherkin)', async () => {
    const res = await paymentsService.cancelAppointmentHold(1);

    expect(res.success).toBe(true);
    expect(res.message).toBeDefined();
  });
});
