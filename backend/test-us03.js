// =====================================================================
//  S.A.P.C. — CHAWAL  |  Pruebas de autorización por roles (US-03)
//  Archivo: backend/test-us03.js
// =====================================================================
//  Uso:
//    1. Arrancar la API en otra terminal:  npm run dev
//    2. Ejecutar este script:              node test-us03.js
//
//  Requiere Node 18+ (fetch nativo) y `JWT_SECRET` en backend/.env, que
//  es el mismo secreto con el que firma el login (necesario para forjar
//  los tokens expirados / inválidos que exige el Escenario 2).
//
//  Escenarios del AC de US-03 (SCRUM-11):
//    Escenario 1 — un usuario autenticado con rol PACIENTE llama a una
//                  ruta de gestión administrativa -> la API interrumpe
//                  el flujo con 403 Forbidden.
//    Escenario 2 — llamada a un endpoint privado sin cabecera de
//                  autorización o con token expirado -> 401 Unauthorized,
//                  sin que se ejecute ninguna consulta a la BD.
//
//  ⚠️ Este test NO muta datos: todas las llamadas que llegan al
//     controlador fallan antes de escribir (403, 404 o 400). No hace
//     falta re-ejecutar `npm run db:setup` después.
// =====================================================================

require('dotenv').config({ quiet: true });   // sin banner: la salida es la evidencia
const jwt = require('jsonwebtoken');
const { ROLES } = require('./src/utils/roles');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET;
const ISSUER = 'SAPC-Chawal-API';

const log = (ok, etiqueta, detalle = '') =>
  console.log(`${ok ? 'OK   ' : 'FALLA'} | ${etiqueta.padEnd(58)} | ${detalle}`);

/**
 * Petición HTTP con control explícito de cabeceras, necesario para probar
 * los caminos del 401 (sin cabecera, esquema inválido, token vacío...).
 * Devuelve también `WWW-Authenticate` para verificar el cumplimiento de
 * RFC 7235.
 */
const req = async (metodo, ruta, { body, token, authorization } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (authorization !== undefined) headers.Authorization = authorization;

  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* sin body */ }

  return {
    status: res.status,
    data,
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
};

(async () => {
  console.log(`\nVerificando autorización por roles (US-03) en: ${BASE}\n`);
  console.log('─'.repeat(110));

  let ok = 0, fail = 0;
  const check = (cond, etiqueta, detalle) => {
    if (cond) ok++; else fail++;
    log(cond, etiqueta, detalle);
  };

  if (!JWT_SECRET) {
    console.error('\n✗ Falta JWT_SECRET. Copia backend/.env.example a backend/.env antes de ejecutar.\n');
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // 0. Tokens reales (precondición: US-01 ya emite el rol dentro del JWT)
  // -------------------------------------------------------------------
  const tokens = {};
  for (const [rol, email] of [
    [ROLES.ADMINISTRADOR, 'admin@chawal.cl'],
    [ROLES.TERAPEUTA, 'camila.rojas@chawal.cl'],
    [ROLES.PACIENTE, 'pedro.gonzalez@mail.cl'],
  ]) {
    const r = await req('POST', '/auth/login', { body: { email, password: 'Password2026!' } });
    tokens[rol] = r.data?.token;
    check(r.status === 200 && !!tokens[rol], `Login ${rol} (precondición)`, `status=${r.status}`);
  }

  const admin = tokens[ROLES.ADMINISTRADOR];
  const terapeuta = tokens[ROLES.TERAPEUTA];
  const paciente = tokens[ROLES.PACIENTE];

  if (!admin || !terapeuta || !paciente) {
    console.error('\n✗ No se pudieron obtener los 3 tokens: ¿está la API arriba y el seed aplicado?\n');
    process.exit(1);
  }

  // ===================================================================
  //  ESCENARIO 1 — "Consumo denegado por falta de permisos"
  //  Dado un usuario autenticado con rol PACIENTE que llama a una ruta
  //  de gestión administrativa, la API responde 403 Forbidden.
  // ===================================================================
  const estadoInicial = {
    terapeutas: (await req('GET', '/terapeutas', { token: admin })).data?.count,
    clase1: (await req('GET', '/clases/1', { token: admin })).data?.data?.estado_clase,
  };

  const rutasAdministrativas = [
    ['POST', '/terapeutas', {
      body: {
        rut: '11111111-1', nombre: 'No', apellido: 'Autorizado',
        email: 'no.autorizado@chawal.cl', password: 'Chawal2026!',
        numero_registro: 'RNPI-2026-99999',
        especialidades: [{ id_especialidad: 1, es_principal: true }]
      }
    }],
    ['PUT', '/terapeutas/1', { body: { telefono: '+56900000000' } }],
    ['POST', '/clases', {
      body: {
        nombre_actividad: 'Taller no autorizado', id_instructor: 1,
        aforo_maximo: 5, fecha_clase: '2026-10-05',
        hora_inicio: '09:00', hora_fin: '10:00'
      }
    }],
    ['PUT', '/clases/1', { body: { nombre_actividad: 'Renombrado' } }],
    ['DELETE', '/clases/1', {}],
    ['POST', '/agendas', {
      body: {
        id_profesional: 1, fecha_inicio: '2026-10-05', fecha_fin: '2026-10-05',
        hora_inicio: '09:00', hora_fin: '10:00', duracion_minutos: 30
      }
    }],
  ];

  let mensaje403 = null;
  for (const [metodo, ruta, opciones] of rutasAdministrativas) {
    const r = await req(metodo, ruta, { ...opciones, token: paciente });
    if (mensaje403 === null) mensaje403 = r.data?.message;
    check(
      r.status === 403 && r.data?.error === 'FORBIDDEN',
      `PACIENTE -> ${metodo} ${ruta} = 403 FORBIDDEN`,
      `status=${r.status}, error=${r.data?.error}`
    );
  }

  check(
    /Se requiere rol/.test(mensaje403 || ''),
    'El 403 nombra el rol requerido (AC Escenario 1)',
    `message="${mensaje403}"`
  );

  // El rol TERAPEUTA tampoco alcanza las rutas exclusivas de ADMINISTRADOR
  const teraPost = await req('POST', '/terapeutas', { token: terapeuta, body: {} });
  check(
    teraPost.status === 403 && teraPost.data?.error === 'FORBIDDEN',
    'TERAPEUTA -> POST /terapeutas = 403 (solo ADMINISTRADOR)',
    `status=${teraPost.status}`
  );

  const teraDelete = await req('DELETE', '/clases/1', { token: terapeuta });
  check(
    teraDelete.status === 403 && teraDelete.data?.error === 'FORBIDDEN',
    'TERAPEUTA -> DELETE /clases/1 = 403 (solo ADMINISTRADOR)',
    `status=${teraDelete.status}`
  );

  // Y ADMINISTRADOR no puede ocupar una ruta exclusiva de PACIENTE
  const adminReserve = await req('POST', '/classes/1/reserve', { token: admin });
  check(
    adminReserve.status === 403 && adminReserve.data?.error === 'FORBIDDEN',
    'ADMINISTRADOR -> POST /classes/:id/reserve = 403 (solo PACIENTE)',
    `status=${adminReserve.status}`
  );

  // "La API interrumpe el flujo": ningún rechazo llegó a escribir.
  const estadoFinal = {
    terapeutas: (await req('GET', '/terapeutas', { token: admin })).data?.count,
    clase1: (await req('GET', '/clases/1', { token: admin })).data?.data?.estado_clase,
  };

  check(
    estadoFinal.terapeutas === estadoInicial.terapeutas,
    'Los 403 no crearon terapeutas (el controlador no corrió)',
    `antes=${estadoInicial.terapeutas}, después=${estadoFinal.terapeutas}`
  );
  check(
    estadoFinal.clase1 === estadoInicial.clase1,
    'El DELETE rechazado no canceló la clase (el controlador no corrió)',
    `antes=${estadoInicial.clase1}, después=${estadoFinal.clase1}`
  );

  // ===================================================================
  //  ESCENARIO 2 — "Token caducado o inexistente"
  //  Sin cabecera de autorización o con token expirado -> 401, sin
  //  ejecutar ninguna consulta a la BD.
  // ===================================================================
  const payloadBase = { user_id: 1, rol: ROLES.ADMINISTRADOR, email: 'admin@chawal.cl' };

  const sinHeader = await req('GET', '/clases');
  check(
    sinHeader.status === 401 && sinHeader.data?.error === 'MISSING_TOKEN',
    'Sin cabecera Authorization -> 401 MISSING_TOKEN',
    `status=${sinHeader.status}, error=${sinHeader.data?.error}`
  );
  check(
    !!sinHeader.wwwAuthenticate,
    'El 401 incluye WWW-Authenticate (RFC 7235)',
    `valor=${sinHeader.wwwAuthenticate}`
  );

  const esquemaInvalido = await req('GET', '/clases', { authorization: 'Basic YWRtaW46YWRtaW4=' });
  check(
    esquemaInvalido.status === 401 && esquemaInvalido.data?.error === 'MISSING_TOKEN',
    'Esquema distinto de Bearer -> 401 MISSING_TOKEN',
    `status=${esquemaInvalido.status}`
  );

  const bearerVacio = await req('GET', '/clases', { authorization: 'Bearer    ' });
  check(
    bearerVacio.status === 401,
    'Cabecera "Bearer" sin token -> 401',
    `status=${bearerVacio.status}`
  );

  const firmaFalsa = jwt.sign(payloadBase, 'secreto_que_no_es_el_del_servidor', {
    expiresIn: '1h', issuer: ISSUER
  });
  const rFirmaFalsa = await req('GET', '/clases', { token: firmaFalsa });
  check(
    rFirmaFalsa.status === 401 && rFirmaFalsa.data?.error === 'INVALID_TOKEN',
    'Firma falsificada -> 401 INVALID_TOKEN',
    `status=${rFirmaFalsa.status}, error=${rFirmaFalsa.data?.error}`
  );

  const expirado = jwt.sign(payloadBase, JWT_SECRET, { expiresIn: '-10s', issuer: ISSUER });
  const rExpirado = await req('GET', '/clases', { token: expirado });
  check(
    rExpirado.status === 401 && rExpirado.data?.error === 'TOKEN_EXPIRED',
    'Token expirado -> 401 TOKEN_EXPIRED (AC Escenario 2)',
    `status=${rExpirado.status}, error=${rExpirado.data?.error}`
  );

  const emisorAjeno = jwt.sign(payloadBase, JWT_SECRET, { expiresIn: '1h', issuer: 'Otro-Emisor' });
  const rEmisor = await req('GET', '/clases', { token: emisorAjeno });
  check(
    rEmisor.status === 401 && rEmisor.data?.error === 'INVALID_TOKEN',
    'Token con issuer ajeno -> 401 (no se confía en la firma)',
    `status=${rEmisor.status}, error=${rEmisor.data?.error}`
  );

  // --- Evidencia de "sin consultar la BD" -----------------------------
  // Si el controlador corriera, un id inexistente daría 404: para saberlo
  // tendría que consultar la BD (`pool.query`). Sin token la respuesta es
  // 401 => el middleware cortó antes de entrar al controlador.
  const sinTokenInexistente = await req('GET', '/clases/999999');
  check(
    sinTokenInexistente.status === 401,
    'GET /clases/999999 sin token -> 401 (no 404): no hubo consulta a la BD',
    `status=${sinTokenInexistente.status}`
  );

  const conTokenInexistente = await req('GET', '/clases/999999', { token: admin });
  check(
    conTokenInexistente.status === 404,
    'Contraste: con token válido -> 404 (ahí sí consulta la BD)',
    `status=${conTokenInexistente.status}`
  );

  const sinTokenAgenda = await req('GET', '/agendas/999999?fecha=2026-10-05');
  check(
    sinTokenAgenda.status === 401,
    'GET /agendas/999999 sin token -> 401 (no 404)',
    `status=${sinTokenAgenda.status}`
  );

  // --- Rutas /info: antes públicas, ahora requieren token -------------
  for (const ruta of ['/clases/info', '/agendas/info', '/terapeutas/info']) {
    const r = await req('GET', ruta);
    check(r.status === 401, `GET ${ruta} sin token -> 401`, `status=${r.status}`);
  }

  const infoConToken = await req('GET', '/clases/info', { token: paciente });
  check(
    infoConToken.status === 200 && infoConToken.data?.user_story === 'US-11 (SCRUM-19)',
    'GET /clases/info con token válido -> 200',
    `status=${infoConToken.status}`
  );

  // ===================================================================
  //  El RBAC no es un "deny all": los caminos permitidos siguen abiertos
  // ===================================================================
  const adminLista = await req('GET', '/clases', { token: admin });
  check(adminLista.status === 200, 'ADMINISTRADOR -> GET /clases = 200', `status=${adminLista.status}`);

  const teraLista = await req('GET', '/clases', { token: terapeuta });
  check(teraLista.status === 200, 'TERAPEUTA -> GET /clases = 200', `status=${teraLista.status}`);

  const pacLista = await req('GET', '/classes', { token: paciente });
  check(pacLista.status === 200, 'PACIENTE -> GET /classes = 200', `status=${pacLista.status}`);

  // PACIENTE atraviesa requireRole('PACIENTE') y llega al controlador:
  // el 404/400 lo produce el controlador, no el middleware.
  const pacReservaInvalida = await req('POST', '/classes/abc/reserve', { token: paciente });
  check(
    pacReservaInvalida.status === 400 && pacReservaInvalida.data?.error === 'INVALID_ID',
    'PACIENTE -> POST /classes/abc/reserve pasa el RBAC (400 INVALID_ID)',
    `status=${pacReservaInvalida.status}, error=${pacReservaInvalida.data?.error}`
  );

  const pacReservaInexistente = await req('POST', '/classes/999999/reserve', { token: paciente });
  check(
    pacReservaInexistente.status === 404 && pacReservaInexistente.data?.error === 'NOT_FOUND',
    'PACIENTE -> POST /classes/999999/reserve pasa el RBAC (404 NOT_FOUND)',
    `status=${pacReservaInexistente.status}, error=${pacReservaInexistente.data?.error}`
  );

  // TERAPEUTA atraviesa requireRole('ADMINISTRADOR','TERAPEUTA') en publish
  const teraPublishInvalido = await req('POST', '/schedules/publish', {
    token: terapeuta, body: { days: [1] }
  });
  check(
    teraPublishInvalido.status === 400 && teraPublishInvalido.data?.error === 'MISSING_TIME_FIELDS',
    'TERAPEUTA -> POST /schedules/publish pasa el RBAC (400 de validación, no 403)',
    `status=${teraPublishInvalido.status}`
  );

  // El esquema de autenticación es case-insensitive (RFC 7235 §2.1)
  const bearerMinuscula = await req('GET', '/clases', {
    authorization: `bearer ${paciente}`
  });
  check(
    bearerMinuscula.status === 200,
    'Esquema "bearer" en minúscula también se acepta',
    `status=${bearerMinuscula.status}`
  );

  // -------------------------------------------------------------------
  console.log('─'.repeat(110));
  console.log(`Resultado: ${ok} OK / ${fail} FALLA de ${ok + fail} verificaciones\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
