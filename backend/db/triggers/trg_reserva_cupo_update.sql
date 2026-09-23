-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_reserva_cupo_update
--  Archivo: db/triggers/trg_reserva_cupo_update.sql
--  Historia: US-09 (SCRUM-46 / control de aforo y cupos dinámicos)
-- =====================================================================
--  BEFORE UPDATE en reservas_clases.
--
--  Cierra el ciclo del aforo que trg_control_aforo_clases sólo abría por
--  el lado de la inscripción:
--
--    (a) ACTIVA -> CANCELADA   => DEVUELVE el cupo a la clase.
--    (b) CANCELADA -> ACTIVA   => vuelve a CONSUMIR cupo, validando que
--                                 exista disponibilidad (si no, aborta).
--    (c) Cambio de id_clase    => libera el cupo en la clase origen y lo
--                                 consume en la clase destino.
--
--  Se implementa como UN ÚNICO trigger (en lugar de dos triggers
--  separados) siguiendo el mismo criterio que §20 del schema: consolidar
--  en un solo BEFORE UPDATE evita depender del orden de ejecución entre
--  triggers sobre el mismo evento.
--
--  El incremento usa LEAST(aforo_maximo, ...) para respetar siempre la
--  restricción chk_clases_cupos (cupos_disponibles <= aforo_maximo).
-- =====================================================================

DROP TRIGGER IF EXISTS trg_reserva_cupo_update;

DELIMITER //

CREATE TRIGGER trg_reserva_cupo_update
BEFORE UPDATE ON reservas_clases
FOR EACH ROW
BEGIN
    DECLARE v_cupos INT DEFAULT 0;

    -- -----------------------------------------------------------------
    -- (a)(c) La reserva deja de ocupar cupo en la clase anterior
    -- -----------------------------------------------------------------
    IF OLD.estado_reserva = 'ACTIVA'
       AND (NEW.estado_reserva <> 'ACTIVA' OR NEW.id_clase <> OLD.id_clase) THEN

        UPDATE clases_grupales
           SET cupos_disponibles = LEAST(aforo_maximo, cupos_disponibles + 1)
         WHERE id_clase = OLD.id_clase;
    END IF;

    -- -----------------------------------------------------------------
    -- (b)(c) La reserva pasa a ocupar cupo en la clase nueva
    -- -----------------------------------------------------------------
    IF NEW.estado_reserva = 'ACTIVA'
       AND (OLD.estado_reserva <> 'ACTIVA' OR NEW.id_clase <> OLD.id_clase) THEN

        -- Bloqueo pesimista: evita sobreventa si dos reactivaciones
        -- compiten por el último cupo.
        SELECT cupos_disponibles
          INTO v_cupos
          FROM clases_grupales
         WHERE id_clase = NEW.id_clase
         FOR UPDATE;

        IF v_cupos <= 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Aforo máximo alcanzado para la clase grupal';
        END IF;

        UPDATE clases_grupales
           SET cupos_disponibles = cupos_disponibles - 1
         WHERE id_clase = NEW.id_clase;
    END IF;
END //

DELIMITER ;
