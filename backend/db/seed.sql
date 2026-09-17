-- =====================================================================
--  S.A.P.C. — CHAWAL  |  SCRUM-27 / SETUP-02
--  DML — Datos maestros y de prueba
--  Archivo: backend/db/seed.sql
-- =====================================================================
--  Ejecutar SIEMPRE después de schema.sql
--  Contraseña de TODOS los usuarios de prueba: Password2026!
--  Hash bcrypt real (cost=10) verificado con bcrypt.compare():
--    $2b$10$D0YlhS.MhU0kRRJmm6oeVOuIeihxhs/iHW1jlbYLpDzyPvq/La76q
-- =====================================================================

SET NAMES utf8mb4;
SET @PWD_HASH = '$2b$10$D0YlhS.MhU0kRRJmm6oeVOuIeihxhs/iHW1jlbYLpDzyPvq/La76q';

<<<<<<< Updated upstream
=======
USE chawal_db; 
>>>>>>> Stashed changes
-- ---------------------------------------------------------------------
-- Limpieza idempotente (respeta orden de dependencias)
-- ---------------------------------------------------------------------
DELETE FROM comprobantes_pdf;
DELETE FROM pagos;
DELETE FROM reservas_clases;
DELETE FROM clases_grupales;
DELETE FROM novedades;
DELETE FROM auditoria;
DELETE FROM notificaciones;
DELETE FROM citas;
DELETE FROM bloques_horarios;
DELETE FROM servicios;
DELETE FROM profesional_especialidad;
DELETE FROM pacientes;
DELETE FROM profesionales;
DELETE FROM especialidades;
DELETE FROM usuarios;
DELETE FROM roles;
DELETE FROM configuracion;

ALTER TABLE roles                  AUTO_INCREMENT = 1;
ALTER TABLE usuarios               AUTO_INCREMENT = 1;
ALTER TABLE especialidades         AUTO_INCREMENT = 1;
ALTER TABLE profesionales          AUTO_INCREMENT = 1;
ALTER TABLE pacientes              AUTO_INCREMENT = 1;
ALTER TABLE servicios              AUTO_INCREMENT = 1;
ALTER TABLE bloques_horarios       AUTO_INCREMENT = 1;
ALTER TABLE citas                  AUTO_INCREMENT = 1;
ALTER TABLE clases_grupales        AUTO_INCREMENT = 1;
ALTER TABLE reservas_clases        AUTO_INCREMENT = 1;
ALTER TABLE pagos                  AUTO_INCREMENT = 1;
ALTER TABLE comprobantes_pdf       AUTO_INCREMENT = 1;
ALTER TABLE novedades              AUTO_INCREMENT = 1;
ALTER TABLE notificaciones         AUTO_INCREMENT = 1;
ALTER TABLE configuracion          AUTO_INCREMENT = 1;

-- =====================================================================
-- §1  ROLES  (3 roles del sistema)
-- =====================================================================
INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
    (1, 'ADMINISTRADOR', 'Acceso total al sistema, gestión de usuarios y configuración'),
    (2, 'TERAPEUTA',     'Profesional de la salud, gestiona su agenda y atenciones'),
    (3, 'PACIENTE',      'Usuario final, agenda y consulta sus citas');

-- =====================================================================
-- §2  ESPECIALIDADES
-- =====================================================================
INSERT INTO especialidades (id_especialidad, nombre, descripcion) VALUES
    (1, 'Kinesiología',        'Rehabilitación física y motora'),
    (2, 'Fonoaudiología',      'Trastornos del lenguaje, habla y audición'),
    (3, 'Terapia Ocupacional', 'Rehabilitación funcional de la vida diaria'),
    (4, 'Psicología',          'Salud mental y apoyo psicológico'),
    (5, 'Nutrición',           'Evaluación y tratamiento nutricional');

-- =====================================================================
-- §3  USUARIOS  (1 admin + 3 terapeutas + 3 pacientes)
--     password_hash = bcrypt("Password2026!", 10)
-- =====================================================================
INSERT INTO usuarios
    (id_usuario, id_rol, rut, nombre, apellido, email, password_hash, telefono, estado) VALUES
    -- Administrador (contrato US-01 / SCRUM-9)
    (1, 1, '12345678-9', 'Admin',    'Chawal',   'admin@chawal.cl',        @PWD_HASH, '+56911111111', 'ACTIVO'),
    -- Terapeutas
    (2, 2, '11111111-1', 'Camila',   'Rojas',    'camila.rojas@chawal.cl', @PWD_HASH, '+56922222222', 'ACTIVO'),
    (3, 2, '22222222-2', 'Matías',   'Fuentes',  'matias.fuentes@chawal.cl',@PWD_HASH,'+56933333333', 'ACTIVO'),
    (4, 2, '33333333-3', 'Valentina','Soto',     'valentina.soto@chawal.cl',@PWD_HASH,'+56944444444', 'ACTIVO'),
    -- Pacientes
    (5, 3, '44444444-4', 'Pedro',    'González', 'pedro.gonzalez@mail.cl', @PWD_HASH, '+56955555555', 'ACTIVO'),
    (6, 3, '55555555-5', 'Ana',      'Muñoz',    'ana.munoz@mail.cl',      @PWD_HASH, '+56966666666', 'ACTIVO'),
    (7, 3, '66666666-6', 'Luis',     'Pérez',    'luis.perez@mail.cl',     @PWD_HASH, '+56977777777', 'ACTIVO');

-- =====================================================================
-- §4  PROFESIONALES  (1:1 con usuarios 2, 3, 4)
-- =====================================================================
INSERT INTO profesionales
    (id_profesional, id_usuario, numero_registro, id_especialidad_principal, anios_experiencia, biografia) VALUES
    (1, 2, 'RNPI-2020-00123', 1, 8, 'Kinesióloga especialista en rehabilitación deportiva.'),
    (2, 3, 'RNPI-2018-00456', 2, 12,'Fonoaudiólogo con enfoque en terapia infantil.'),
    (3, 4, 'RNPI-2022-00789', 4, 4, 'Psicóloga clínica, terapia cognitivo-conductual.');

-- =====================================================================
-- §5  PACIENTES  (1:1 con usuarios 5, 6, 7)
-- =====================================================================
INSERT INTO pacientes
    (id_paciente, id_usuario, fecha_nacimiento, telefono, direccion, prevision, contacto_emergencia, telefono_emergencia) VALUES
    (1, 5, '1985-04-12', '+56955555555', 'Av. Providencia 1234, Santiago', 'FONASA',    'María González', '+56988888881'),
    (2, 6, '1992-11-30', '+56966666666', 'Calle Los Aromos 567, Ñuñoa',    'ISAPRE',    'Jorge Muñoz',    '+56988888882'),
    (3, 7, '1978-07-08', '+56977777777', 'Pasaje El Roble 89, Maipú',      'PARTICULAR','Carla Pérez',    '+56988888883');

-- =====================================================================
-- §6  PROFESIONAL_ESPECIALIDAD  (N:M)
-- =====================================================================
INSERT INTO profesional_especialidad (id_profesional, id_especialidad, es_principal) VALUES
    (1, 1, 1),  -- Camila  -> Kinesiología (principal)
    (1, 3, 0),  -- Camila  -> Terapia Ocupacional (secundaria)
    (2, 2, 1),  -- Matías  -> Fonoaudiología (principal)
    (3, 4, 1),  -- Valentina -> Psicología (principal)
    (3, 5, 0);  -- Valentina -> Nutrición (secundaria)

-- =====================================================================
-- §7  SERVICIOS
-- =====================================================================
INSERT INTO servicios
    (id_servicio, id_especialidad, codigo, nombre, descripcion, duracion_min, precio, aforo_nominal) VALUES
    (1, 1, 'KIN-001', 'Sesión de Kinesiología',      'Evaluación y tratamiento kinésico individual', 45, 25000.00, 1),
    (2, 2, 'FON-001', 'Sesión de Fonoaudiología',    'Terapia del lenguaje individual',              30, 22000.00, 1),
    (3, 4, 'PSI-001', 'Sesión de Psicología',        'Consulta psicológica individual',              50, 30000.00, 1),
    (4, 3, 'TOC-001', 'Terapia Ocupacional Grupal',  'Taller grupal de rehabilitación funcional',    60, 15000.00, 3),
    (5, 5, 'NUT-001', 'Consulta Nutricional',        'Evaluación nutricional y plan alimentario',    40, 20000.00, 1);

-- =====================================================================
-- §8  BLOQUES_HORARIOS  (plantilla semanal por profesional)
--     dia_semana: 1=Lunes ... 7=Domingo
-- =====================================================================
INSERT INTO bloques_horarios
    (id_bloque, id_profesional, dia_semana, hora_inicio, hora_fin, aforo_maximo) VALUES
    -- Camila (Kinesiología) — Lunes y Miércoles
    (1, 1, 1, '09:00:00', '13:00:00', 1),
    (2, 1, 3, '09:00:00', '13:00:00', 1),
    -- Matías (Fonoaudiología) — Martes y Jueves
    (3, 2, 2, '10:00:00', '14:00:00', 1),
    (4, 2, 4, '10:00:00', '14:00:00', 1),
    -- Valentina (Psicología) — Viernes
    (5, 3, 5, '15:00:00', '19:00:00', 1),
    -- Bloque grupal (Terapia Ocupacional) — Sábado, aforo 3
    (6, 1, 6, '10:00:00', '12:00:00', 3);

-- =====================================================================
-- §9  CITAS  (fechas futuras; respetan uq_citas_slot y aforo)
--     es_grupal NO se fija aquí: el trigger trg_citas_bi_validacion lo
--     deriva de bloques_horarios.aforo_maximo (aforo > 1 => grupal).
-- =====================================================================
INSERT INTO citas
    (id_cita, id_paciente, id_profesional, id_servicio, id_bloque, fecha_cita, hora_inicio, hora_fin, estado, motivo) VALUES
    (1, 1, 1, 1, 1, '2026-10-05', '09:00:00', '09:45:00', 'CONFIRMADA', 'Dolor lumbar'),
    (2, 2, 1, 1, 1, '2026-10-05', '10:00:00', '10:45:00', 'PENDIENTE',   'Rehabilitación post-operatoria'),
    (3, 3, 2, 2, 3, '2026-10-06', '10:00:00', '10:30:00', 'CONFIRMADA', 'Terapia de lenguaje'),
    (4, 1, 3, 3, 5, '2026-10-09', '15:00:00', '15:50:00', 'PENDIENTE',   'Primera consulta'),
    -- Cita cancelada: libera el slot (slot_activo = NULL)
    (5, 2, 2, 2, 3, '2026-10-06', '11:00:00', '11:30:00', 'CANCELADA', 'Reprogramada por el paciente'),
    -- Bloque grupal 6 (aforo 3, Sábado): 2 de 3 cupos ocupados.
    -- El trigger marca es_grupal = 1 automáticamente.
    (6, 1, 1, 4, 6, '2026-10-10', '10:00:00', '11:00:00', 'CONFIRMADA', 'Taller grupal'),
    (7, 3, 1, 4, 6, '2026-10-10', '10:00:00', '11:00:00', 'CONFIRMADA', 'Taller grupal');

-- =====================================================================
-- §10  CLASES_GRUPALES  (talleres con aforo; cupos_disponibles lo
--      decrementa el trigger trg_control_aforo_clases al inscribirse)
-- =====================================================================
INSERT INTO clases_grupales
    (id_clase, nombre_actividad, descripcion, id_instructor, aforo_maximo, cupos_disponibles,
     fecha_clase, hora_inicio, hora_fin, estado_clase) VALUES
    (1, 'Taller de Rehabilitación Funcional',
        'Taller grupal de terapia ocupacional para recuperación motora.',
        1, 3, 3, '2026-10-17', '10:00:00', '11:00:00', 'PROGRAMADA'),
    (2, 'Taller de Estimulación Cognitiva',
        'Sesión grupal de estimulación cognitiva para adultos mayores.',
        3, 5, 5, '2026-10-24', '15:00:00', '16:00:00', 'PROGRAMADA'),
    (3, 'Taller de Higiene Postural',
        'Taller grupal de kinesiología sobre cuidado de la columna.',
        1, 2, 2, '2026-11-07', '10:00:00', '11:00:00', 'PROGRAMADA');

-- =====================================================================
-- §11  RESERVAS_CLASES  (inscripciones; el trigger decrementa cupos)
--      Al insertar, cupos_disponibles baja automáticamente.
-- =====================================================================
INSERT INTO reservas_clases (id_reserva_clase, id_paciente, id_clase, estado_reserva) VALUES
    (1, 1, 1, 'ACTIVA'),   -- Pedro  (paciente 1) -> Taller 1 (cupos 3 -> 2)
    (2, 2, 1, 'ACTIVA'),   -- Ana    (paciente 2) -> Taller 1 (cupos 2 -> 1)
    (3, 3, 2, 'ACTIVA'),   -- Luis   (paciente 3) -> Taller 2 (cupos 5 -> 4)
    (4, 1, 2, 'ACTIVA');   -- Pedro  (paciente 1) -> Taller 2 (cupos 4 -> 3)

-- =====================================================================
-- §12  PAGOS  (exclusividad XOR: cita individual O reserva de clase)
--      id_cita e id_reserva_clase son mutuamente excluyentes (CHECK).
-- =====================================================================
INSERT INTO pagos
    (id_pago, id_cita, id_reserva_clase, monto, metodo_pago, estado_pago, referencia, fecha_pago) VALUES
    -- Pagos de citas individuales
    (1, 1, NULL, 25000.00, 'DEBITO',        'PAGADO',    'TRX-20261005-0001', '2026-10-05 09:10:00'),
    (2, 3, NULL, 22000.00, 'EFECTIVO',      'PAGADO',    'TRX-20261006-0002', '2026-10-06 10:05:00'),
    (3, 4, NULL, 30000.00, 'TRANSFERENCIA', 'PENDIENTE', NULL,                NULL),
    -- 'SEGURO' es el valor válido del ENUM metodo_pago (cubre FONASA/ISAPRE)
    (4, 6, NULL, 15000.00, 'SEGURO',        'PENDIENTE', NULL,                NULL),
    -- Pagos de reservas de clase grupal (XOR: id_cita = NULL)
    (5, NULL, 1, 15000.00, 'DEBITO',        'PAGADO',    'TRX-20261017-0005', '2026-10-17 09:50:00'),
    (6, NULL, 3, 15000.00, 'EFECTIVO',      'PENDIENTE', NULL,                NULL);

-- =====================================================================
-- §13  COMPROBANTES_PDF  (1:1 con pagos aprobados)
--      Solo los pagos en estado PAGADO generan comprobante.
-- =====================================================================
INSERT INTO comprobantes_pdf
    (id_comprobante, id_transaccion, codigo_verificacion, url_pdf) VALUES
    (1, 1, 'CHW-2026-0001-A1B2C3D4E5F6', 'https://chawal.cl/comprobantes/CHW-2026-0001.pdf'),
    (2, 2, 'CHW-2026-0002-F6E5D4C3B2A1', 'https://chawal.cl/comprobantes/CHW-2026-0002.pdf'),
    (3, 5, 'CHW-2026-0005-9A8B7C6D5E4F', 'https://chawal.cl/comprobantes/CHW-2026-0005.pdf');

-- =====================================================================
-- §14  NOVEDADES  (contenido institucional publicado por el admin)
-- =====================================================================
INSERT INTO novedades
    (id_novedad, titulo, resumen, contenido, imagen_url, id_autor_admin, estado) VALUES
    (1, 'Nuevos talleres grupales disponibles',
        'Ya están abiertas las inscripciones para los talleres de octubre.',
        'Contamos con nuevos talleres de rehabilitación funcional y estimulación cognitiva. Las inscripciones se realizan directamente desde la aplicación.',
        'https://chawal.cl/img/novedades/talleres-octubre.jpg', 1, 'PUBLICADO'),
    (2, 'Horario extendido en kinesiología',
        'Ampliamos la disponibilidad de atención kinésica.',
        'A partir de noviembre, el equipo de kinesiología atenderá también los días sábado en horario de mañana.',
        'https://chawal.cl/img/novedades/horario-kinesiologia.jpg', 1, 'PUBLICADO'),
    (3, 'Campaña de prevención postural',
        'Borrador en preparación para la campaña de noviembre.',
        'Contenido en revisión por el equipo clínico antes de su publicación.',
        NULL, 1, 'BORRADOR');

-- =====================================================================
-- §15  NOTIFICACIONES  (FK explícita a citas — sin polimorfismo)
-- =====================================================================
INSERT INTO notificaciones
    (id_usuario, id_cita, tipo, titulo, mensaje, leida) VALUES
    (5, 1, 'CONFIRMACION', 'Cita confirmada',      'Su cita de kinesiología del 05-10-2026 a las 09:00 ha sido confirmada.', 1),
    (6, 3, 'RECORDATORIO', 'Recordatorio de cita', 'Recuerde su sesión de fonoaudiología el 06-10-2026 a las 10:00.',        0),
    (5, 4, 'RECORDATORIO', 'Recordatorio de cita', 'Tiene una consulta psicológica el 09-10-2026 a las 15:00.',              0),
    (6, 5, 'CANCELACION',  'Cita cancelada',       'Su cita del 06-10-2026 a las 11:00 fue cancelada.',                      1),
    (7, NULL, 'SISTEMA',   'Bienvenido a SAPC',    'Su cuenta ha sido creada correctamente.',                                0);

-- =====================================================================
-- §16  CONFIGURACION
-- =====================================================================
INSERT INTO configuracion (clave, valor, tipo_dato, descripcion, editable) VALUES
    ('app.nombre',              'S.A.P.C. Chawal',      'STRING',  'Nombre del sistema',                        0),
    ('app.version',             '1.0.0',                'STRING',  'Versión actual',                            0),
    ('citas.duracion_default',  '45',                   'INT',     'Duración por defecto en minutos',           1),
    ('citas.dias_anticipacion', '30',                   'INT',     'Días máximos de anticipación al agendar',   1),
    ('citas.horas_cancelacion', '24',                   'INT',     'Horas mínimas para cancelar sin recargo',   1),
    ('pagos.moneda',            'CLP',                  'STRING',  'Moneda del sistema',                        0),
    ('pagos.iva',               '19',                   'DECIMAL', 'Porcentaje de IVA',                         1),
    ('seguridad.max_intentos',  '5',                    'INT',     'Intentos de login antes de bloquear',       1),
    ('seguridad.bloqueo_min',   '15',                   'INT',     'Minutos de bloqueo tras exceder intentos',  1),
    ('notif.email_activo',      'true',                 'BOOLEAN', 'Habilitar notificaciones por email',        1);

-- =====================================================================
-- §17  AUDITORÍA INICIAL (evento de carga de datos)
-- =====================================================================
INSERT INTO auditoria (id_usuario, tabla_afectada, id_registro, accion, detalle, ip_origen) VALUES
    (1, 'usuarios', 1, 'INSERT', JSON_OBJECT('evento','seed inicial','origen','seed.sql'), '127.0.0.1');

-- =====================================================================
-- §18  VERIFICACIÓN
-- =====================================================================
SELECT '=== ROLES ===' AS seccion;
SELECT id_rol, nombre_rol, descripcion FROM roles;

SELECT '=== USUARIOS CON ROL (vista) ===' AS seccion;
SELECT id_usuario, rut, nombre, apellido, email, rol, estado FROM v_usuarios_roles;

SELECT '=== PROFESIONALES ===' AS seccion;
SELECT p.id_profesional, u.nombre, u.apellido, p.numero_registro,
       e.nombre AS especialidad_principal, p.anios_experiencia
FROM   profesionales p
JOIN   usuarios u        ON u.id_usuario = p.id_usuario
LEFT JOIN especialidades e ON e.id_especialidad = p.id_especialidad_principal;

SELECT '=== CITAS ===' AS seccion;
SELECT c.id_cita, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
       CONCAT(pu.nombre,' ',pu.apellido) AS paciente,
       CONCAT(pr.nombre,' ',pr.apellido) AS profesional,
       s.nombre AS servicio
FROM   citas c
JOIN   pacientes     pa ON pa.id_paciente = c.id_paciente
JOIN   usuarios      pu ON pu.id_usuario = pa.id_usuario
JOIN   profesionales pf ON pf.id_profesional = c.id_profesional
JOIN   usuarios      pr ON pr.id_usuario = pf.id_usuario
JOIN   servicios     s  ON s.id_servicio = c.id_servicio
ORDER BY c.fecha_cita, c.hora_inicio;

SELECT '=== OCUPACIÓN DE AFORO POR SLOT (bloque + fecha + hora) ===' AS seccion;
SELECT b.id_bloque, c.fecha_cita, c.hora_inicio, b.aforo_maximo,
       COUNT(c.id_cita) AS citas_vigentes,
       (b.aforo_maximo - COUNT(c.id_cita)) AS cupos_libres
FROM   bloques_horarios b
JOIN   citas c ON c.id_bloque = b.id_bloque
              AND c.estado NOT IN ('CANCELADA','NO_ASISTIO')
GROUP BY b.id_bloque, c.fecha_cita, c.hora_inicio, b.aforo_maximo
ORDER BY b.id_bloque, c.fecha_cita, c.hora_inicio;

SELECT '=== PAGOS (XOR cita | reserva) ===' AS seccion;
SELECT id_pago, id_cita, id_reserva_clase, monto, metodo_pago, estado_pago FROM pagos;

SELECT '=== CLASES GRUPALES (cupos tras reservas) ===' AS seccion;
SELECT id_clase, nombre_actividad, aforo_maximo, cupos_disponibles,
       (aforo_maximo - cupos_disponibles) AS inscritos, estado_clase
FROM   clases_grupales
ORDER BY id_clase;

SELECT '=== RESERVAS DE CLASES ===' AS seccion;
SELECT r.id_reserva_clase, CONCAT(u.nombre,' ',u.apellido) AS alumno,
       c.nombre_actividad, r.estado_reserva, r.fecha_inscripcion
FROM   reservas_clases r
JOIN   pacientes       pa ON pa.id_paciente = r.id_paciente
JOIN   usuarios        u  ON u.id_usuario   = pa.id_usuario
JOIN   clases_grupales c  ON c.id_clase     = r.id_clase
ORDER BY r.id_reserva_clase;

SELECT '=== COMPROBANTES PDF (1:1 con pagos) ===' AS seccion;
SELECT cp.id_comprobante, cp.id_transaccion, cp.codigo_verificacion,
       p.monto, p.estado_pago
FROM   comprobantes_pdf cp
JOIN   pagos p ON p.id_pago = cp.id_transaccion
ORDER BY cp.id_comprobante;

SELECT '=== NOVEDADES ===' AS seccion;
SELECT id_novedad, titulo, estado, fecha_publicacion FROM novedades ORDER BY id_novedad;

SELECT '=== CONFIGURACIÓN ===' AS seccion;
SELECT clave, valor, tipo_dato FROM configuracion ORDER BY clave;

-- =====================================================================
-- §19  PRUEBAS DE CONCURRENCIA (ejecutar manualmente, una por una)
--      El detalle completo de las 9 pruebas está en test_runner.sql
-- =====================================================================
-- 15.1 Colisión horaria exacta: debe fallar (índice uq_citas_slot y/o
--      trigger trg_citas_bi_validacion)
--      (Camila ya tiene cita el 2026-10-05 a las 09:00)
-- CALL sp_agendar_cita(2, 1, 1, 1, '2026-10-05', '09:00:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.1b Solapamiento PARCIAL de rango: debe fallar por el trigger
--       (cita 1 es 09:00-09:45; 09:30-10:15 se solapa aunque el inicio difiera)
-- CALL sp_agendar_cita(2, 1, 1, 1, '2026-10-05', '09:30:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.2 Aforo excedido: bloque 6 (grupal) tiene aforo 3 y ya hay 2 citas
--      vigentes el 2026-10-10 a las 10:00. La 3ª entra; la 4ª debe fallar.
-- CALL sp_agendar_cita(2, 1, 4, 6, '2026-10-10', '10:00:00', @id, @msg);  -- OK (3/3)
-- SELECT @id AS id_cita, @msg AS mensaje;
-- CALL sp_agendar_cita(3, 1, 4, 6, '2026-10-10', '10:00:00', @id, @msg);  -- FALLA (aforo)
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.3 Agendamiento exitoso en slot libre
-- CALL sp_agendar_cita(3, 1, 1, 1, '2026-10-05', '11:00:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.4 Verificar que cancelar libera el slot
-- UPDATE citas SET estado = 'CANCELADA' WHERE id_cita = 1;
-- CALL sp_agendar_cita(2, 1, 1, 1, '2026-10-05', '09:00:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.5 Coherencia bloque↔profesional: debe fallar (bloque 1 es de Camila=prof 1)
-- CALL sp_agendar_cita(1, 2, 2, 1, '2026-10-05', '09:00:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- 15.6 Coherencia día de semana: debe fallar (bloque 1 es Lunes; 2026-10-06 es Martes)
-- CALL sp_agendar_cita(1, 1, 1, 1, '2026-10-06', '09:00:00', @id, @msg);
-- SELECT @id AS id_cita, @msg AS mensaje;

-- =====================================================================
-- FIN DEL SCRIPT — seed.sql
-- =====================================================================
