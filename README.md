# SAPC - Chawal App
Sistema de Agendamiento, Pagos y Contenido (S.A.P.C. Chawal)

---

## 📂 Estructura del Repositorio (`SAPC-Chawal-App`)

```text
SAPC-Chawal-App/
├── .gitignore
├── .env.example
├── README.md
├── Documentation/            # Documentación general y contratos API
│
├── backend/                  # API REST (Node.js + Express)
│   ├── .env.example
│   ├── server.js             # Punto de entrada de la API
│   ├── test-login.js         # Pruebas automatizadas de autenticación
│   ├── test-terapeutas.js    # Pruebas automatizadas de CRUD terapeutas
│   ├── src/
│   │   ├── config/           # Conexión DB, variables JWT
│   │   ├── controllers/      # Lógica de endpoints (auth, terapeutas, especialidades)
│   │   ├── middlewares/      # verifyToken, requireRole (RBAC)
│   │   ├── routes/           # Enrutadores Express (/api/auth, /api/terapeutas, /api/especialidades)
│   │   └── utils/            # Helpers
│   └── db/                   # Scripts SQL del sistema
│       ├── schema.sql        # DDL: Definición de tablas en MySQL (17 tablas)
│       └── seed.sql          # DML: Datos iniciales de prueba
│
├── mobile/                   # App Móvil (React Native / Expo SDK 57)
│   ├── .env.example
│   ├── US-02-LOGIN-PLAN.md   # Especificación visual, estado de tareas y Plan de Pruebas QA
│   ├── App.js                # Enrutamiento condicional y AuthProvider
│   └── src/
│       ├── components/       # UI (CustomInput, CustomButton, AuthErrorModal, LogoChawal)
│       ├── context/          # AuthContext (Estado de sesión global y auto-login)
│       ├── screens/          # Pantallas (LoginScreen, HomeScreen)
│       ├── services/         # authService (HTTP client REST) y storageService (SecureStore JWT)
│       └── theme/            # Tokens de diseño Chawal (Colores Teal #1B7B75, Naranja #E08736, etc.)
│
└── web/                      # Portal Web Administrativo (React)
    ├── .env.example
    └── US-04-WEB-ROUTING-PLAN.md
```

---

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

> También se pueden ejecutar ambos scripts desde MySQL Workbench (`File → Open SQL Script`), seleccionando la BD `chawal_db`.

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

---

## 🚀 Backend — API REST

El backend proporciona endpoints de autenticación JWT y gestión de recursos.

### Configuración e inicio

1. Copiar `.env.example` a `.env` en la carpeta `backend/`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Instalar dependencias e iniciar servidor:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Endpoints principales
- `GET /api/health`: Health check del backend.
- `POST /api/auth/login`: Autenticación con credenciales y emisión de JWT (8h).
- `GET /api/terapeutas`, `POST /api/terapeutas`, `PUT /api/terapeutas/:id`: CRUD Terapeutas (US-13).
- `GET /api/especialidades`: Catálogo de especialidades clínicas.

### Pruebas backend
```bash
cd backend
node test-login.js       # Prueba los 6 escenarios del login
node test-terapeutas.js  # Prueba 21 verificaciones de la US-13
```

---

## 📱 Mobile — App Móvil (US-02)

Aplicación móvil desarrollada con **React Native + Expo SDK 57** aplicando el sistema de diseño Chawal (Verde Teal `#1B7B75`, Naranja acento `#E08736`, tipografía y bordes redondeados).

### Requisitos
- Node.js `20.19.4`
- Expo Go en dispositivo móvil o emulador (Android Studio / iOS Simulator / Web)

### Puesta en marcha

1. Ir al directorio móvil:
   ```bash
   cd mobile
   npm install
   ```
2. Iniciar el servidor de desarrollo Expo:
   ```bash
   npm start
   # O para plataformas específicas:
   npm run web
   npm run android
   npm run ios
   ```

### Variables de entorno (`mobile/.env`)
Opcionalmente, crea `mobile/.env` para sobrescribir la dirección del backend:
```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
# En emulador Android usar: http://10.0.2.2:3000/api
```

---

## 📄 Documentaciones Específicas
- **Mobile Login Plan & Plan QA**: [`mobile/US-02-LOGIN-PLAN.md`](mobile/US-02-LOGIN-PLAN.md)
- **Contrato Auth Login**: [`Documentation/contrato-auth-login.json`](Documentation/contrato-auth-login.json)
- **Contrato CRUD Terapeutas**: `backend/contrato-us13-terapeutas.md`
