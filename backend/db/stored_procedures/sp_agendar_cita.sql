-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Stored Procedure: sp_agendar_cita
--  Archivo: db/stored_procedures/sp_agendar_cita.sql
--  [R10] Bloqueo pesimista + validación de aforo + rollback atómico
-- =====================================================================
--  Ejecutar DESPUÉS de schema.sql.
--  El runner oficial es:  npm run db:setup
-- =====================================================================

DROP PROCEDURE IF EXISTS sp_agendar_cita;

DELIMITER //

CREATE PROCEDURE sp_agendar_cita (
    IN  p_id_paciente    INT UNSIGNED,
    IN  p_id_profesional INT UNSIGNED,
    IN  p_id_servicio    INT UNSIGNED,
    IN  p_id_bloque      INT UNSIGNED,
    IN  p_fecha          DATE,
    IN  p_hora_inicio    TIME,
    OUT p_id_cita        INT UNSIGNED,
    OUT p_mensaje        VARCHAR(255)
)
BEGIN
    DECLARE v_duracion     SMALLINT UNSIGNED DEFAULT 0;
    DECLARE v_aforo        SMALLINT UNSIGNED DEFAULT 0;
    DECLARE v_ocupados     INT DEFAULT 0;
    DECLARE v_hora_fin     TIME;
    DECLARE v_bloque_ini   TIME;
    DECLARE v_bloque_fin   TIME;
    DECLARE v_dia_bloque   TINYINT UNSIGNED;
    DECLARE v_servicio_ok  TINYINT DEFAULT 0;
    DECLARE v_prof_ok      TINYINT DEFAULT 0;

    -- Rollback atomico ante cualquier excepcion
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_id_cita = NULL;
        SET p_mensaje = 'ERROR: transaccion revertida (ROLLBACK)';
        RESIGNAL;
    END;

    SET p_id_cita = NULL;

    START TRANSACTION;

    -- 1) Validar servicio activo y obtener duracion
    SELECT duracion_min, 1
      INTO v_duracion, v_servicio_ok
      FROM servicios
     WHERE id_servicio = p_id_servicio
       AND activo = 1
     FOR UPDATE;

    IF v_servicio_ok = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Servicio inexistente o inactivo';
    END IF;

    -- 2) Validar profesional activo
    SELECT 1 INTO v_prof_ok
      FROM profesionales
     WHERE id_profesional = p_id_profesional
       AND activo = 1
     FOR UPDATE;

    IF v_prof_ok = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Profesional inexistente o inactivo';
    END IF;

    -- 3) Bloquear el bloque horario y leer su aforo dinamico
    SELECT aforo_maximo, hora_inicio, hora_fin, dia_semana
      INTO v_aforo, v_bloque_ini, v_bloque_fin, v_dia_bloque
      FROM bloques_horarios
     WHERE id_bloque = p_id_bloque
       AND id_profesional = p_id_profesional
       AND activo = 1
     FOR UPDATE;

    IF v_aforo = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bloque horario invalido para el profesional';
    END IF;

    -- 3.1) La hora solicitada debe caer dentro del rango del bloque
    IF p_hora_inicio < v_bloque_ini OR p_hora_inicio >= v_bloque_fin THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La hora solicitada esta fuera del rango del bloque';
    END IF;

    -- 3.2) La fecha debe corresponder al dia de semana del bloque (ISO 1-7)
    IF (WEEKDAY(p_fecha) + 1) <> v_dia_bloque THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha no corresponde al dia de la semana del bloque';
    END IF;

    -- 4) Calcular hora de termino
    SET v_hora_fin = ADDTIME(p_hora_inicio, SEC_TO_TIME(v_duracion * 60));

    -- 4.1) La cita no puede exceder el termino del bloque
    IF v_hora_fin > v_bloque_fin THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La duracion del servicio excede el bloque horario';
    END IF;

    -- 5) Contar citas vigentes del MISMO slot
    SELECT COUNT(*)
      INTO v_ocupados
      FROM citas
     WHERE id_bloque   = p_id_bloque
       AND fecha_cita  = p_fecha
       AND hora_inicio = p_hora_inicio
       AND estado NOT IN ('CANCELADA','NO_ASISTIO');

    IF v_ocupados >= v_aforo THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aforo maximo alcanzado para el bloque';
    END IF;

    -- 6) Insertar la cita
    INSERT INTO citas (
        id_paciente, id_profesional, id_servicio, id_bloque,
        fecha_cita, hora_inicio, hora_fin, estado
    ) VALUES (
        p_id_paciente, p_id_profesional, p_id_servicio, p_id_bloque,
        p_fecha, p_hora_inicio, v_hora_fin, 'PENDIENTE'
    );

    SET p_id_cita = LAST_INSERT_ID();
    SET p_mensaje = CONCAT('Cita agendada correctamente. ID=', p_id_cita);

    COMMIT;
END //

DELIMITER ;
