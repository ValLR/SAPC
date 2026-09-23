// Punto de entrada de la API REST (Node.js + Express)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth.routes');
const terapeutasRoutes = require('./src/routes/terapeutas.routes');
const especialidadesRoutes = require('./src/routes/especialidades.routes');
const classesRoutes = require('./src/routes/classesRoutes');
const schedulesRoutes = require('./src/routes/schedulesRoutes');
const agendasRoutes = require('./src/routes/agendas.routes');
const clasesRoutes = require('./src/routes/clases.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API SAPC-Chawal activa',
    timestamp: new Date().toISOString()
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de gestión de terapeutas y especialidades (US-13)
app.use('/api/terapeutas', terapeutasRoutes);
app.use('/api/especialidades', especialidadesRoutes);

// Catálogo de talleres grupales para mobile (US-08 / FIX-01)
app.use('/api/classes', classesRoutes);

// Configuración de jornadas del panel web (US-08 / FIX-01)
app.use('/api/schedules', schedulesRoutes);

// API de dominio: agendas / bloques horarios (US-07)
app.use('/api/agendas', agendasRoutes);

// API de dominio: clases grupales / talleres (US-11)
app.use('/api/clases', clasesRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'SAPC Chawal API REST Running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      terapeutas: '/api/terapeutas',
      especialidades: '/api/especialidades',
      classes: '/api/classes',
      schedules: '/api/schedules',
      agendas: '/api/agendas',
      clases: '/api/clases'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor SAPC iniciado en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Auth endpoint: http://localhost:${PORT}/api/auth/login`);
});
