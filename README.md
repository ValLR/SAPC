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
