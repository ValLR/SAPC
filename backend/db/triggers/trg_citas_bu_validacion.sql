-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_citas_bu_validacion
--  Archivo: db/triggers/trg_citas_bu_validacion.sql
--  [R11][R14] BEFORE UPDATE en citas
-- =====================================================================
--  Mismas validaciones que trg_citas_bi_validacion, aplicadas al mover
--  o reactivar una cita. Excluye la propia fila (id_cita <> NEW.id_cita).
-- =====================================================================

DROP TRIGGER IF EXISTS trg_citas_bu_validacion;

DELIMITER //

CREATE TRIGGER trg_citas_bu_validacion
BEFORE UPDATE ON citas
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

        IF (WEEKDAY(NEW.fecha_cita) + 1) <> v_dia_bloque THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'La fecha no corresponde al día de la semana del bloque';
        END IF;

        IF NEW.hora_inicio < v_ini_bloque OR NEW.hora_fin > v_fin_bloque THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'La cita está fuera del rango del bloque horario';
        END IF;

        SET NEW.es_grupal = CASE WHEN v_aforo > 1 THEN 1 ELSE 0 END;
    END IF;

    IF NEW.estado NOT IN ('CANCELADA','NO_ASISTIO') THEN

        IF NEW.es_grupal = 1 THEN
            SELECT COUNT(*) INTO v_ocupados
              FROM citas
             WHERE id_profesional = NEW.id_profesional
               AND fecha_cita     = NEW.fecha_cita
               AND hora_inicio    = NEW.hora_inicio
               AND estado NOT IN ('CANCELADA','NO_ASISTIO')
               AND id_cita <> NEW.id_cita;

            IF v_ocupados >= v_aforo THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'No se puede reactivar: aforo máximo alcanzado';
            END IF;
        ELSE
            SELECT COUNT(*) INTO v_solapes
              FROM citas
             WHERE id_profesional = NEW.id_profesional
               AND fecha_cita     = NEW.fecha_cita
               AND estado NOT IN ('CANCELADA','NO_ASISTIO')
               AND id_cita <> NEW.id_cita
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
