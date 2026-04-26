const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // Fallback to local if present

const app = require('./src/app');
const { setupAgentStream } = require('./src/socket/agentStream');
const logger = require('./src/services/logger');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 120000,
  pingInterval: 25000,
});

// Socket.io real-time streaming
setupAgentStream(io);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/incidentmind';

mongoose.connect(MONGODB_URI)
  .then(() => logger.db('MongoDB connected successfully'))
  .catch((err) => {
    logger.warn(`MongoDB connection failed: ${err.message}`);
    logger.warn('Running without persistence — episodes will not be saved');
  });

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB error:', err.message);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.success(`IncidentMind Backend initialized`);
  logger.info(`REST API:  http://localhost:${PORT}`);
  logger.info(`WebSocket: ws://localhost:${PORT}`);
  logger.info(`AI Bridge: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}`);
});
