# SAPC - Chawal App
Sistema de Agendamiento, Pagos y Contenido

## 📂 Estructura del Repositorio (`SAPC-Chawal-App`)

```text
SAPC-Chawal-App/
├── .gitignore
├── .env.example
├── README.md
├── Documentation/            # Documentación general del proyecto
│
├── backend/                  # API REST (Node.js + Express)
│   ├── .env.example
│   ├── server.js             # Punto de entrada de la API
│   ├── src/
│   │   ├── config/           # Conexión DB, variables JWT
│   │   ├── controllers/      # Lógica de endpoints
│   │   ├── middlewares/      # verifyToken, checkRole (RBAC)
│   │   ├── routes/           # Enrutadores Express (/api/auth, /api/citas...)
│   │   └── utils/            # Funciones auxiliares / helpers
│   └── db/                   # Scripts SQL del sistema
│       ├── schema.sql        # DDL: Definición de tablas en MySQL
│       ├── seed.sql          # DML: Datos iniciales de prueba
│       ├── stored_procedures/# SPs (ej. SP_reservar_cita_sin_colision)
│       └── triggers/         # Triggers
│
├── mobile/                   # App Móvil Android (React Native / Expo)
│   ├── .env.example
│   └── src/
│       ├── components/       # Componentes reutilizables
│       ├── screens/          # Pantallas de la aplicación
│       ├── navigation/       # React Navigation
│       ├── services/         # Cliente API REST
│       └── context/          # Contexto de Autenticación
│
└── web/                      # Portal Web Administrativo (React)
    ├── .env.example
    └── src/
        ├── components/       # Componentes UI
        ├── pages/            # Páginas administrativas
        ├── routes/           # Rutas protegidas
        └── services/         # Cliente API REST
```

## 🗄️ Base de Datos (MySQL 8.0)

### Requisitos
- MySQL 8.0 (InnoDB, `utf8mb4_unicode_ci`)

### Puesta en marcha

```sql
-- 1. Crear la base de datos
CREATE DATABASE IF NOT EXISTS chawal_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
# 2. Cargar esquema y datos (desde la raíz del repo)
mysql -u root -p chawal_db < backend/db/schema.sql
mysql -u root -p chawal_db < backend/db/seed.sql
```

> También se pueden ejecutar ambos scripts desde MySQL Workbench
> (`File → Open SQL Script`), seleccionando la BD `chawal_db`.

### Contenido del esquema
- **17 tablas** (identidad, dominio, operación, finanzas y soporte)
- **4 triggers**: validación de citas (INSERT/UPDATE), auditoría y control de aforo de clases
- **1 stored procedure**: `sp_agendar_cita` (transaccional, con bloqueo pesimista)
- **1 vista**: `v_usuarios_roles` (usada por el login)

### Usuarios de prueba
Todos los usuarios del seed comparten la contraseña **`Password2026!`**.

| Email | Rol |
|---|---|
| `admin@chawal.cl` | ADMINISTRADOR |
| `camila.rojas@chawal.cl` | TERAPEUTA |
| `matias.fuentes@chawal.cl` | TERAPEUTA |
| `valentina.soto@chawal.cl` | TERAPEUTA |
| `pedro.gonzalez@mail.cl` | PACIENTE |
| `ana.munoz@mail.cl` | PACIENTE |
| `luis.perez@mail.cl` | PACIENTE |

## 🔐 Autenticación (US-01 / SCRUM-9)

El endpoint `POST /api/auth/login` valida credenciales contra MySQL
(`bcrypt.compare`) y devuelve un JWT.

- **Contrato OpenAPI:** [`Documentation/contrato-auth-login.json`](Documentation/contrato-auth-login.json)
- **Códigos de respuesta:** `200`, `400` (`MISSING_CREDENTIALS`),
  `401` (`INVALID_CREDENTIALS`), `403` (`ACCOUNT_NOT_ACTIVE`), `500`

### Configuración
Copiar `backend/.env.example` a `backend/.env` y completar `DB_PASS`:

```bash
cp backend/.env.example backend/.env
```

```bash
# Arrancar la API
cd backend
npm install
npm run dev
```

### Prueba rápida
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chawal.cl","password":"Password2026!"}'
```
