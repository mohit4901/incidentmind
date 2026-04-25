const express = require('express');
const router = express.Router();
const episodeService = require('../services/episodeService');
const Episode = require('../models/Episode');

// GET /api/episodes — list all episodes with pagination
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, agent_type } = req.query;
    const data = await episodeService.listEpisodes({ page, limit, agentType: agent_type });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/episodes/:id — get full episode with trajectory
router.get('/:id', async (req, res, next) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (err) {
    next(err);
  }
});

// POST /api/episodes/run — run a new episode synchronously
router.post('/run', async (req, res, next) => {
  try {
    const { incidentClass, agentType, maxSteps } = req.body;
    const result = await episodeService.runAndSaveEpisode({ incidentClass, agentType, maxSteps });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/episodes/stats/summary — aggregate stats
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await episodeService.getComparisonStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
