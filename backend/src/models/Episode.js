const mongoose = require('mongoose');

const episodeStepSchema = new mongoose.Schema({
  step: Number,
  action: String,
  kwargs: mongoose.Schema.Types.Mixed,
  reward: Number,
  cumulative_reward: Number,
  observation_summary: {
    time_elapsed: Number,
    action_history_len: Number,
    hypothesis_count: Number,
  }
}, { _id: false });

const episodeSchema = new mongoose.Schema({
  incident_class: { type: String, required: true },
  agent_type: { type: String, enum: ['trained', 'untrained'], required: true },
  trajectory: [episodeStepSchema],
  final_reward: { type: Number, required: true },
  steps_taken: { type: Number, required: true },
  resolved: { type: Boolean, default: false },
  done_reason: { type: String },
  alert_title: String,
  created_at: { type: Date, default: Date.now },
});

episodeSchema.index({ created_at: -1 });
episodeSchema.index({ agent_type: 1, created_at: -1 });

module.exports = mongoose.model('Episode', episodeSchema);
