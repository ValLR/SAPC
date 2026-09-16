// Punto de entrada de la API REST (Node.js + Express)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth.routes');

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

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'SAPC Chawal API REST Running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor SAPC iniciado en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Auth endpoint: http://localhost:${PORT}/api/auth/login`);
});
