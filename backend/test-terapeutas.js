// =====================================================================
//  S.A.P.C. — CHAWAL  |  Prueba manual del CRUD de terapeutas (US-13)
//  Archivo: backend/test-terapeutas.js
// =====================================================================
//  Uso:
//    1. Arrancar la API en otra terminal:  npm run dev
//    2. Ejecutar este script:              node test-terapeutas.js
//
//  Requiere Node 18+ (usa fetch nativo).
// =====================================================================

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

let tokenAdmin = null;
let tokenPaciente = null;
let idCreado = null;

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(46)} | ${detalle}`);

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
  console.log(`\nProbando US-13 en: ${BASE}\n`);
  console.log('─'.repeat(90));

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  // -------------------------------------------------------------------
  // 0. Obtener tokens
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
  // 1. Catálogo de especialidades
  // -------------------------------------------------------------------
  const esp = await req('GET', '/especialidades', null, tokenAdmin);
  check(esp.status === 200 && Array.isArray(esp.data?.data), 'GET /especialidades', `status=${esp.status}, count=${esp.data?.count}`);

  // -------------------------------------------------------------------
  // 2. Seguridad: sin token / rol insuficiente
  // -------------------------------------------------------------------
  const sinToken = await req('GET', '/terapeutas');
  check(sinToken.status === 401, 'GET /terapeutas sin token -> 401', `status=${sinToken.status}`);

  const rolInsuf = await req('POST', '/terapeutas', { rut: 'x' }, tokenPaciente);
  check(rolInsuf.status === 403, 'POST /terapeutas como PACIENTE -> 403', `status=${rolInsuf.status}`);

  // -------------------------------------------------------------------
  // 3. Escenario 2: listar terapeutas (seed)
  // -------------------------------------------------------------------
  const lista = await req('GET', '/terapeutas', null, tokenAdmin);
  check(lista.status === 200 && lista.data?.count === 3, 'GET /terapeutas (3 del seed)', `status=${lista.status}, count=${lista.data?.count}`);
  check(
    Array.isArray(lista.data?.data?.[0]?.especialidades) && lista.data.data[0].especialidades.length > 0,
    'Terapeuta incluye especialidades anidadas',
    `ej: ${lista.data?.data?.[0]?.especialidades?.map(e => e.nombre).join(', ')}`
  );
  check(
    lista.data?.data?.[0]?.titulo_profesional !== undefined,
    'Terapeuta incluye titulo_profesional [R19]',
    `ej: ${lista.data?.data?.[0]?.titulo_profesional}`
  );

  // -------------------------------------------------------------------
  // 4. Escenario 1: crear terapeuta
  // -------------------------------------------------------------------
  const nuevo = {
    rut: '17123456-8',
    nombre: 'Andrés',
    apellido: 'Vergara',
    email: 'andres.vergara@chawal.cl',
    telefono: '+56912345678',
    password: 'Chawal2026!',
    numero_registro: 'RNPI-2026-01001',
    titulo_profesional: 'Kinesiólogo',
    anios_experiencia: 6,
    biografia: 'Especialista en rehabilitación deportiva y terapia manual.',
    estado_disponibilidad: 'DISPONIBLE',
    especialidades: [
      { id_especialidad: 1, es_principal: true },
      { id_especialidad: 3, es_principal: false }
    ]
  };

  const creado = await req('POST', '/terapeutas', nuevo, tokenAdmin);
  idCreado = creado.data?.data?.id_profesional;
  check(creado.status === 201 && !!idCreado, 'POST /terapeutas -> 201', `status=${creado.status}, id=${idCreado}`);
  check(creado.data?.data?.especialidades?.length === 2, 'Terapeuta creado con 2 especialidades', `n=${creado.data?.data?.especialidades?.length}`);

  // -------------------------------------------------------------------
  // 5. Errores del Escenario 1
  // -------------------------------------------------------------------
  const faltantes = await req('POST', '/terapeutas', { rut: '99999999-9' }, tokenAdmin);
  check(faltantes.status === 400 && faltantes.data?.error === 'VALIDATION_ERROR', 'POST sin campos -> 400 VALIDATION_ERROR', `status=${faltantes.status}`);

  const duplicado = await req('POST', '/terapeutas', nuevo, tokenAdmin);
  check(duplicado.status === 409 && duplicado.data?.error === 'DUPLICATE_RESOURCE', 'POST duplicado -> 409 DUPLICATE_RESOURCE', `status=${duplicado.status}`);

  const dosPrincipales = await req('POST', '/terapeutas', {
    ...nuevo,
    rut: '18123456-9',
    email: 'otro@chawal.cl',
    numero_registro: 'RNPI-2026-01002',
    especialidades: [
      { id_especialidad: 1, es_principal: true },
      { id_especialidad: 3, es_principal: true }
    ]
  }, tokenAdmin);
  check(dosPrincipales.status === 400, 'POST con 2 principales -> 400', `status=${dosPrincipales.status}`);

  // -------------------------------------------------------------------
  // 6. Escenario 3: actualizar terapeuta
  // -------------------------------------------------------------------
  const actualizado = await req('PUT', `/terapeutas/${idCreado}`, {
    telefono: '+56987654321',
    titulo_profesional: 'Kinesiólogo Deportivo',
    estado_disponibilidad: 'NO_DISPONIBLE',
    anios_experiencia: 7
  }, tokenAdmin);
  check(actualizado.status === 200, 'PUT /terapeutas/:id -> 200', `status=${actualizado.status}`);
  check(actualizado.data?.data?.estado_disponibilidad === 'NO_DISPONIBLE', 'estado_disponibilidad actualizado', `valor=${actualizado.data?.data?.estado_disponibilidad}`);
  check(actualizado.data?.data?.telefono === '+56987654321', 'telefono actualizado', `valor=${actualizado.data?.data?.telefono}`);

  // Reemplazo de especialidades
  const reemplazo = await req('PUT', `/terapeutas/${idCreado}`, {
    especialidades: [
      { id_especialidad: 2, es_principal: true }
    ]
  }, tokenAdmin);
  check(reemplazo.status === 200 && reemplazo.data?.data?.especialidades?.length === 1, 'PUT reemplaza especialidades', `n=${reemplazo.data?.data?.especialidades?.length}`);

  // -------------------------------------------------------------------
  // 7. Errores del Escenario 3
  // -------------------------------------------------------------------
  const noExiste = await req('PUT', '/terapeutas/99999', { telefono: '+56900000000' }, tokenAdmin);
  check(noExiste.status === 404 && noExiste.data?.error === 'RESOURCE_NOT_FOUND', 'PUT inexistente -> 404', `status=${noExiste.status}`);

  const enumMalo = await req('PUT', `/terapeutas/${idCreado}`, { estado_disponibilidad: 'VACACIONES' }, tokenAdmin);
  check(enumMalo.status === 400, 'PUT enum inválido -> 400', `status=${enumMalo.status}`);

  // -------------------------------------------------------------------
  // 8. Filtros del Escenario 2
  // -------------------------------------------------------------------
  const filtroEsp = await req('GET', '/terapeutas?id_especialidad=2', null, tokenAdmin);
  check(filtroEsp.status === 200, 'GET /terapeutas?id_especialidad=2', `count=${filtroEsp.data?.count}`);

  const filtroActivo = await req('GET', '/terapeutas?activo=true', null, tokenAdmin);
  check(filtroActivo.status === 200, 'GET /terapeutas?activo=true', `count=${filtroActivo.data?.count}`);

  // -------------------------------------------------------------------
  console.log('─'.repeat(90));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  console.log('NOTA: este script crea un terapeuta de prueba. Re-ejecuta seed.sql para limpiar.\n');

  process.exit(fail === 0 ? 0 : 1);
})();
