// =====================================================================
//  S.A.P.C. — CHAWAL  |  Prueba manual de Clases Grupales (US-11)
//  Archivo: backend/test-clases.js
// =====================================================================
//  Uso:
//    1. Arrancar la API en otra terminal:  npm run dev
//    2. Ejecutar este script:              node test-clases.js
//
//  Requiere Node 18+ (usa fetch nativo).
// =====================================================================

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';

let tokenAdmin = null;
let tokenPaciente = null;
let idCreado = null;

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(52)} | ${detalle}`);

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
  console.log(`\nProbando US-11 en: ${BASE}\n`);
  console.log('─'.repeat(104));

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
  const sinToken = await req('GET', '/clases');
  check(sinToken.status === 401, 'GET /clases sin token -> 401', `status=${sinToken.status}`);

  const rolInsuf = await req('POST', '/clases', { nombre_actividad: 'x' }, tokenPaciente);
  check(rolInsuf.status === 403, 'POST /clases como PACIENTE -> 403', `status=${rolInsuf.status}`);

  // -------------------------------------------------------------------
  // 2. Escenario 2 — Listado (seed)
  // -------------------------------------------------------------------
  const lista = await req('GET', '/clases', null, tokenAdmin);
  check(lista.status === 200 && lista.data?.count >= 3, 'GET /clases (>=3 del seed)', `status=${lista.status}, count=${lista.data?.count}`);
  check(lista.data?.data?.[0]?.sala !== undefined, 'Incluye sala [R20]', `ej: ${lista.data?.data?.[0]?.sala}`);
  check(lista.data?.data?.[0]?.instructor !== undefined, 'Incluye instructor', `ej: ${lista.data?.data?.[0]?.instructor}`);
  check(lista.data?.data?.[0]?.reservas_activas !== undefined, 'Incluye reservas_activas', `ej: ${lista.data?.data?.[0]?.reservas_activas}`);

  // Clase 1: aforo 3, 2 reservas -> cupos 1
  const clase1 = lista.data?.data?.find((c) => c.id_clase === 1);
  check(clase1?.aforo_maximo === 3, 'Clase 1: aforo_maximo = 3', `valor=${clase1?.aforo_maximo}`);
  check(clase1?.cupos_disponibles === 1, 'Clase 1: cupos_disponibles = 1', `valor=${clase1?.cupos_disponibles}`);
  check(clase1?.reservas_activas === 2, 'Clase 1: reservas_activas = 2', `valor=${clase1?.reservas_activas}`);
  check(clase1?.disponible === true, 'Clase 1: disponible = true', `valor=${clase1?.disponible}`);

  // -------------------------------------------------------------------
  // 3. Filtros del listado
  // -------------------------------------------------------------------
  const filtroEstado = await req('GET', '/clases?estado=PROGRAMADA', null, tokenAdmin);
  check(filtroEstado.status === 200 && filtroEstado.data?.count >= 3, 'GET ?estado=PROGRAMADA', `count=${filtroEstado.data?.count}`);

  const filtroInstructor = await req('GET', '/clases?id_instructor=1', null, tokenAdmin);
  check(filtroInstructor.status === 200 && filtroInstructor.data?.count >= 2, 'GET ?id_instructor=1', `count=${filtroInstructor.data?.count}`);

  const filtroSala = await req('GET', '/clases?sala=Sala%201%20-%20Kinesiolog%C3%ADa', null, tokenAdmin);
  check(filtroSala.status === 200 && filtroSala.data?.count >= 2, 'GET ?sala=Sala 1 - Kinesiología', `count=${filtroSala.data?.count}`);

  const filtroDesde = await req('GET', '/clases?desde=2026-10-20', null, tokenAdmin);
  check(filtroDesde.status === 200 && filtroDesde.data?.count >= 2, 'GET ?desde=2026-10-20', `count=${filtroDesde.data?.count}`);

  const filtroDisp = await req('GET', '/clases?solo_disponibles=true', null, tokenAdmin);
  check(filtroDisp.status === 200, 'GET ?solo_disponibles=true', `count=${filtroDisp.data?.count}`);

  const estadoMalo = await req('GET', '/clases?estado=INVENTADO', null, tokenAdmin);
  check(estadoMalo.status === 400, 'GET ?estado inválido -> 400', `status=${estadoMalo.status}`);

  // -------------------------------------------------------------------
  // 4. Escenario 3 — Detalle
  // -------------------------------------------------------------------
  const detalle = await req('GET', '/clases/1', null, tokenAdmin);
  check(detalle.status === 200 && detalle.data?.data?.id_clase === 1, 'GET /clases/1 -> 200', `status=${detalle.status}`);
  check(detalle.data?.data?.sala === 'Sala 1 - Kinesiología', 'Detalle incluye sala', `valor=${detalle.data?.data?.sala}`);

  const detalleNoExiste = await req('GET', '/clases/99999', null, tokenAdmin);
  check(detalleNoExiste.status === 404, 'GET /clases/99999 -> 404', `status=${detalleNoExiste.status}`);

  const detalleIdMalo = await req('GET', '/clases/abc', null, tokenAdmin);
  check(detalleIdMalo.status === 400, 'GET /clases/abc -> 400', `status=${detalleIdMalo.status}`);

  // -------------------------------------------------------------------
  // 5. Escenario 1 — Alta
  // -------------------------------------------------------------------
  const nueva = {
    nombre_actividad: 'Taller de Yoga Terapéutico',
    descripcion: 'Sesión grupal de yoga adaptado para rehabilitación.',
    sala: 'Sala 3 - Multiuso',
    id_instructor: 2,
    aforo_maximo: 4,
    fecha_clase: '2026-12-01',
    hora_inicio: '09:00',
    hora_fin: '10:00'
  };

  const creada = await req('POST', '/clases', nueva, tokenAdmin);
  idCreado = creada.data?.data?.id_clase;
  check(creada.status === 201 && !!idCreado, 'POST /clases -> 201', `status=${creada.status}, id=${idCreado}`);
  check(creada.data?.data?.cupos_disponibles === 4, 'cupos_disponibles = aforo_maximo (AC)', `cupos=${creada.data?.data?.cupos_disponibles}`);
  check(creada.data?.data?.aforo_maximo === 4, 'aforo_maximo = 4', `valor=${creada.data?.data?.aforo_maximo}`);
  check(creada.data?.data?.sala === 'Sala 3 - Multiuso', 'sala persistida', `valor=${creada.data?.data?.sala}`);
  check(creada.data?.data?.estado_clase === 'PROGRAMADA', 'estado_clase = PROGRAMADA', `valor=${creada.data?.data?.estado_clase}`);
  check(creada.data?.data?.reservas_activas === 0, 'reservas_activas = 0', `valor=${creada.data?.data?.reservas_activas}`);

  // -------------------------------------------------------------------
  // 6. Errores del Escenario 1
  // -------------------------------------------------------------------
  const faltantes = await req('POST', '/clases', { nombre_actividad: 'x' }, tokenAdmin);
  check(faltantes.status === 400 && faltantes.data?.error === 'VALIDATION_ERROR', 'POST sin campos -> 400', `status=${faltantes.status}`);

  const instructorNoExiste = await req('POST', '/clases', { ...nueva, id_instructor: 99999 }, tokenAdmin);
  check(instructorNoExiste.status === 404, 'Instructor inexistente -> 404', `status=${instructorNoExiste.status}`);

  // Un id de PACIENTE no es un profesional válido -> 404
  const instructorPaciente = await req('POST', '/clases', { ...nueva, id_instructor: 5, sala: 'Sala X' }, tokenAdmin);
  check(instructorPaciente.status === 404, 'Instructor = id de paciente -> 404', `status=${instructorPaciente.status}`);

  const aforoCero = await req('POST', '/clases', { ...nueva, aforo_maximo: 0, sala: 'Sala Y' }, tokenAdmin);
  check(aforoCero.status === 400, 'aforo_maximo = 0 -> 400', `status=${aforoCero.status}`);

  const horaInvalida = await req('POST', '/clases', { ...nueva, hora_inicio: '11:00', hora_fin: '09:00', sala: 'Sala Z' }, tokenAdmin);
  check(horaInvalida.status === 400, 'hora_fin <= hora_inicio -> 400', `status=${horaInvalida.status}`);

  const fechaMala = await req('POST', '/clases', { ...nueva, fecha_clase: '01-12-2026', sala: 'Sala W' }, tokenAdmin);
  check(fechaMala.status === 400, 'Fecha mal formateada -> 400', `status=${fechaMala.status}`);

  // Conflicto de sala: misma sala, misma fecha, rango solapado
  const colision = await req('POST', '/clases', {
    ...nueva,
    nombre_actividad: 'Otro taller en la misma sala',
    hora_inicio: '09:30',
    hora_fin: '10:30'
  }, tokenAdmin);
  check(colision.status === 409 && colision.data?.error === 'ROOM_CONFLICT', 'Colisión de sala -> 409 ROOM_CONFLICT', `status=${colision.status}`);

  // -------------------------------------------------------------------
  // 7. Escenario 4 — Actualización
  // -------------------------------------------------------------------
  const actualizada = await req('PUT', `/clases/${idCreado}`, {
    nombre_actividad: 'Taller de Yoga Terapéutico Avanzado',
    aforo_maximo: 6
  }, tokenAdmin);
  check(actualizada.status === 200, 'PUT /clases/:id -> 200', `status=${actualizada.status}`);
  check(actualizada.data?.data?.nombre_actividad === 'Taller de Yoga Terapéutico Avanzado', 'nombre actualizado', `valor=${actualizada.data?.data?.nombre_actividad}`);
  check(actualizada.data?.data?.aforo_maximo === 6, 'aforo_maximo actualizado a 6', `valor=${actualizada.data?.data?.aforo_maximo}`);
  check(actualizada.data?.data?.cupos_disponibles === 6, 'cupos recalculados a 6', `valor=${actualizada.data?.data?.cupos_disponibles}`);

  const cambioEstado = await req('PUT', `/clases/${idCreado}`, { estado_clase: 'COMPLETADA' }, tokenAdmin);
  check(cambioEstado.status === 200 && cambioEstado.data?.data?.estado_clase === 'COMPLETADA', 'PUT estado_clase = COMPLETADA', `valor=${cambioEstado.data?.data?.estado_clase}`);

  // -------------------------------------------------------------------
  // 8. Errores del Escenario 4
  // -------------------------------------------------------------------
  const putNoExiste = await req('PUT', '/clases/99999', { nombre_actividad: 'x' }, tokenAdmin);
  check(putNoExiste.status === 404, 'PUT inexistente -> 404', `status=${putNoExiste.status}`);

  const putEstadoMalo = await req('PUT', `/clases/${idCreado}`, { estado_clase: 'INVENTADO' }, tokenAdmin);
  check(putEstadoMalo.status === 400, 'PUT estado inválido -> 400', `status=${putEstadoMalo.status}`);

  const putVacio = await req('PUT', `/clases/${idCreado}`, {}, tokenAdmin);
  check(putVacio.status === 400, 'PUT sin campos -> 400', `status=${putVacio.status}`);

  // Reducir aforo por debajo de reservas activas (clase 1 tiene 2 reservas)
  const aforoBajo = await req('PUT', '/clases/1', { aforo_maximo: 1 }, tokenAdmin);
  check(aforoBajo.status === 409 && aforoBajo.data?.error === 'CONFLICT', 'Reducir aforo < reservas -> 409', `status=${aforoBajo.status}`);

  // -------------------------------------------------------------------
  // 9. Escenario 5 — Baja lógica
  // -------------------------------------------------------------------
  const eliminada = await req('DELETE', `/clases/${idCreado}`, null, tokenAdmin);
  check(eliminada.status === 200, 'DELETE /clases/:id -> 200', `status=${eliminada.status}`);
  check(eliminada.data?.data?.estado_clase === 'CANCELADA', 'estado_clase = CANCELADA', `valor=${eliminada.data?.data?.estado_clase}`);

  const dobleBaja = await req('DELETE', `/clases/${idCreado}`, null, tokenAdmin);
  check(dobleBaja.status === 409, 'DELETE repetido -> 409', `status=${dobleBaja.status}`);

  const deleteNoExiste = await req('DELETE', '/clases/99999', null, tokenAdmin);
  check(deleteNoExiste.status === 404, 'DELETE inexistente -> 404', `status=${deleteNoExiste.status}`);

  // La clase cancelada ya no aparece en el filtro de disponibles
  const trasBaja = await req('GET', '/clases?solo_disponibles=true', null, tokenAdmin);
  check(
    !trasBaja.data?.data?.some((c) => c.id_clase === idCreado),
    'Clase cancelada excluida de disponibles',
    `count=${trasBaja.data?.count}`
  );

  // -------------------------------------------------------------------
  console.log('─'.repeat(104));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  console.log('NOTA: este script crea una clase de prueba. Re-ejecuta seed.sql para limpiar.\n');

  process.exit(fail === 0 ? 0 : 1);
})();
