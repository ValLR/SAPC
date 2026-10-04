-- =====================================================================
--  S.A.P.C. — CHAWAL  |  Trigger: trg_inscripcion_cupo_delete
--  Archivo: db/triggers/trg_inscripcion_cupo_delete.sql
--  Historia: US-09 (control de aforo y cupos dinámicos)
-- =====================================================================
--  AFTER DELETE en inscripciones_clases.
--
--  Devuelve el cupo cuando una inscripción ACTIVA desaparece físicamente:
--
--    - Borrado directo de la inscripción.
--    - Borrado en cascada al eliminar un PACIENTE
--      (fk_inscripciones_paciente es ON DELETE CASCADE).
--
--  Nota: si la baja se produce al eliminar la CLASE
--  (fk_inscripciones_clase también es CASCADE), el UPDATE no encuentra
--  fila (la clase ya no existe) y no hace nada — comportamiento deseado.
--
--  El incremento usa LEAST(aforo_maximo, ...) para respetar siempre la
--  restricción chk_clases_cupos (cupos_disponibles <= aforo_maximo).
-- =====================================================================

DROP TRIGGER IF EXISTS trg_inscripcion_cupo_delete;

DELIMITER //

CREATE TRIGGER trg_inscripcion_cupo_delete
AFTER DELETE ON inscripciones_clases
FOR EACH ROW
BEGIN
    IF OLD.estado_inscripcion = 'ACTIVA' THEN
        UPDATE clases_grupales
           SET cupos_disponibles = LEAST(aforo_maximo, cupos_disponibles + 1)
         WHERE id_clase = OLD.id_clase;
    END IF;
END //

DELIMITER ;
