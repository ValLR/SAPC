// =====================================================================
//  S.A.P.C. — CHAWAL  |  Verificación del bloque correctivo post-merge
//  Archivo: backend/test-correctivo.js  (temporal)
// =====================================================================
//  Verifica:
//    1. GET  /api/classes            -> ya no falla por columnas inexistentes
//    2. POST /api/schedules/publish  -> no destruye bloques (upsert)
//    3. POST /api/schedules/publish  -> requireRole funciona
// =====================================================================

const BASE = 'http://localhost:3000/api';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(50)} | ${detalle}`);

const req = async (metodo, ruta, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin body */ }
  return { status: res.status, data };
};

(async () => {
  console.log(`\nVerificando bloque correctivo en: ${BASE}\n`);
  console.log('─'.repeat(96));

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  // --- Tokens ---
  const admin = await req('POST', '/auth/login', { email: 'admin@chawal.cl', password: 'Password2026!' });
  const tokenAdmin = admin.data?.token;
  const pac = await req('POST', '/auth/login', { email: 'pedro.gonzalez@mail.cl', password: 'Password2026!' });
  const tokenPac = pac.data?.token;
  check(!!tokenAdmin && !!tokenPac, 'Tokens obtenidos', `admin=${admin.status}, pac=${pac.status}`);

  // --- 1. GET /api/classes (antes daba 500 por 'ubicacion'/'categoria') ---
  const clases = await req('GET', '/classes', null, tokenAdmin);
  check(clases.status === 200, 'GET /api/classes -> 200 (sin error 1054)', `status=${clases.status}`);
  check(clases.data?.success === true, 'success = true', `success=${clases.data?.success}`);
  check(Array.isArray(clases.data?.data) && clases.data.data.length >= 3, 'Devuelve talleres', `count=${clases.data?.count}`);
  check(clases.data?.data?.[0]?.location !== undefined, 'Campo location presente', `ej: ${clases.data?.data?.[0]?.location}`);
  check(clases.data?.data?.[0]?.category === undefined, 'Campo category eliminado', `valor=${clases.data?.data?.[0]?.category}`);

  // --- 2. requireRole en /schedules/publish ---
  const pacPublish = await req('POST', '/schedules/publish',
    { days: [1], start_time: '09:00', end_time: '10:00', slot_duration: 30 }, tokenPac);
  check(pacPublish.status === 403, 'PACIENTE publicando -> 403 FORBIDDEN', `status=${pacPublish.status}`);

  // --- 3. publish no destructivo ---
  const payload = { therapist_id: 3, days: [2], start_time: '08:00', end_time: '10:00', slot_duration: 60 };

  const pub1 = await req('POST', '/schedules/publish', payload, tokenAdmin);
  check(pub1.status === 201, 'POST /schedules/publish -> 201', `status=${pub1.status}`);
  check(pub1.data?.count === 2, 'Genera 2 slots de 60 min', `count=${pub1.data?.count}`);

  // Re-publicar: debe ser idempotente (no duplicar, no romper)
  const pub2 = await req('POST', '/schedules/publish', payload, tokenAdmin);
  check(pub2.status === 201, 'Re-publicar -> 201 (idempotente)', `status=${pub2.status}`);
  check(pub2.data?.count === 2, 'Sigue devolviendo 2 slots', `count=${pub2.data?.count}`);

  // Cambiar el rango: los slots viejos deben desaparecer (activo=0) y quedar solo los nuevos
  const pub3 = await req('POST', '/schedules/publish',
    { ...payload, start_time: '08:00', end_time: '09:00' }, tokenAdmin);
  check(pub3.status === 201 && pub3.data?.count === 1, 'Publicar rango menor -> 1 slot', `count=${pub3.data?.count}`);

  const grid = await req('GET', '/schedules?therapistId=3', null, tokenAdmin);
  const martes = (grid.data?.data || []).filter((b) => b.day_of_week === 2);
  check(martes.length === 1, 'Grilla muestra 1 bloque (viejos desactivados)', `n=${martes.length}`);
  check(martes[0]?.start_time === '08:00', 'Bloque vigente empieza 08:00', `start=${martes[0]?.start_time}`);

  // --- 4. reserveClass: detección del SIGNAL 45000 del trigger ---
  // Clase 3 tiene aforo 2. Se intenta inscribir a los 3 pacientes:
  // al menos uno debe rebotar con CLASS_FULL y ninguno debe dar 500.
  const tokensPac = [];
  for (const email of ['pedro.gonzalez@mail.cl', 'ana.munoz@mail.cl', 'luis.perez@mail.cl']) {
    const r = await req('POST', '/auth/login', { email, password: 'Password2026!' });
    if (r.data?.token) tokensPac.push(r.data.token);
  }
  check(tokensPac.length === 3, 'Tokens de 3 pacientes', `n=${tokensPac.length}`);

  const inscripciones = [];
  for (const t of tokensPac) {
    inscripciones.push(await req('POST', '/classes/3/reserve', null, t));
  }

  const statuses = inscripciones.map((r) => r.status);
  const algunLleno = inscripciones.some((r) => r.data?.error === 'CLASS_FULL');
  const algunDuplicado = inscripciones.some((r) => r.data?.error === 'ALREADY_RESERVED');
  const algun500 = inscripciones.some((r) => r.status === 500);
  const llenoResponde400 = inscripciones.some(
    (r) => r.data?.error === 'CLASS_FULL' && r.status === 400
  );

  check(!algun500, 'Ninguna inscripción devolvió 500', `statuses=${statuses.join(',')}`);
  check(algunLleno || algunDuplicado, 'Inscripciones rebotadas con error de negocio', `statuses=${statuses.join(',')}`);
  check(algunLleno, 'Detecta CLASS_FULL (sqlState 45000)', `statuses=${statuses.join(',')}`);
  check(llenoResponde400, 'CLASS_FULL responde 400 (AC US-09)', `statuses=${statuses.join(',')}`);

  // --- 5. Reserva duplicada: UNIQUE uq_paciente_clase ---
  const dup = await req('POST', '/classes/1/reserve', null, tokensPac[0]);
  check(dup.status === 409, 'Inscripción duplicada -> 409 (no 500)', `status=${dup.status}`);
  check(dup.data?.error === 'ALREADY_RESERVED', 'error = ALREADY_RESERVED', `error=${dup.data?.error}`);

  console.log('─'.repeat(96));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
