/**
 * Logger Utility — Professional structured logging for IncidentMind.
 */

const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m",    // Cyan
  success: "\x1b[32m", // Green
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  dim: "\x1b[2m",      // Dim
};

const logger = {
  info: (msg, ...args) => {
    console.log(`${colors.info}[INFO]${colors.reset} ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`${colors.success}[SUCCESS]${colors.reset} ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.log(`${colors.warn}[WARN]${colors.reset} ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`${colors.error}[ERROR]${colors.reset} ${msg}`, ...args);
  },
  socket: (socketId, msg) => {
    console.log(`${colors.dim}[SOCKET ${socketId}]${colors.reset} ${msg}`);
  },
  db: (msg) => {
    console.log(`${colors.dim}[DB]${colors.reset} ${msg}`);
  }
};

module.exports = logger;
