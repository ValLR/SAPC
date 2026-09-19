# SAPC - Chawal App
Sistema de Agendamiento, Pagos y Contenido (S.A.P.C. Chawal)

---

## Guía de Inicio Rápido (Puesta en Marcha)

Para levantar la solución completa en tu máquina local, sigue este orden:

### 1. Base de Datos (MySQL 8.0)

**Requisitos**: MySQL 8.0 corriendo en `localhost:3306`.

```sql
-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS chawal_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Ejecutar los scripts SQL desde la raíz del repositorio:
```bash
mysql -u root -p chawal_db < backend/db/schema.sql
mysql -u root -p chawal_db < backend/db/seed.sql
```
*(También puedes abrirlos e ingresarlos desde MySQL Workbench u otra GUI).*

#### Credenciales Oficiales de Prueba (Seed Data)
La contraseña de **TODOS** los usuarios del seed es **`Password2026!`**:

| Correo | Rol | Descripción |
|---|---|---|
| `admin@chawal.cl` | `ADMINISTRADOR` | Administrador general (Acceso Portal Web & API) |
| `camila.rojas@chawal.cl` | `TERAPEUTA` | Kinesióloga |
| `matias.fuentes@chawal.cl` | `TERAPEUTA` | Fonoaudiólogo |
| `valentina.soto@chawal.cl` | `TERAPEUTA` | Psicóloga |
| `pedro.gonzalez@mail.cl` | `PACIENTE` | Paciente usuario final |

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
| **Backend** | `node test-terapeutas.js` | Ejecuta las 21 pruebas del CRUD de Terapeutas (US-13). |
| **Web** | `cd web && npm test` | Ejecuta 11 pruebas unitarias con Vitest (servicios, AuthContext, ProtectedRoute). |
| **Mobile** | `cd mobile && npm test` | Ejecuta 11 pruebas unitarias con Jest (storageService, authService, AuthContext). |
