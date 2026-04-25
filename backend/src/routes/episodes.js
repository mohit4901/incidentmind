const express = require('express');
const router = express.Router();
const Episode = require('../models/Episode');
const pythonBridge = require('../services/pythonBridge');

// GET /api/episodes — list all episodes with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, agent_type } = req.query;
    const filter = {};
    if (agent_type) filter.agent_type = agent_type;

    const episodes = await Episode.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-trajectory'); // Don't send full trajectory in list

    const total = await Episode.countDocuments(filter);

    res.json({
      episodes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/episodes/:id — get full episode with trajectory
router.get('/:id', async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/episodes/run — run a new episode synchronously (REST alternative to socket)
router.post('/run', async (req, res) => {
  try {
    const { incidentClass = 'random', agentType = 'trained', maxSteps = 50 } = req.body;

    const result = await pythonBridge.runEpisode({
      incidentClass,
      agentType,
      maxSteps,
    });

    // Persist to MongoDB
    const episode = await Episode.create({
      incident_class: result.incident_class || 'unknown',
      agent_type: agentType,
      trajectory: result.trajectory,
      final_reward: result.final_reward,
      steps_taken: result.steps_taken,
      resolved: result.resolved,
      done_reason: result.done_reason,
      alert_title: result.incident_class,
    });

    res.json({ ...result, _id: episode._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/episodes/stats/summary — aggregate stats
router.get('/stats/summary', async (req, res) => {
  try {
    const [trainedStats, untrainedStats] = await Promise.all([
      Episode.aggregate([
        { $match: { agent_type: 'trained' } },
        {
          $group: {
            _id: null,
            avgReward: { $avg: '$final_reward' },
            avgSteps: { $avg: '$steps_taken' },
            resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
            totalCount: { $sum: 1 },
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
            totalCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      trained: trainedStats[0] || { avgReward: 0, avgSteps: 0, resolvedCount: 0, totalCount: 0 },
      untrained: untrainedStats[0] || { avgReward: 0, avgSteps: 0, resolvedCount: 0, totalCount: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
