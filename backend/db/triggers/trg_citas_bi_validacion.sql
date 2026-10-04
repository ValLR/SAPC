-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_citas_bi_validacion
--  Archivo: db/triggers/trg_citas_bi_validacion.sql
--  [R11][R14] BEFORE INSERT en citas
-- =====================================================================
--  Consolida en un ÚNICO BEFORE INSERT: coherencia bloque/día/rango,
--  derivación de es_grupal y control de aforo/solapamiento. Así ninguna
--  ruta de escritura (SP o INSERT directo) puede saltarse las reglas.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_citas_bi_validacion;

DELIMITER //

CREATE TRIGGER trg_citas_bi_validacion
BEFORE INSERT ON citas
FOR EACH ROW
BEGIN
    DECLARE v_aforo       SMALLINT UNSIGNED DEFAULT 1;
    DECLARE v_dia_bloque  TINYINT UNSIGNED DEFAULT NULL;
    DECLARE v_ini_bloque  TIME DEFAULT NULL;
    DECLARE v_fin_bloque  TIME DEFAULT NULL;
    DECLARE v_prof_bloque INT UNSIGNED DEFAULT NULL;
    DECLARE v_ocupados    INT DEFAULT 0;
    DECLARE v_solapes     INT DEFAULT 0;

    IF NEW.id_bloque IS NOT NULL THEN

        -- (a) Cargar el bloque y validar que pertenece al MISMO profesional.
        SELECT aforo_maximo, dia_semana, hora_inicio, hora_fin, id_profesional
          INTO v_aforo, v_dia_bloque, v_ini_bloque, v_fin_bloque, v_prof_bloque
          FROM bloques_horarios
         WHERE id_bloque = NEW.id_bloque;

        IF v_prof_bloque IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Bloque horario inexistente';
        END IF;

        IF v_prof_bloque <> NEW.id_profesional THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'El bloque no pertenece al profesional de la cita';
        END IF;

        -- (b) El día de la semana de la fecha debe coincidir con el del bloque.
        --     WEEKDAY() = 0 (lunes) .. 6 (domingo) -> +1 => ISO-8601.
        IF (WEEKDAY(NEW.fecha_cita) + 1) <> v_dia_bloque THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'La fecha no corresponde al día de la semana del bloque';
        END IF;

        -- (c) La cita debe caer dentro del rango horario del bloque.
        IF NEW.hora_inicio < v_ini_bloque OR NEW.hora_fin > v_fin_bloque THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'La cita está fuera del rango del bloque horario';
        END IF;

        -- (d) [R14] Derivar es_grupal del aforo del bloque (no delegable al
        --     llamador): aforo > 1 => grupal. Así un INSERT directo con
        --     es_grupal=0 en un bloque grupal no puede romper el índice.
        SET NEW.es_grupal = CASE WHEN v_aforo > 1 THEN 1 ELSE 0 END;
    END IF;

    -- Sólo las citas VIGENTES ocupan cupo/slot.
    IF NEW.estado NOT IN ('CANCELADA','NO_ASISTIO') THEN

        IF NEW.es_grupal = 1 THEN
            -- (e) Cupo grupal: se cuentan las vigentes del MISMO slot exacto.
            SELECT COUNT(*) INTO v_ocupados
              FROM citas
             WHERE id_profesional = NEW.id_profesional
               AND fecha_cita     = NEW.fecha_cita
               AND hora_inicio    = NEW.hora_inicio
               AND estado NOT IN ('CANCELADA','NO_ASISTIO');

            IF v_ocupados >= v_aforo THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Aforo máximo alcanzado para el bloque (trigger)';
            END IF;
        ELSE
            -- (f) [R14] Slot individual: se prohíbe SOLAPAMIENTO de rangos
            --     (no sólo inicio idéntico). Cubre 09:00-09:45 vs 09:30-10:15.
            SELECT COUNT(*) INTO v_solapes
              FROM citas
             WHERE id_profesional = NEW.id_profesional
               AND fecha_cita     = NEW.fecha_cita
               AND estado NOT IN ('CANCELADA','NO_ASISTIO')
               AND NEW.hora_inicio < hora_fin
               AND NEW.hora_fin    > hora_inicio;

            IF v_solapes > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Solapamiento horario con otra cita vigente del profesional';
            END IF;
        END IF;
    END IF;
END //

DELIMITER ;
