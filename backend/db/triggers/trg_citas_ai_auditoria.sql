-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_citas_ai_auditoria
--  Archivo: db/triggers/trg_citas_ai_auditoria.sql
--  [R11] AFTER INSERT en citas — registro en auditoría
-- =====================================================================

DROP TRIGGER IF EXISTS trg_citas_ai_auditoria;

DELIMITER //

CREATE TRIGGER trg_citas_ai_auditoria
AFTER INSERT ON citas
FOR EACH ROW
BEGIN
    INSERT INTO auditoria (id_usuario, tabla_afectada, id_registro, accion, detalle)
    VALUES (
        NULL,
        'citas',
        NEW.id_cita,
        'INSERT',
        JSON_OBJECT(
            'id_paciente',    NEW.id_paciente,
            'id_profesional', NEW.id_profesional,
            'id_servicio',    NEW.id_servicio,
            'fecha_cita',     NEW.fecha_cita,
            'hora_inicio',    NEW.hora_inicio,
            'estado',         NEW.estado
        )
    );
END //

DELIMITER ;
