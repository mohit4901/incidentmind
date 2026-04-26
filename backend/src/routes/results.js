const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pythonBridge = require('../services/pythonBridge');
const TrainingRun = require('../models/TrainingRun');
const Episode = require('../models/Episode');

// GET /api/results — training results with before/after comparison
router.get('/', async (req, res) => {
  try {
    // Try live from Python service first
    let pyResults = null;
    try {
      pyResults = await pythonBridge.getResults();
    } catch (_) {}

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        training: pyResults || null,
        comparison: { trained: null, untrained: null },
      });
    }

    // Aggregate from MongoDB as ground truth
    const [trainedAgg, untrainedAgg] = await Promise.all([
      Episode.aggregate([
        { $match: { agent_type: 'trained' } },
        {
          $group: {
            _id: null,
            avgReward: { $avg: '$final_reward' },
            avgSteps: { $avg: '$steps_taken' },
            resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]),
      Episode.aggregate([
        { $match: { agent_type: 'untrained' } },
        {
          $group: {
            _id: null,
            avgReward: { $avg: '$final_reward' },
            avgSteps: { $avg: '$steps_taken' },
            resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const lastTraining = await TrainingRun.findOne({ status: 'complete' })
      .sort({ completed_at: -1 });

    res.json({
      training: pyResults || (lastTraining ? {
        total_epochs: lastTraining.total_epochs,
        initial_avg_reward: lastTraining.initial_avg_reward,
        final_avg_reward: lastTraining.final_avg_reward,
        improvement: lastTraining.improvement,
        reward_curve: lastTraining.reward_history,
        best_reward: lastTraining.best_reward,
        worst_reward: lastTraining.worst_reward,
      } : null),
      comparison: {
        trained: trainedAgg[0] || null,
        untrained: untrainedAgg[0] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/results/reward-curve-image — serve the saved plot PNG
router.get('/reward-curve-image', (req, res) => {
  const imgPath = path.resolve(__dirname, '../../../ai/outputs/reward_curves/latest.png');
  if (fs.existsSync(imgPath)) {
    res.sendFile(imgPath);
  } else {
    res.status(404).json({ error: 'No reward curve image generated yet. Run training first.' });
  }
});

// GET /api/results/recent-episodes — last N episodes for display
router.get('/recent-episodes', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const episodes = await Episode.find()
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .select('agent_type final_reward steps_taken resolved done_reason created_at alert_title');
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
