// =====================================================================
//  S.A.P.C. — CHAWAL  |  Prueba manual de Agendas / Bloques (US-07)
//  Archivo: backend/test-agendas.js
// =====================================================================
//  Uso:
//    1. Arrancar la API en otra terminal:  npm run dev
//    2. Ejecutar este script:              node test-agendas.js
//
//  Requiere Node 18+ (usa fetch nativo).
// =====================================================================

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

let tokenAdmin = null;
let tokenPaciente = null;

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
  console.log(`\nProbando US-07 en: ${BASE}\n`);
  console.log('─'.repeat(100));

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  // -------------------------------------------------------------------
  // 0. Tokens
  // -------------------------------------------------------------------
  const loginAdmin = await req('POST', '/auth/login', {
    email: 'admin@chawal.cl', password: 'Password2026!'
  });
  tokenAdmin = loginAdmin.data?.token;
  check(loginAdmin.status === 200 && !!tokenAdmin, 'Login admin (precondición)', `status=${loginAdmin.status}`);

  const loginPac = await req('POST', '/auth/login', {
    email: 'pedro.gonzalez@mail.cl', password: 'Password2026!'
  });
  tokenPaciente = loginPac.data?.token;
  check(loginPac.status === 200 && !!tokenPaciente, 'Login paciente (precondición)', `status=${loginPac.status}`);

  // -------------------------------------------------------------------
  // 1. Seguridad
  // -------------------------------------------------------------------
  const sinToken = await req('GET', '/agendas/1?fecha=2026-10-05');
  check(sinToken.status === 401, 'GET /agendas sin token -> 401', `status=${sinToken.status}`);

  const rolInsuf = await req('POST', '/agendas', { id_profesional: 1 }, tokenPaciente);
  check(rolInsuf.status === 403, 'POST /agendas como PACIENTE -> 403', `status=${rolInsuf.status}`);

  // -------------------------------------------------------------------
  // 2. Escenario 1 — Consulta de disponibilidad
  // -------------------------------------------------------------------
  // 2026-10-05 = Lunes. Prof 1 tiene bloque 09:00-13:00 (aforo 1)
  // y 2 citas vigentes que lo solapan -> disponible = 0
  const lleno = await req('GET', '/agendas/1?fecha=2026-10-05', null, tokenAdmin);
  check(lleno.status === 200, 'GET disponibilidad (Lunes con citas)', `status=${lleno.status}`);
  check(lleno.data?.data?.dia_semana === 1, 'dia_semana = 1 (Lunes)', `valor=${lleno.data?.data?.dia_semana}`);
  check(lleno.data?.data?.bloques?.length === 1, 'Devuelve 1 bloque', `n=${lleno.data?.data?.bloques?.length}`);
  check(lleno.data?.data?.bloques?.[0]?.disponible === 0, 'Bloque ocupado -> disponible=0', `ocupados=${lleno.data?.data?.bloques?.[0]?.ocupados}`);
  check(lleno.data?.data?.bloques?.[0]?.cupos_libres === 0, 'cupos_libres = 0', `valor=${lleno.data?.data?.bloques?.[0]?.cupos_libres}`);

  // 2026-10-12 = Lunes sin citas -> disponible = 1
  const libre = await req('GET', '/agendas/1?fecha=2026-10-12', null, tokenAdmin);
  check(libre.status === 200, 'GET disponibilidad (Lunes sin citas)', `status=${libre.status}`);
  check(libre.data?.data?.bloques?.[0]?.disponible === 1, 'Bloque libre -> disponible=1', `ocupados=${libre.data?.data?.bloques?.[0]?.ocupados}`);

  // 2026-10-10 = Sábado. Bloque grupal aforo 3 con 2 citas -> disponible = 1
  const grupal = await req('GET', '/agendas/1?fecha=2026-10-10', null, tokenAdmin);
  check(grupal.status === 200, 'GET disponibilidad (Sábado grupal)', `status=${grupal.status}`);
  check(grupal.data?.data?.bloques?.[0]?.aforo_maximo === 3, 'aforo_maximo = 3', `valor=${grupal.data?.data?.bloques?.[0]?.aforo_maximo}`);
  check(grupal.data?.data?.bloques?.[0]?.ocupados === 2, 'ocupados = 2', `valor=${grupal.data?.data?.bloques?.[0]?.ocupados}`);
  check(grupal.data?.data?.bloques?.[0]?.disponible === 1, 'Grupal con cupo -> disponible=1', `cupos_libres=${grupal.data?.data?.bloques?.[0]?.cupos_libres}`);

  // Día sin bloques (2026-10-07 = Miércoles, prof 2 no atiende miércoles)
  const sinBloques = await req('GET', '/agendas/2?fecha=2026-10-07', null, tokenAdmin);
  check(sinBloques.status === 200 && sinBloques.data?.count === 0, 'Día sin bloques -> count=0', `count=${sinBloques.data?.count}`);

  // -------------------------------------------------------------------
  // 3. Errores del Escenario 1
  // -------------------------------------------------------------------
  const noExiste = await req('GET', '/agendas/99999?fecha=2026-10-05', null, tokenAdmin);
  check(noExiste.status === 404 && noExiste.data?.error === 'RESOURCE_NOT_FOUND', 'Terapeuta inexistente -> 404', `status=${noExiste.status}`);

  const sinFecha = await req('GET', '/agendas/1', null, tokenAdmin);
  check(sinFecha.status === 400 && sinFecha.data?.error === 'VALIDATION_ERROR', 'Sin fecha -> 400', `status=${sinFecha.status}`);

  const fechaMala = await req('GET', '/agendas/1?fecha=05-10-2026', null, tokenAdmin);
  check(fechaMala.status === 400, 'Fecha mal formateada -> 400', `status=${fechaMala.status}`);

  const idMalo = await req('GET', '/agendas/abc?fecha=2026-10-05', null, tokenAdmin);
  check(idMalo.status === 400, 'terapeutaId no numérico -> 400', `status=${idMalo.status}`);

  // -------------------------------------------------------------------
  // 4. Escenario 2 — Generación masiva
  // -------------------------------------------------------------------
  // Prof 2 (Matías) atiende Martes y Jueves. Rango Vie-Sáb-Dom (días 5,6,7)
  // no colisiona con sus bloques existentes.
  const payload = {
    id_profesional: 2,
    fecha_inicio: '2026-10-09',
    fecha_fin: '2026-10-11',
    hora_inicio: '09:00',
    hora_fin: '11:00',
    duracion_minutos: 30,
    aforo_maximo: 1
  };

  const generado = await req('POST', '/agendas', payload, tokenAdmin);
  check(generado.status === 201, 'POST /agendas -> 201', `status=${generado.status}`);
  check(generado.data?.data?.dias_cubiertos?.length === 3, 'Cubre 3 días (Vie/Sáb/Dom)', `n=${generado.data?.data?.dias_cubiertos?.length}`);
  check(
    (generado.data?.data?.bloques_creados ?? 0) + (generado.data?.data?.bloques_omitidos ?? 0) === 12,
    'Total slots = 12 (3 días x 4 slots)',
    `creados=${generado.data?.data?.bloques_creados}, omitidos=${generado.data?.data?.bloques_omitidos}`
  );
  check(generado.data?.data?.minutos_sobrantes === 0, 'minutos_sobrantes = 0', `valor=${generado.data?.data?.minutos_sobrantes}`);

  // Re-ejecutar el mismo POST -> todo omitido (idempotencia del UNIQUE)
  const repetido = await req('POST', '/agendas', payload, tokenAdmin);
  check(repetido.status === 201, 'POST repetido -> 201', `status=${repetido.status}`);
  check(repetido.data?.data?.bloques_creados === 0, 'Repetido: 0 creados', `creados=${repetido.data?.data?.bloques_creados}`);
  check(repetido.data?.data?.bloques_omitidos === 12, 'Repetido: 12 omitidos', `omitidos=${repetido.data?.data?.bloques_omitidos}`);

  // Duración que no divide la ventana -> minutos_sobrantes > 0
  const sobrante = await req('POST', '/agendas', {
    ...payload,
    id_profesional: 3,
    fecha_inicio: '2026-10-12',
    fecha_fin: '2026-10-12',
    hora_inicio: '09:00',
    hora_fin: '11:00',
    duracion_minutos: 45
  }, tokenAdmin);
  check(sobrante.status === 201, 'POST duración no divisible -> 201', `status=${sobrante.status}`);
  check(sobrante.data?.data?.minutos_sobrantes === 30, 'minutos_sobrantes = 30', `valor=${sobrante.data?.data?.minutos_sobrantes}`);
  check(
    (sobrante.data?.data?.bloques_creados ?? 0) + (sobrante.data?.data?.bloques_omitidos ?? 0) === 2,
    'Total slots = 2 (45 min en ventana de 120)',
    `creados=${sobrante.data?.data?.bloques_creados}, omitidos=${sobrante.data?.data?.bloques_omitidos}`
  );

  // -------------------------------------------------------------------
  // 5. Errores del Escenario 2
  // -------------------------------------------------------------------
  const faltantes = await req('POST', '/agendas', { id_profesional: 1 }, tokenAdmin);
  check(faltantes.status === 400 && faltantes.data?.error === 'VALIDATION_ERROR', 'POST sin campos -> 400', `status=${faltantes.status}`);

  const rangoInvalido = await req('POST', '/agendas', {
    ...payload, fecha_inicio: '2026-10-20', fecha_fin: '2026-10-10'
  }, tokenAdmin);
  check(rangoInvalido.status === 400, 'fecha_fin < fecha_inicio -> 400', `status=${rangoInvalido.status}`);

  const horaInvalida = await req('POST', '/agendas', {
    ...payload, hora_inicio: '11:00', hora_fin: '09:00'
  }, tokenAdmin);
  check(horaInvalida.status === 400, 'hora_fin <= hora_inicio -> 400', `status=${horaInvalida.status}`);

  const duracionExcesiva = await req('POST', '/agendas', {
    ...payload, duracion_minutos: 300
  }, tokenAdmin);
  check(duracionExcesiva.status === 400, 'duración > ventana -> 400', `status=${duracionExcesiva.status}`);

  const profInexistente = await req('POST', '/agendas', {
    ...payload, id_profesional: 99999
  }, tokenAdmin);
  check(profInexistente.status === 404, 'Profesional inexistente -> 404', `status=${profInexistente.status}`);

  const aforoInvalido = await req('POST', '/agendas', {
    ...payload, aforo_maximo: 0
  }, tokenAdmin);
  check(aforoInvalido.status === 400, 'aforo_maximo = 0 -> 400', `status=${aforoInvalido.status}`);

  // -------------------------------------------------------------------
  console.log('─'.repeat(100));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  console.log('NOTA: este script crea bloques de prueba. Re-ejecuta seed.sql para limpiar.\n');

  process.exit(fail === 0 ? 0 : 1);
})();
