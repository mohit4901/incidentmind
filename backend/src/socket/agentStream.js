/**
 * Socket.io agent streaming — real-time episode step broadcast.
 */

const pythonBridge = require('../services/pythonBridge');
const Episode = require('../models/Episode');

function setupAgentStream(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('start-episode', async (data) => {
      const { incidentClass, agentType } = data || {};
      console.log(`[Socket] Episode requested: class=${incidentClass || 'random'}, agent=${agentType || 'trained'}`);

      try {
        const result = await pythonBridge.runEpisode({
          incidentClass: incidentClass || 'random',
          agentType: agentType || 'trained',
          maxSteps: 50,
        });

        const { trajectory } = result;

        // Stream each step with realistic delay
        for (let i = 0; i < trajectory.length; i++) {
          const step = trajectory[i];
          await sleep(800);
          socket.emit('agent-step', step);
        }

        // Persist episode to MongoDB
        try {
          await Episode.create({
            incident_class: result.incident_class || 'unknown',
            agent_type: agentType || 'trained',
            trajectory: result.trajectory,
            final_reward: result.final_reward,
            steps_taken: result.steps_taken,
            resolved: result.resolved,
            done_reason: result.done_reason,
            alert_title: result.incident_class,
          });
        } catch (dbErr) {
          console.warn('[Socket] Failed to persist episode:', dbErr.message);
        }

        socket.emit('episode-complete', {
          finalReward: result.final_reward,
          stepsTaken: result.steps_taken,
          resolved: result.resolved,
          doneReason: result.done_reason,
          incidentClass: result.incident_class,
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
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { setupAgentStream };
