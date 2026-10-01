# SAPC - Chawal App
Sistema de Agendamiento, Pagos y Contenido (S.A.P.C. Chawal)

---

## Guía de Inicio Rápido (Puesta en Marcha)

Para levantar la solución completa en tu máquina local, sigue este orden:

### 1. Base de Datos (MySQL 8.0)

**Requisitos**: MySQL 8.0 corriendo en `localhost:3306` y las credenciales
definidas en `backend/.env` (`DB_USER`, `DB_PASS`, `DB_NAME`).

```bash
cd backend
npm run db:setup
```

Ese comando crea la base de datos si no existe y aplica, **en orden**:

| # | Archivo | Contenido |
|---|---|---|
| 1 | `db/schema.sql` | 17 tablas, índices, CHECKs, FKs y la vista `v_usuarios_roles` |
| 2 | `db/stored_procedures/*.sql` | `sp_agendar_cita` |
| 3 | `db/triggers/*.sql` | Validaciones de citas + control de aforo |
| 4 | `db/seed.sql` | Datos maestros y de prueba |

Al finalizar verifica que existan los 6 triggers y el stored procedure.

> ⚠️ **El orden importa.** `seed.sql` inserta citas grupales que dependen de
> `trg_citas_bi_validacion` (que deriva `es_grupal`). Ejecutar solo
> `schema.sql` + `seed.sql` deja la BD sin triggers y el seed falla.
>
> ⚠️ `db:setup` **borra y recrea** las tablas. No usar en producción.

<details>
<summary>Ejecución manual (MySQL Workbench)</summary>

1. `backend/db/schema.sql`
2. `backend/db/stored_procedures/sp_agendar_cita.sql`
3. `backend/db/triggers/*.sql` (cualquier orden)
4. `backend/db/seed.sql`

Ver `backend/db/README.md` para más detalle.
</details>

#### Credenciales Oficiales de Prueba (Seed Data)
La contraseña de **TODOS** los usuarios del seed es **`Password2026!`**:

| Correo | Rol | Descripción |
|---|---|---|
| `admin@chawal.cl` | `ADMINISTRADOR` | Administrador general (Acceso Portal Web & API) |
| `camila.rojas@chawal.cl` | `TERAPEUTA` | Kinesióloga |
| `matias.fuentes@chawal.cl` | `TERAPEUTA` | Fonoaudiólogo |
| `valentina.soto@chawal.cl` | `TERAPEUTA` | Psicóloga |
| `pedro.gonzalez@mail.cl` | `PACIENTE` | Paciente usuario final |

> ⚠️ Credenciales **solo para desarrollo local**; `seed.sql` no se ejecuta en producción.

---

### 2. Backend — API REST (Express)

1. Ingresar a la carpeta backend:
   ```bash
   cd backend
   ```
2. Crear archivo `.env` a partir de `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *Asegúrate de ajustar `DB_PASS` en `.env` con la contraseña real de tu usuario MySQL `root`.*
3. Instalar dependencias e iniciar el servidor en modo desarrollo:
   ```bash
   npm install
   npm run dev
   ```
   > El servidor estará corriendo en: `http://localhost:3000` (Healthcheck: `http://localhost:3000/api/health`).

---

### 3. Web — Portal Web Administrativo (React + Vite)

1. Abrir una nueva terminal e ingresar a la carpeta `web/`:
   ```bash
   cd web
   npm install
   ```
2. Iniciar el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```
   > El portal web estará corriendo en: `http://localhost:5173/`

3. **Ejecutar Pruebas Unitarias Web**:
   ```bash
   npm test
   ```

---

### 4. Mobile — Aplicación Móvil (React Native + Expo)

1. Abrir una nueva terminal e ingresar a la carpeta `mobile/`:
   ```bash
   cd mobile
   npm install
   ```
2. Iniciar la aplicación en Expo:
   ```bash
   npm start
   ```
3. **Probar en dispositivo o emulador**:
   - **Dispositivo Físico**: Escanea el código QR con la app **Expo Go** (detectará automáticamente la IP local de tu computador para conectarse al backend).
   - **Web Browser**: Presiona la tecla `w` en la terminal o ejecuta `npm run web`.
   - **Emulador Android / iOS**: Presiona `a` para Android o `i` para iOS.

4. **Ejecutar Pruebas Unitarias Mobile**:
   ```bash
   npm test
   ```

---

## Resumen de Comandos de Prueba

| Módulo | Comando de Ejecución | Descripción |
|---|---|---|
| **Backend** | `node test-login.js` | Ejecuta las 6 pruebas de integración del endpoint de login. |
| **Backend** | `node test-us03.js` | Ejecuta las 36 verificaciones de autorización por roles/RBAC (US-03). |
| **Backend** | `node test-us05.js` | Ejecuta las 52 verificaciones del agendamiento transaccional y la cancelación de citas (US-05). Requiere seed limpio. |
| **Backend** | `npm test` | Ejecuta las 78 pruebas de `backend/__tests__/` con `node:test` (en secuencia): métricas de demanda (US-15), simulación de pago (FIX-02), RBAC de la reserva de clases (FIX-03) y bloque correctivo. Requiere la API arriba; no requiere seed limpio. |
| **Backend** | `node test-concurrencia-us05.js` | Ejecuta las 13 verificaciones de concurrencia del agendamiento (US-05). Requiere el servidor arriba. |
| **Backend** | `node test-terapeutas.js` | Ejecuta las 21 pruebas del CRUD de Terapeutas (US-13). |
| **Backend** | `node test-agendas.js` | Ejecuta las 36 pruebas de agendas/bloques horarios (US-07). |
| **Backend** | `node test-clases.js` | Ejecuta las 49 pruebas del CRUD de talleres grupales (US-11). |
| **Backend** | `node test-us09.js` | Ejecuta las 13 pruebas del ciclo de aforo a nivel BD (US-09). |
| **Backend** | `node test-concurrencia-us09.js` | Ejecuta las 14 pruebas de concurrencia del aforo (US-09). Requiere el servidor arriba. |
| **Web** | `cd web && npm test` | Ejecuta 11 pruebas unitarias con Vitest (servicios, AuthContext, ProtectedRoute). |
| **Mobile** | `cd mobile && npm test` | Ejecuta 11 pruebas unitarias con Jest (storageService, authService, AuthContext). |

> Los tests de backend con `(US-xx)` requieren el servidor levantado
> (`npm run dev`) **y** la base de datos inicializada (`npm run db:setup`).
> Varios crean datos de prueba: re-ejecuta `npm run db:setup` para limpiar.
