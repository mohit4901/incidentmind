const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./src/app');
const { setupAgentStream } = require('./src/socket/agentStream');

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
  .then(() => console.log('[DB] MongoDB connected'))
  .catch((err) => {
    console.warn(`[DB] MongoDB connection failed: ${err.message}`);
    console.warn('[DB] Running without persistence — episodes will not be saved');
  });

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB error:', err.message);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  IncidentMind Backend`);
  console.log(`  API:       http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Python AI: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}`);
  console.log(`${'='.repeat(50)}\n`);
});
