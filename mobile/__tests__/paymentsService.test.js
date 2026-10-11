import paymentsService from '../src/services/paymentsService';

describe('paymentsService (US-16)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('procesa simulación de pago exitosa retornando código de operación transaccional', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          referencia: '#TX-84920-CH',
          monto: 25000,
          fecha_pago: '2026-10-07T18:00:00.000Z',
        },
      }),
    });

    const res = await paymentsService.simulatePayment(1, {
      monto: 25000,
      metodoPago: 'WEBPAY',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
    expect(res.amount).toBe(25000);
    expect(res.operationCode).toBe('#TX-84920-CH');
  });

  it('propaga error cuando la simulación de pago falla en el servidor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        message: 'Monto inválido para simulación',
      }),
    });

    const res = await paymentsService.simulatePayment(1, { monto: -10 });

    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
    expect(res.message).toContain('Monto inválido');
  });

  it('procesa la liberación del bloque horario en cancelación (Escenario 2 Gherkin)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Bloque liberado con éxito',
      }),
    });

    const res = await paymentsService.cancelAppointmentHold(1);

    expect(res.success).toBe(true);
    expect(res.message).toBe('Bloque liberado con éxito');
  });
});
