/**
 * Python Bridge Service — calls the FastAPI AI microservice.
 * Handles retries, timeouts, and error propagation.
 */

const axios = require('axios');

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT_MS = 120000; // 2 min — episodes can be long with LLM calls

const client = axios.create({
  baseURL: PYTHON_SERVICE,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

async function healthCheck() {
  const res = await client.get('/health');
  return res.data;
}

async function runEpisode({ incidentClass = 'random', maxSteps = 50, agentType = 'trained' } = {}) {
  const res = await client.post('/run-episode', {
    incident_class: incidentClass,
    max_steps: maxSteps,
    agent_type: agentType,
  });
  return res.data;
}

async function startTraining({ numEpochs = 50 } = {}) {
  const res = await client.post('/start-training', {
    num_epochs: numEpochs,
  });
  return res.data;
}

async function getTrainingStatus() {
  const res = await client.get('/training-status');
  return res.data;
}

async function getResults() {
  const res = await client.get('/results');
  return res.data;
}

module.exports = {
  healthCheck,
  runEpisode,
  startTraining,
  getTrainingStatus,
  getResults,
};
