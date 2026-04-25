/**
 * Episode Service — The business logic layer for SRE agent episodes.
 * Abstracted from the transport layer (Socket/REST).
 */

const Episode = require('../models/Episode');
const pythonBridge = require('../services/pythonBridge');

/**
 * Runs a single episode via the AI service and persists results.
 */
async function runAndSaveEpisode({ incidentClass, agentType, maxSteps = 50 }) {
  console.log(`[EpisodeService] Running episode: class=${incidentClass}, agent=${agentType}`);
  
  const result = await pythonBridge.runEpisode({
    incidentClass,
    agentType,
    maxSteps,
  });

  // Business logic: transform/validate result if needed
  const episodeData = {
    incident_class: result.incident_class || 'unknown',
    agent_type: agentType,
    trajectory: result.trajectory,
    final_reward: result.final_reward,
    steps_taken: result.steps_taken,
    resolved: result.resolved,
    done_reason: result.done_reason,
    alert_title: result.incident_class,
  };

  const episode = await Episode.create(episodeData);
  return { ...result, _id: episode._id };
}

/**
 * Lists paginated episodes.
 */
async function listEpisodes({ page = 1, limit = 20, agentType } = {}) {
  const filter = {};
  if (agentType) filter.agent_type = agentType;

  const [episodes, total] = await Promise.all([
    Episode.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-trajectory'),
    Episode.countDocuments(filter)
  ]);

  return {
    episodes,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  };
}

/**
 * Gets global statistics for comparison.
 */
async function getComparisonStats() {
  const aggregateConfig = (type) => [
    { $match: { agent_type: type } },
    {
      $group: {
        _id: null,
        avgReward: { $avg: '$final_reward' },
        avgSteps: { $avg: '$steps_taken' },
        resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
        totalCount: { $sum: 1 },
      },
    }
  ];

  const [trainedStats, untrainedStats] = await Promise.all([
    Episode.aggregate(aggregateConfig('trained')),
    Episode.aggregate(aggregateConfig('untrained'))
  ]);

  return {
    trained: trainedStats[0] || { avgReward: 0, avgSteps: 0, resolvedCount: 0, totalCount: 0 },
    untrained: untrainedStats[0] || { avgReward: 0, avgSteps: 0, resolvedCount: 0, totalCount: 0 },
  };
}

module.exports = {
  runAndSaveEpisode,
  listEpisodes,
  getComparisonStats,
};
