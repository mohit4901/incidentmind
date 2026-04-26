const express = require('express');
const router = express.Router();
const pythonBridge = require('../services/pythonBridge');
const TrainingRun = require('../models/TrainingRun');

// POST /api/training/start — kick off training run
router.post('/start', async (req, res) => {
  try {
    const { numEpochs = 50 } = req.body;

    // Check if already running
    const running = await TrainingRun.findOne({ status: 'running' });
    if (running) {
      return res.status(409).json({ error: 'Training already in progress', runId: running._id });
    }

    const result = await pythonBridge.startTraining({ numEpochs });

    // Persist training run record
    const run = await TrainingRun.create({
      status: 'running',
      total_epochs: numEpochs,
      current_epoch: 0,
      reward_history: [],
      logs: [],
    });

    res.json({ ...result, runId: run._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/training/status — poll current training status
router.get('/status', async (req, res) => {
  try {
    const pyStatus = await pythonBridge.getTrainingStatus();

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      // Sync to MongoDB if there's an active run
      const activeRun = await TrainingRun.findOne({ status: 'running' }).sort({ started_at: -1 });
      if (activeRun) {
        activeRun.current_epoch = pyStatus.current_epoch;
        activeRun.reward_history = pyStatus.reward_history || [];
        activeRun.logs = pyStatus.latest_logs || [];

        if (pyStatus.status === 'complete') {
          activeRun.status = 'complete';
          activeRun.completed_at = new Date();
          const rewards = activeRun.reward_history;
          if (rewards.length >= 5) {
            const early = rewards.slice(0, 5);
            const late = rewards.slice(-5);
            activeRun.initial_avg_reward = early.reduce((a, b) => a + b, 0) / early.length;
            activeRun.final_avg_reward = late.reduce((a, b) => a + b, 0) / late.length;
            activeRun.improvement = activeRun.final_avg_reward - activeRun.initial_avg_reward;
            activeRun.best_reward = Math.max(...rewards);
            activeRun.worst_reward = Math.min(...rewards);
          }
        } else if (pyStatus.status && pyStatus.status.startsWith('error')) {
          activeRun.status = 'error';
          activeRun.error_message = pyStatus.status;
        }

        await activeRun.save();
      }
    }

    res.json(pyStatus);
  } catch (err) {
    // If Python service is down, return last known state from DB
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const lastRun = await TrainingRun.findOne().sort({ started_at: -1 });
        if (lastRun) {
          return res.json({
            running: lastRun.status === 'running',
            current_epoch: lastRun.current_epoch,
            total_epochs: lastRun.total_epochs,
            progress_percent: Math.round((lastRun.current_epoch / Math.max(lastRun.total_epochs, 1)) * 100 * 10) / 10,
            reward_history: lastRun.reward_history,
            status: lastRun.status,
            latest_logs: lastRun.logs.slice(-20),
            source: 'database_fallback',
          });
        }
      }
    } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// GET /api/training/history — all past training runs
router.get('/history', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const runs = await TrainingRun.find()
      .sort({ started_at: -1 })
      .limit(20)
      .select('-logs -reward_history');
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
