// =====================================================================
//  S.A.P.C. — CHAWAL  |  Prueba manual del login (US-01 / SCRUM-9)
//  Archivo: backend/test-login.js
// =====================================================================
//  Uso:
//    1. Arrancar la API en otra terminal:  npm run dev
//    2. Ejecutar este script:              node test-login.js
//
//  Requiere Node 18+ (usa fetch nativo).
// =====================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000/api/auth/login';

const casos = [
  { n: 1, desc: 'Admin (éxito)',            email: 'admin@chawal.cl',        password: 'Password2026!', status: 200, error: null,                  rol: 'ADMINISTRADOR' },
  { n: 2, desc: 'Terapeuta (éxito)',        email: 'camila.rojas@chawal.cl', password: 'Password2026!', status: 200, error: null,                  rol: 'TERAPEUTA' },
  { n: 3, desc: 'Paciente (éxito)',         email: 'pedro.gonzalez@mail.cl', password: 'Password2026!', status: 200, error: null,                  rol: 'PACIENTE' },
  { n: 4, desc: 'Password incorrecta',      email: 'admin@chawal.cl',        password: 'malapassword',  status: 401, error: 'INVALID_CREDENTIALS', rol: null },
  { n: 5, desc: 'Email inexistente',        email: 'noexiste@chawal.cl',     password: 'Password2026!', status: 401, error: 'INVALID_CREDENTIALS', rol: null },
  { n: 6, desc: 'Sin credenciales',         email: null,                     password: null,            status: 400, error: 'MISSING_CREDENTIALS', rol: null },
];

(async () => {
  console.log(`\nProbando login en: ${BASE_URL}\n`);
  console.log('─'.repeat(78));

  let ok = 0;
  let fail = 0;

  for (const c of casos) {
    const body = {};
    if (c.email !== null)    body.email = c.email;
    if (c.password !== null) body.password = c.password;

    let status, data;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = res.status;
      data = await res.json();
    } catch (e) {
      console.log(`ERROR | Caso ${c.n} | ${c.desc} | no se pudo conectar: ${e.message}`);
      fail++;
      continue;
    }

    const statusOk = status === c.status;
    const errorOk  = c.error === null ? data.error === undefined : data.error === c.error;
    const rolOk    = c.rol   === null ? true : data.user?.rol === c.rol;
    const passed   = statusOk && errorOk && rolOk;

    if (passed) ok++; else fail++;

    const detalle = data.error || data.user?.rol || data.message || '';
    console.log(
      `${passed ? 'OK   ' : 'FALLA'} | Caso ${c.n} | ${String(status).padEnd(3)} | ` +
      `${c.desc.padEnd(22)} | ${detalle}`
    );

    if (!passed) {
      console.log(`        esperado: status=${c.status} error=${c.error ?? '-'} rol=${c.rol ?? '-'}`);
    }
  }

  console.log('─'.repeat(78));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${casos.length} casos\n`);

  process.exit(fail === 0 ? 0 : 1);
})();
