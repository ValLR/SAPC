-- =====================================================================
--  S.A.P.C. — CHAWAL  |  SCRUM-27 / SETUP-02
--  DDL — Esquema relacional MySQL 8.0 (InnoDB)
--  Archivo: backend/db/schema.sql
-- =====================================================================
--   [R1] Vínculos operativos apuntan a profesionales/pacientes, NO a usuarios
--   [R2] Polimorfismo eliminado en tablas operativas (solo en auditoria)
--   [R3] Cardinalidades 1:1 resueltas con UNIQUE(id_usuario)
--   [R4] N:M profesional<->especialidad resuelto con tabla puente
--   [R5] Índice único compuesto anti-colisión horaria (slot_activo)
--   [R6] ENUM para todos los estados
--   [R7] DECIMAL(10,2) para dinero / CHAR(60) para bcrypt
--   [R8] ENGINE=InnoDB + utf8mb4_unicode_ci en todas las tablas
--   [R9] CHECK constraints para rangos y coherencia
--   [R10] Stored Procedure transaccional sp_agendar_cita
--   [R11] Triggers de control dinámico de aforo + auditoría
--   [R12] Una sola especialidad principal por profesional (columna VIRTUAL)
--   [R13] Aforo operativo único en bloques_horarios (servicios = nominal)
--   [R14] Triggers validan coherencia bloque/día/rango/solapamiento y
--         derivan es_grupal (no delegable a un INSERT directo)
--   [R15] Módulo de clases grupales + reservas con control de aforo por trigger
--   [R16] Pagos con exclusividad XOR (cita | reserva de clase)
--   [R17] comprobantes_pdf 1:1 con pagos (resuelve la duda del docente)
--   [R18] novedades (contenido institucional)
--   [R19] US-13: campo titulo_profesional + estado_disponibilidad operativa
--         (distinta de `activo`, que sigue siendo el soft-delete)
--   [R20] US-11: campo sala en clases_grupales (ubicación física del taller)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,ERROR_FOR_DIVISION_BY_ZERO';

USE chawal_db;
-- ---------------------------------------------------------------------
-- LIMPIEZA IDEMPOTENTE (orden inverso a dependencias)
-- ---------------------------------------------------------------------
DROP VIEW  IF EXISTS v_usuarios_roles;
DROP TABLE IF EXISTS comprobantes_pdf;
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS reservas_clases;
DROP TABLE IF EXISTS clases_grupales;
DROP TABLE IF EXISTS novedades;
DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS notificaciones;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS bloques_horarios;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS profesional_especialidad;
DROP TABLE IF EXISTS pacientes;
DROP TABLE IF EXISTS profesionales;
DROP TABLE IF EXISTS especialidades;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS configuracion;

-- =====================================================================
-- §1  ROLES  — catálogo cerrado de roles del sistema
-- =====================================================================
CREATE TABLE roles (
    id_rol          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre_rol      ENUM('ADMINISTRADOR','TERAPEUTA','PACIENTE') NOT NULL,
    descripcion     VARCHAR(150)     NULL,
    activo          TINYINT(1)       NOT NULL DEFAULT 1,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol),
    UNIQUE KEY uq_roles_nombre (nombre_rol),
    CONSTRAINT chk_roles_activo CHECK (activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de roles. ENUM cerrado: ADMINISTRADOR, TERAPEUTA, PACIENTE';

-- =====================================================================
-- §2  USUARIOS  — identidad y credenciales (NO es entidad de dominio)
-- =====================================================================
CREATE TABLE usuarios (
    id_usuario        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    id_rol            TINYINT UNSIGNED NOT NULL,
    rut               VARCHAR(12)      NOT NULL COMMENT 'Formato 12345678-9 (sin puntos)',
    nombre            VARCHAR(80)      NOT NULL,
    apellido          VARCHAR(80)      NOT NULL,
    email             VARCHAR(120)     NOT NULL,
    password_hash     CHAR(60)         NOT NULL COMMENT 'bcrypt $2b$10$... (60 chars fijos)',
    telefono          VARCHAR(20)      NULL,
    estado            ENUM('ACTIVO','INACTIVO','BLOQUEADO','PENDIENTE') NOT NULL DEFAULT 'ACTIVO',
    intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rate limiting de login',
    bloqueado_hasta   DATETIME         NULL,
    ultimo_acceso     DATETIME         NULL,
    created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario),
    UNIQUE KEY uq_usuarios_rut   (rut),
    UNIQUE KEY uq_usuarios_email (email),
    KEY ix_usuarios_rol_estado   (id_rol, estado),
    CONSTRAINT fk_usuarios_rol
        FOREIGN KEY (id_rol) REFERENCES roles (id_rol)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_usuarios_email  CHECK (email LIKE '%@%.%'),
    CONSTRAINT chk_usuarios_rut    CHECK (rut LIKE '%-%'),
    CONSTRAINT chk_usuarios_intent CHECK (intentos_fallidos <= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Identidad/autenticación. El dominio vive en profesionales/pacientes';

-- =====================================================================
-- §3  ESPECIALIDADES  — catálogo
-- =====================================================================
CREATE TABLE especialidades (
    id_especialidad INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(255) NULL,
    activo          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_especialidad),
    UNIQUE KEY uq_especialidades_nombre (nombre),
    CONSTRAINT chk_especialidades_activo CHECK (activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de especialidades clínicas';

-- =====================================================================
-- §4  PROFESIONALES  — ficha de dominio del terapeuta  [R1][R3]
--     Relación 1:1 ESTRICTA con usuarios (UNIQUE id_usuario)
-- =====================================================================
CREATE TABLE profesionales (
    id_profesional            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    id_usuario                INT UNSIGNED     NOT NULL COMMENT '1:1 con usuarios',
    numero_registro           VARCHAR(30)      NOT NULL COMMENT 'Registro profesional (Superintendencia de Salud)',
    -- [R19] Título profesional (ej: "Kinesiólogo", "Psicóloga").
    --       Dato DISTINTO de numero_registro (folio de la Superintendencia).
    --       Requerido por US-13 (CRUD de terapeutas).
    titulo_profesional        VARCHAR(100)     NULL COMMENT '[R19] Título del profesional',
    id_especialidad_principal INT UNSIGNED     NULL,
    anios_experiencia         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    biografia                 TEXT             NULL,
    -- [R19] Estado de DISPONIBILIDAD OPERATIVA (agenda), distinto del
    --       soft-delete `activo`. Permite distinguir una ausencia temporal
    --       de una licencia prolongada sin desactivar la cuenta.
    --       Requerido por US-13 (CRUD de terapeutas).
    estado_disponibilidad     ENUM('DISPONIBLE','NO_DISPONIBLE','LICENCIA')
                              NOT NULL DEFAULT 'DISPONIBLE'
                              COMMENT '[R19] Disponibilidad operativa para agendar',
    activo                    TINYINT(1)       NOT NULL DEFAULT 1 COMMENT 'Soft-delete (0 = ficha deshabilitada)',
    created_at                TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_profesional),
    UNIQUE KEY uq_profesionales_usuario  (id_usuario),   -- [R3] fuerza 1:1
    UNIQUE KEY uq_profesionales_registro (numero_registro),
    KEY ix_profesionales_especialidad    (id_especialidad_principal),
    KEY ix_profesionales_disponibilidad  (estado_disponibilidad, activo),
    CONSTRAINT fk_profesionales_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_profesionales_especialidad
        FOREIGN KEY (id_especialidad_principal) REFERENCES especialidades (id_especialidad)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_profesionales_activo CHECK (activo IN (0,1)),
    CONSTRAINT chk_profesionales_anios  CHECK (anios_experiencia <= 70)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ficha de dominio del profesional. 1:1 con usuarios';

-- =====================================================================
-- §5  PACIENTES  — ficha de dominio del paciente  [R1][R3]
-- =====================================================================
CREATE TABLE pacientes (
    id_paciente        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario         INT UNSIGNED NOT NULL COMMENT '1:1 con usuarios',
    fecha_nacimiento   DATE         NULL,
    telefono           VARCHAR(20)  NULL,
    direccion          VARCHAR(180) NULL,
    prevision          ENUM('FONASA','ISAPRE','PARTICULAR','OTRA') NOT NULL DEFAULT 'PARTICULAR',
    contacto_emergencia VARCHAR(120) NULL,
    telefono_emergencia VARCHAR(20)  NULL,
    activo             TINYINT(1)   NOT NULL DEFAULT 1,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_paciente),
    UNIQUE KEY uq_pacientes_usuario (id_usuario),        -- [R3] fuerza 1:1
    KEY ix_pacientes_prevision      (prevision),
    CONSTRAINT fk_pacientes_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_pacientes_activo CHECK (activo IN (0,1)),
    -- MySQL 8.0 prohíbe funciones no deterministas (CURRENT_DATE) en CHECK.
    -- Se valida un rango estático; la fecha futura se controla en la app.
    CONSTRAINT chk_pacientes_nac    CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento >= '1900-01-01')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ficha de dominio del paciente. 1:1 con usuarios';

-- =====================================================================
-- §6  PROFESIONAL_ESPECIALIDAD  — puente N:M  [R4]
-- =====================================================================
CREATE TABLE profesional_especialidad (
    id_profesional  INT UNSIGNED NOT NULL,
    id_especialidad INT UNSIGNED NOT NULL,
    es_principal    TINYINT(1)   NOT NULL DEFAULT 0,
    -- [R12] Clave generada: vale id_profesional solo para la fila marcada como
    --       principal, y NULL para el resto. Como los NULL no colisionan en un
    --       índice UNIQUE de MySQL, esto fuerza COMO MÁXIMO UNA especialidad
    --       principal por profesional, sin bloquear las secundarias.
    --       ⚠️  Debe ser VIRTUAL (no STORED): id_profesional es columna base
    --       de esta generada, y MySQL 8.0 prohíbe que la columna base de una
    --       generada STORED tenga una FK con CASCADE/SET NULL/SET DEFAULT
    --       ("A foreign key constraint on the base column of a stored
    --       generated column cannot use CASCADE..."). Con VIRTUAL la
    --       restricción no aplica y el UNIQUE sigue funcionando en InnoDB.
    uq_principal   INT UNSIGNED GENERATED ALWAYS AS (
                       CASE WHEN es_principal = 1 THEN id_profesional ELSE NULL END
                   ) VIRTUAL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_profesional, id_especialidad),
    UNIQUE KEY uq_profesp_principal (uq_principal),   -- [R12] máx. 1 principal/prof
    KEY ix_profesp_especialidad (id_especialidad),
    CONSTRAINT fk_profesp_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesionales (id_profesional)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_profesp_especialidad
        FOREIGN KEY (id_especialidad) REFERENCES especialidades (id_especialidad)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_profesp_principal CHECK (es_principal IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Puente N:M profesional <-> especialidad (máx. 1 principal por profesional)';

-- =====================================================================
-- §7  SERVICIOS  — prestaciones ofrecidas
-- =====================================================================
CREATE TABLE servicios (
    id_servicio     INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    id_especialidad INT UNSIGNED     NULL,
    codigo          VARCHAR(20)      NOT NULL,
    nombre          VARCHAR(120)     NOT NULL,
    descripcion     VARCHAR(255)     NULL,
    duracion_min    SMALLINT UNSIGNED NOT NULL COMMENT 'Duración en minutos',
    precio          DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
    -- [R13] Aforo NOMINAL/descriptivo del servicio. El aforo que realmente se
    --       aplica en el agendamiento es bloques_horarios.aforo_maximo (fuente
    --       única operativa, usada por sp_agendar_cita y los triggers). Esta
    --       columna solo documenta la naturaleza del servicio (individual=1,
    --       grupal>1) y NO participa en las validaciones de cupo.
    aforo_nominal   SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Aforo informativo (individual=1, grupal>1)',
    activo          TINYINT(1)       NOT NULL DEFAULT 1,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_servicio),
    UNIQUE KEY uq_servicios_codigo (codigo),
    KEY ix_servicios_especialidad  (id_especialidad),
    KEY ix_servicios_activo        (activo),
    CONSTRAINT fk_servicios_especialidad
        FOREIGN KEY (id_especialidad) REFERENCES especialidades (id_especialidad)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_servicios_duracion CHECK (duracion_min BETWEEN 5 AND 480),
    CONSTRAINT chk_servicios_precio   CHECK (precio >= 0),
    CONSTRAINT chk_servicios_aforo    CHECK (aforo_nominal >= 1),
    CONSTRAINT chk_servicios_activo   CHECK (activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Servicios/prestaciones con duración, precio y aforo nominal';

-- =====================================================================
-- §8  BLOQUES_HORARIOS  — plantilla de disponibilidad  [R1]
--     Apunta a profesionales, NO a usuarios
-- =====================================================================
CREATE TABLE bloques_horarios (
    id_bloque      INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    id_profesional INT UNSIGNED      NOT NULL COMMENT '[R1] FK a profesionales',
    dia_semana     TINYINT UNSIGNED  NOT NULL COMMENT '1=Lunes ... 7=Domingo (ISO-8601)',
    hora_inicio    TIME              NOT NULL,
    hora_fin       TIME              NOT NULL,
    aforo_maximo   SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Aforo dinámico del bloque',
    activo         TINYINT(1)        NOT NULL DEFAULT 1,
    created_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_bloque),
    UNIQUE KEY uq_bloques_prof_dia_hora (id_profesional, dia_semana, hora_inicio),
    KEY ix_bloques_prof_dia (id_profesional, dia_semana, activo),
    CONSTRAINT fk_bloques_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesionales (id_profesional)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_bloques_dia    CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT chk_bloques_rango  CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_bloques_aforo  CHECK (aforo_maximo >= 1),
    CONSTRAINT chk_bloques_activo CHECK (activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Plantilla semanal de disponibilidad por profesional';

-- =====================================================================
-- §9  CITAS  — núcleo transaccional  [R1][R5][R6]
-- =====================================================================
CREATE TABLE citas (
    id_cita        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    id_paciente    INT UNSIGNED     NOT NULL COMMENT '[R1] FK a pacientes',
    id_profesional INT UNSIGNED     NOT NULL COMMENT '[R1] FK a profesionales',
    id_servicio    INT UNSIGNED     NOT NULL,
    id_bloque      INT UNSIGNED     NULL COMMENT 'Bloque plantilla de origen',
    fecha_cita     DATE             NOT NULL,
    hora_inicio    TIME             NOT NULL,
    hora_fin       TIME             NOT NULL,
    estado         ENUM('PENDIENTE','CONFIRMADA','EN_CURSO','ATENDIDA','CANCELADA','NO_ASISTIO')
                   NOT NULL DEFAULT 'PENDIENTE',
    -- Marca si la cita pertenece a un bloque GRUPAL (aforo > 1).
    -- En citas grupales varios pacientes comparten profesional/fecha/hora,
    -- por lo que NO deben colisionar en el índice único; su tope lo
    -- controla el aforo dinámico (SP + triggers).
    -- El trigger trg_citas_bi_validacion la deriva de bloques_horarios.aforo_maximo
    -- para que un INSERT directo no pueda saltarse la coherencia.
    es_grupal      TINYINT(1)       NOT NULL DEFAULT 0,
    -- [R5] Columna generada: NULL cuando la cita NO ocupa slot exclusivo.
    --      - Cancelada / no asistió  -> libera el horario
    --      - Grupal (aforo > 1)      -> comparte horario con otros pacientes
    --      En MySQL los NULL no colisionan en índices UNIQUE, por lo que
    --      el índice solo protege los slots individuales.
    --      ⚠️  Este índice SÓLO detecta colisión de hora_inicio idéntica. El
    --      solapamiento PARCIAL de rangos (p.ej. 09:00-09:45 vs 09:30-10:15)
    --      lo valida el trigger trg_citas_bi_validacion, que es donde vive la
    --      regla de "sin doble reserva de rango" la valida el trigger
    --      trg_citas_bi_validacion (ver db/triggers/).
    slot_activo    TIME GENERATED ALWAYS AS (
                       CASE WHEN es_grupal = 1
                                 OR estado IN ('CANCELADA','NO_ASISTIO')
                            THEN NULL ELSE hora_inicio END
                   ) STORED,
    motivo         VARCHAR(255)     NULL,
    observaciones  TEXT             NULL,
    created_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cita),
    -- [R5] ANTI-COLISIÓN HORARIA: un profesional no puede tener 2 citas
    --      vigentes en la misma fecha y hora.
    UNIQUE KEY uq_citas_slot (id_profesional, fecha_cita, slot_activo),
    KEY ix_citas_paciente_fecha     (id_paciente, fecha_cita),
    KEY ix_citas_prof_fecha         (id_profesional, fecha_cita),
    KEY ix_citas_servicio           (id_servicio),
    KEY ix_citas_bloque             (id_bloque),
    KEY ix_citas_estado_fecha       (estado, fecha_cita),
    CONSTRAINT fk_citas_paciente
        FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesionales (id_profesional)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_servicio
        FOREIGN KEY (id_servicio) REFERENCES servicios (id_servicio)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_bloque
        FOREIGN KEY (id_bloque) REFERENCES bloques_horarios (id_bloque)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_citas_rango  CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_citas_fecha  CHECK (fecha_cita >= '2020-01-01'),
    CONSTRAINT chk_citas_grupal CHECK (es_grupal IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Agendamiento. Índice único compuesto anti-colisión horaria (slots individuales)';

-- =====================================================================
-- §10  CLASES_GRUPALES  — talleres con aforo  [R15]
--      Coexiste con `citas` (agenda individual). El aforo se controla
--      por triggers sobre `reservas_clases` (ver db/triggers/):
--        trg_control_aforo_clases  -> descuenta cupo al inscribirse
--        trg_reserva_cupo_update   -> devuelve/consume cupo [US-09]
--        trg_reserva_cupo_delete   -> devuelve cupo al eliminar [US-09]
-- =====================================================================
CREATE TABLE clases_grupales (
    id_clase          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    nombre_actividad  VARCHAR(100)     NOT NULL,
    descripcion       TEXT             NULL,
    -- [R20] Ubicación física donde se dicta el taller (US-11).
    --       Nullable: un taller puede no tener sala asignada aún.
    sala              VARCHAR(60)      NULL COMMENT '[R20] Sala o ubicación física del taller',
    id_instructor     INT UNSIGNED     NOT NULL COMMENT 'Profesional que dicta la clase',
    aforo_maximo      INT UNSIGNED     NOT NULL COMMENT 'Cupos totales de la clase',
    cupos_disponibles INT UNSIGNED     NOT NULL COMMENT 'Cupos restantes (lo decrementa el trigger)',
    fecha_clase       DATE             NOT NULL,
    hora_inicio       TIME             NOT NULL,
    hora_fin          TIME             NOT NULL,
    estado_clase      ENUM('PROGRAMADA','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PROGRAMADA',
    created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_clase),
    KEY ix_clases_instructor_fecha (id_instructor, fecha_clase),
    KEY ix_clases_estado_fecha     (estado_clase, fecha_clase),
    KEY ix_clases_sala_fecha       (sala, fecha_clase),
    CONSTRAINT fk_clases_instructor
        FOREIGN KEY (id_instructor) REFERENCES profesionales (id_profesional)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_clases_rango   CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_clases_aforo   CHECK (aforo_maximo >= 1),
    CONSTRAINT chk_clases_cupos   CHECK (cupos_disponibles <= aforo_maximo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Clases/talleres grupales con aforo controlado por trigger';

-- =====================================================================
-- §11  RESERVAS_CLASES  — inscripciones a clases grupales  [R15]
--      El trigger trg_control_aforo_clases valida cupo y decrementa.
-- =====================================================================
CREATE TABLE reservas_clases (
    id_reserva_clase   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- [R1] El alumno es un PACIENTE (entidad de dominio), no un usuario
    --      cualquiera: así un ADMINISTRADOR o TERAPEUTA no puede inscribirse.
    --      Coherente con citas.id_paciente.
    id_paciente        INT UNSIGNED NOT NULL COMMENT '[R1] Paciente que se inscribe',
    id_clase           INT UNSIGNED NOT NULL,
    fecha_inscripcion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_reserva     ENUM('ACTIVA','CANCELADA') NOT NULL DEFAULT 'ACTIVA',
    PRIMARY KEY (id_reserva_clase),
    UNIQUE KEY uq_paciente_clase (id_paciente, id_clase),
    KEY ix_reservas_clase (id_clase),
    CONSTRAINT fk_reservas_paciente
        FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reservas_clase
        FOREIGN KEY (id_clase) REFERENCES clases_grupales (id_clase)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Inscripciones a clases grupales (aforo por trigger)';

-- =====================================================================
-- §12  PAGOS  — transacción financiera con exclusividad XOR  [R3][R7][R16]
--      Un pago corresponde a UNA cita O a UNA reserva de clase, nunca a
--      ambas ni a ninguna. Se garantiza con CHECK (no con polimorfismo).
-- =====================================================================
CREATE TABLE pagos (
    id_pago           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_cita           INT UNSIGNED  NULL COMMENT '[R16] XOR: cita individual',
    id_reserva_clase  INT UNSIGNED  NULL COMMENT '[R16] XOR: reserva de clase grupal',
    monto             DECIMAL(10,2) NOT NULL,
    metodo_pago       ENUM('EFECTIVO','DEBITO','CREDITO','TRANSFERENCIA','SEGURO') NOT NULL DEFAULT 'EFECTIVO',
    estado_pago       ENUM('PENDIENTE','PAGADO','RECHAZADO','REEMBOLSADO') NOT NULL DEFAULT 'PENDIENTE',
    referencia        VARCHAR(60)   NULL COMMENT 'N° transacción / voucher',
    fecha_pago        DATETIME      NULL,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_pago),
    UNIQUE KEY uq_pagos_cita          (id_cita),          -- 1:1 con cita
    UNIQUE KEY uq_pagos_reserva_clase (id_reserva_clase), -- 1:1 con reserva
    KEY ix_pagos_estado_fecha (estado_pago, fecha_pago),
    -- ⚠️ MySQL 8.0 prohíbe acciones referenciales (CASCADE/SET NULL) en
    --    columnas usadas por un CHECK (error 3823). Como id_cita e
    --    id_reserva_clase participan en chk_pago_servicio_exclusivo, sus
    --    FK deben ser RESTRICT. Además es lo correcto para registros
    --    financieros: un pago no debe borrarse en cascada.
    CONSTRAINT fk_pagos_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_pagos_reserva_clase
        FOREIGN KEY (id_reserva_clase) REFERENCES reservas_clases (id_reserva_clase)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_pagos_monto CHECK (monto >= 0),
    -- [R16] Exclusividad estricta: exactamente uno de los dos destinos.
    CONSTRAINT chk_pago_servicio_exclusivo CHECK (
        (id_cita IS NOT NULL AND id_reserva_clase IS NULL)
     OR (id_cita IS NULL     AND id_reserva_clase IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pagos con exclusividad XOR: cita individual o reserva de clase';

-- =====================================================================
-- §13  COMPROBANTES_PDF  — 1:1 con pagos  [R17]
--      Resuelve la duda del docente: el comprobante NO cuelga de
--      `usuarios` (evita redundancia transitiva), sino de la transacción
--      monetaria que lo origina. Relación 1:1 estricta vía UNIQUE.
-- =====================================================================
CREATE TABLE comprobantes_pdf (
    id_comprobante      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_transaccion      INT UNSIGNED NOT NULL COMMENT '[R17] 1:1 con pagos',
    codigo_verificacion VARCHAR(64)  NOT NULL COMMENT 'Código público de validación',
    url_pdf             VARCHAR(255) NULL,
    fecha_generacion    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_comprobante),
    UNIQUE KEY uq_comprobante_transaccion (id_transaccion),  -- fuerza 1:1
    UNIQUE KEY uq_comprobante_codigo      (codigo_verificacion),
    CONSTRAINT fk_comprobante_pago
        FOREIGN KEY (id_transaccion) REFERENCES pagos (id_pago)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Comprobantes PDF. 1:1 con pagos (no con usuarios)';

-- =====================================================================
-- §14  NOVEDADES  — contenido institucional  [R18]
-- =====================================================================
CREATE TABLE novedades (
    id_novedad         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    titulo             VARCHAR(200) NOT NULL,
    resumen            VARCHAR(255) NULL,
    contenido          TEXT         NULL,
    imagen_url         VARCHAR(255) NULL,
    fecha_publicacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_autor_admin     INT UNSIGNED NOT NULL COMMENT 'Administrador que publica',
    estado             ENUM('PUBLICADO','BORRADOR','OCULTO') NOT NULL DEFAULT 'BORRADOR',
    PRIMARY KEY (id_novedad),
    KEY ix_novedades_estado_fecha (estado, fecha_publicacion),
    KEY ix_novedades_autor        (id_autor_admin),
    CONSTRAINT fk_novedades_autor
        FOREIGN KEY (id_autor_admin) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Novedades/noticias publicadas por administradores';

-- =====================================================================
-- §15  NOTIFICACIONES  — [R2] SIN polimorfismo: FK explícita a citas
-- =====================================================================
CREATE TABLE notificaciones (
    id_notificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario      INT UNSIGNED NOT NULL COMMENT 'Destinatario',
    id_cita         INT UNSIGNED NULL     COMMENT '[R2] FK explícita (no polimórfica)',
    tipo            ENUM('RECORDATORIO','CONFIRMACION','CANCELACION','PAGO','SISTEMA') NOT NULL DEFAULT 'SISTEMA',
    titulo          VARCHAR(120) NOT NULL,
    mensaje         VARCHAR(500) NOT NULL,
    leida           TINYINT(1)   NOT NULL DEFAULT 0,
    fecha_lectura   DATETIME     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_notificacion),
    KEY ix_notif_usuario_leida (id_usuario, leida),
    KEY ix_notif_cita          (id_cita),
    CONSTRAINT fk_notif_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notif_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_notif_leida CHECK (leida IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notificaciones. FK explícita a citas: polimorfismo eliminado';

-- =====================================================================
-- §16  AUDITORIA  — log inmutable  [R2]
--      ÚNICO caso donde se tolera referencia polimórfica (sin FK),
--      porque el log debe sobrevivir al borrado de la fila original.
-- =====================================================================
CREATE TABLE auditoria (
    id_auditoria    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario      INT UNSIGNED    NULL COMMENT 'Actor; NULL si el usuario fue borrado',
    tabla_afectada  ENUM('roles','usuarios','especialidades','profesionales','pacientes',
                         'profesional_especialidad','servicios','bloques_horarios',
                         'citas','clases_grupales','reservas_clases','pagos',
                         'comprobantes_pdf','novedades','notificaciones','configuracion') NOT NULL,
    id_registro     BIGINT UNSIGNED NULL COMMENT '[R2] Referencia LÓGICA sin FK (polimorfismo controlado)',
    accion          ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FALLIDO') NOT NULL,
    detalle         JSON            NULL,
    ip_origen       VARCHAR(45)     NULL COMMENT 'IPv4/IPv6',
    fecha_evento    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_auditoria),
    KEY ix_auditoria_tabla_fecha (tabla_afectada, fecha_evento),
    KEY ix_auditoria_usuario     (id_usuario, fecha_evento),
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log inmutable. Polimorfismo tolerado SOLO aquí (sin FK)';

-- =====================================================================
-- §17  CONFIGURACION  — parámetros clave/valor
-- =====================================================================
CREATE TABLE configuracion (
    id_config   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    clave       VARCHAR(60)  NOT NULL,
    valor       VARCHAR(255) NOT NULL,
    tipo_dato   ENUM('STRING','INT','BOOLEAN','JSON','DECIMAL') NOT NULL DEFAULT 'STRING',
    descripcion VARCHAR(255) NULL,
    editable    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_config),
    UNIQUE KEY uq_config_clave (clave),
    CONSTRAINT chk_config_editable CHECK (editable IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Parámetros de configuración del sistema';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- §18  VISTA DE APOYO — usuarios con su rol (contrato US-01)
-- =====================================================================
CREATE OR REPLACE VIEW v_usuarios_roles AS
SELECT  u.id_usuario,
        u.rut,
        u.nombre,
        u.apellido,
        u.email,
        u.estado,
        r.nombre_rol AS rol,
        u.ultimo_acceso,
        u.created_at
FROM    usuarios u
JOIN    roles    r ON r.id_rol = u.id_rol;

-- =====================================================================
-- LIMPIEZA DE OBJETOS PROGRAMABLES (idempotencia)
-- ---------------------------------------------------------------------
-- Los CREATE de stored procedures y triggers ya NO viven en este
-- archivo: están separados por responsabilidad en:
--     db/stored_procedures/*.sql
--     db/triggers/*.sql
--
-- Ejecutar `npm run db:setup` para crear tablas + SP + triggers + seed
-- en el orden correcto. Este bloque deja la BD sin objetos programables
-- para que una re-ejecución de schema.sql no arrastre versiones previas.
-- =====================================================================
DROP PROCEDURE IF EXISTS sp_agendar_cita;

DROP TRIGGER IF EXISTS trg_citas_bi_validacion;
DROP TRIGGER IF EXISTS trg_citas_bu_validacion;
DROP TRIGGER IF EXISTS trg_citas_ai_auditoria;
DROP TRIGGER IF EXISTS trg_control_aforo_clases;

-- [US-09] Control de aforo bidireccional en reservas_clases
DROP TRIGGER IF EXISTS trg_reserva_cupo_update;
DROP TRIGGER IF EXISTS trg_reserva_cupo_delete;

-- nombres legados (idempotencia si existían de una versión previa)
DROP TRIGGER IF EXISTS trg_citas_bi_aforo;
DROP TRIGGER IF EXISTS trg_citas_bu_aforo;

-- =====================================================================
-- FIN DEL SCRIPT — schema.sql
-- =====================================================================
