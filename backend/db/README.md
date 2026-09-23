# Base de Datos — S.A.P.C. Chawal

Esquema relacional **MySQL 8.0** (InnoDB, `utf8mb4_unicode_ci`) para la plataforma Chawal.

---

## 🚀 Setup rápido (recomendado)

```bash
cd backend
npm run db:setup
```

Ese comando levanta **todo** en el orden correcto:

| # | Archivo | Contenido |
|---|---|---|
| 1 | `schema.sql` | 17 tablas, índices, CHECKs, FKs y la vista `v_usuarios_roles` |
| 2 | `stored_procedures/*.sql` | `sp_agendar_cita` |
| 3 | `triggers/*.sql` | Validaciones de citas + control de aforo |
| 4 | `seed.sql` | Datos maestros y de prueba |

Al terminar verifica que existan los 6 triggers y el stored procedure, y
falla con código de salida `1` si falta alguno.

> ⚠️ `npm run db:setup` **borra y recrea** las tablas. No usar en producción.

---

## 📂 Estructura

```
db/
├── schema.sql                DDL: tablas, índices, constraints, vista
│                             + DROP de SP/triggers (limpieza idempotente)
├── seed.sql                  DML: datos maestros y de prueba
├── setup.js                  Runner que ejecuta todo en orden
├── README.md                 Este archivo
├── stored_procedures/
│   └── sp_agendar_cita.sql
└── triggers/
    ├── trg_citas_bi_validacion.sql        BEFORE INSERT en citas
    ├── trg_citas_bu_validacion.sql        BEFORE UPDATE en citas
    ├── trg_citas_ai_auditoria.sql         AFTER INSERT en citas
    ├── trg_control_aforo_clases.sql       BEFORE INSERT en reservas_clases
    ├── trg_reserva_cupo_update.sql        BEFORE UPDATE en reservas_clases  [US-09]
    └── trg_reserva_cupo_delete.sql        AFTER DELETE en reservas_clases  [US-09]
```

---

## 🧩 Control de aforo (ciclo completo)

Los talleres grupales tienen `aforo_maximo` y `cupos_disponibles`. Los cupos se
mantienen **siempre** mediante triggers, nunca desde la aplicación:

| Operación sobre `reservas_clases` | Trigger | Efecto en `cupos_disponibles` |
|---|---|---|
| `INSERT` | `trg_control_aforo_clases` | **−1** (aborta si ya es 0) |
| `UPDATE` ACTIVA → CANCELADA | `trg_reserva_cupo_update` | **+1** |
| `UPDATE` CANCELADA → ACTIVA | `trg_reserva_cupo_update` | **−1** (aborta si no hay cupo) |
| `UPDATE` cambio de `id_clase` | `trg_reserva_cupo_update` | **+1** en origen, **−1** en destino |
| `DELETE` de reserva ACTIVA | `trg_reserva_cupo_delete` | **+1** |

El incremento usa `LEAST(aforo_maximo, cupos_disponibles + 1)` para respetar la
restricción `chk_clases_cupos` (`cupos_disponibles <= aforo_maximo`).

**Caso de uso resuelto (US-09):** antes, cancelar una reserva no devolvía el
cupo, por lo que un paciente que cancelaba quedaba bloqueado por el índice
único `uq_paciente_clase` y el taller perdía ese cupo permanentemente.

---

## ⚙️ Notas técnicas

### `DELIMITER` no es un comando del servidor

`DELIMITER` lo interpreta el **cliente** `mysql` (y MySQL Workbench) para no
partir el cuerpo de los procedimientos/triggers en cada `;`. El driver
`mysql2` **no lo entiende**, así que `setup.js` elimina esas líneas antes de
enviar cada archivo y usa `multipleStatements: true`; el parser del servidor
sí comprende los bloques `BEGIN ... END`.

Por eso **no se debe ejecutar `setup.js` con archivos que requieran `DELIMITER`
sin ese filtrado**.

### Ejecución manual (Workbench)

`npm run db:setup` necesita Node. Si se prefiere Workbench, ejecutar en orden:

1. `schema.sql`
2. `stored_procedures/sp_agendar_cita.sql`
3. `triggers/*.sql` (cualquier orden — son independientes entre sí)
4. `seed.sql`

> ⚠️ Ejecutar **solo** `schema.sql` + `seed.sql` deja la BD sin triggers.
> `seed.sql` fallará con *Duplicate entry* en las citas grupales, porque
> `es_grupal` no se deriva sin `trg_citas_bi_validacion`.

### Verificación rápida

```sql
SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
 WHERE TRIGGER_SCHEMA = 'chawal_db';

SELECT ROUTINE_NAME FROM information_schema.ROUTINES
 WHERE ROUTINE_SCHEMA = 'chawal_db' AND ROUTINE_TYPE = 'PROCEDURE';
```

---

## 🔑 Usuarios de prueba

Contraseña para **todos**: `Password2026!`
(hash bcrypt real, cost 10, definido en `seed.sql` como `@PWD_HASH`)

| Email | Rol |
|---|---|
| `admin@chawal.cl` | ADMINISTRADOR |
| `camila.rojas@chawal.cl` | TERAPEUTA |
| `matias.fuentes@chawal.cl` | TERAPEUTA |
| `valentina.soto@chawal.cl` | TERAPEUTA |
| `pedro.gonzalez@mail.cl` | PACIENTE |
| `ana.munoz@mail.cl` | PACIENTE |
| `luis.perez@mail.cl` | PACIENTE |

> ⚠️ Credenciales **solo para desarrollo local**. `seed.sql` no se ejecuta en
> producción.

---

## 📐 Convenciones de trazabilidad

`schema.sql` documenta cada decisión de diseño con etiquetas `[R1]`–`[R20]`,
vinculadas a los hallazgos de la rectificación del modelo:

| Rango | Tema |
|---|---|
| `[R1]`–`[R9]` | Integridad referencial, cardinalidades, ENUMs, CHECKs |
| `[R10]`–`[R11]` | Stored procedure y triggers |
| `[R12]`–`[R18]` | Refinamientos (aforo, solapamiento, XOR de pagos, etc.) |
| `[R19]` | US-13 — `titulo_profesional` y `estado_disponibilidad` |
| `[R20]` | US-11 — columna `sala` en `clases_grupales` |
