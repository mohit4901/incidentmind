const express = require('express');
const cors = require('cors');
const episodeRoutes = require('./routes/episodes');
const trainingRoutes = require('./routes/training');
const resultsRoutes = require('./routes/results');
const pythonBridge = require('./services/pythonBridge');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  let pythonOk = false;
  try {
    await pythonBridge.healthCheck();
    pythonOk = true;
  } catch (_) {}

  res.json({
    status: 'ok',
    service: 'incidentmind-backend',
    python_service: pythonOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/episodes', episodeRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/results', resultsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
