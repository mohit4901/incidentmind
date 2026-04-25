/**
 * Socket.io agent streaming — real-time episode step broadcast.
 */

const Episode = require('../models/Episode');
const logger = require('../services/logger');
const WebSocket = require('ws');

const baseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/run-episode';

function setupAgentStream(io) {
  io.on('connection', (socket) => {
    logger.socket(socket.id, 'Client connected');
    let activeWs = null;

    socket.on('start-episode', async (data) => {
      const { incidentClass, agentType } = data || {};
      logger.socket(socket.id, `Episode requested: class=${incidentClass || 'random'}, agent=${agentType || 'trained'}`);

      try {
        if (activeWs) {
          activeWs.close();
        }

        activeWs = new WebSocket(wsUrl);

        activeWs.on('open', () => {
          activeWs.send(JSON.stringify({
            incident_class: incidentClass || 'random',
            agent_type: agentType || 'trained',
            max_steps: 50
          }));
        });

        activeWs.on('message', async (dataStr) => {
          const msg = JSON.parse(dataStr);
          await sleep(800); // Base streaming delay

          if (msg.type === 'step') {
            const step = msg.step;

            if (step.pending_approval) {
              logger.socket(socket.id, 'ACTION SUSPENDED: Awaiting operator approval for execute_fix');
              socket.emit('agent-step', step);
              socket.emit('action-approval-required', { tool: step.action, args: step.kwargs });

              const approvalPromise = new Promise((resolve) => {
                socket.once('action-approved', () => resolve('approved'));
                socket.once('action-denied', () => resolve('denied'));
              });

              const decision = await approvalPromise;
              socket.removeAllListeners('action-approved');
              socket.removeAllListeners('action-denied');

              if (decision === 'approved') {
                logger.socket(socket.id, 'Operator APPROVED action.');
                activeWs.send('approved');
              } else {
                logger.socket(socket.id, 'Operator DENIED action.');
                activeWs.send('denied');
              }
            } else {
              if (step.status === 'approved' || step.status === 'denied') {
                socket.emit('agent-step-update', { index: step.step - 1, ...step });
              } else {
                socket.emit('agent-step', step);
              }
            }
          } else if (msg.type === 'complete') {
            const res = msg.result;
            try {
              await Episode.create({
                incident_class: res.incident_class || 'unknown',
                agent_type: agentType || 'trained',
                trajectory: res.trajectory,
                final_reward: res.final_reward,
                steps_taken: res.steps_taken,
                resolved: res.resolved,
                done_reason: res.done_reason,
                alert_title: res.incident_class,
              });
            } catch (dbErr) {
              logger.error(`Failed to persist episode to DB: ${dbErr.message}`);
            }

            socket.emit('episode-complete', {
              finalReward: res.final_reward,
              stepsTaken: res.steps_taken,
              resolved: res.resolved,
              doneReason: res.done_reason,
              incidentClass: res.incident_class,
            });
            activeWs.close();
          }
        });

        activeWs.on('error', (error) => {
          console.error('[Socket] WebSocket error:', error.message);
          socket.emit('error', { message: `AI Service connection failed: ${error.message}` });
        });

      } catch (error) {
        console.error('[Socket] Episode error:', error.message);
        socket.emit('error', {
          message: `Episode failed: ${error.message}`,
          hint: 'Ensure the Python AI service is running on port 8000',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (activeWs) activeWs.close();
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { setupAgentStream };
