require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BT4500 API',
    version: '1.0.0',
    description: 'Backend API for Beach Tennis Tournament System',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      players: '/api/players',
      tournaments: '/api/tournaments',
      matches: '/api/matches',
      points: '/api/points'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
async function start() {
  // Test database connection
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('Failed to connect to database. Please check your configuration.');
    console.log('Make sure MySQL is running and the .env file is configured correctly.');
    console.log('Run "npm run db:migrate" to create the database and tables.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🎾 BT4500 API Server running on http://localhost:${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/`);
    console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
