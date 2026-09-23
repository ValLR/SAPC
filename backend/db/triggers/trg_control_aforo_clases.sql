-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_control_aforo_clases
--  Archivo: db/triggers/trg_control_aforo_clases.sql
--  [R15] BEFORE INSERT en inscripciones_clases
-- =====================================================================
--  Control de aforo + decremento atómico del cupo disponible.
--  Si no hay cupo, aborta con SIGNAL SQLSTATE '45000'.
--
--  Complementado por trg_inscripcion_cupo_update y trg_inscripcion_cupo_delete,
--  que devuelven el cupo cuando la inscripción se cancela o se elimina.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_control_aforo_clases;

DELIMITER //

CREATE TRIGGER trg_control_aforo_clases
BEFORE INSERT ON inscripciones_clases
FOR EACH ROW
BEGIN
    DECLARE v_cupos INT DEFAULT 0;

    -- Bloqueo pesimista de la fila de la clase para evitar sobreventa
    -- bajo concurrencia (dos inscripciones simultáneas al último cupo).
    SELECT cupos_disponibles
      INTO v_cupos
      FROM clases_grupales
     WHERE id_clase = NEW.id_clase
     FOR UPDATE;

    IF v_cupos <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Aforo máximo alcanzado para la clase grupal';
    END IF;

    -- Decremento atómico del cupo disponible.
    UPDATE clases_grupales
       SET cupos_disponibles = cupos_disponibles - 1
     WHERE id_clase = NEW.id_clase;
END //

DELIMITER ;
