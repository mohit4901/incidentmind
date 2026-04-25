const mongoose = require('mongoose');

const trainingRunSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'running', 'complete', 'error'],
    default: 'pending',
  },
  total_epochs: { type: Number, required: true },
  current_epoch: { type: Number, default: 0 },
  reward_history: [Number],
  logs: [String],
  initial_avg_reward: Number,
  final_avg_reward: Number,
  improvement: Number,
  best_reward: Number,
  worst_reward: Number,
  started_at: { type: Date, default: Date.now },
  completed_at: Date,
  error_message: String,
});

trainingRunSchema.index({ started_at: -1 });

module.exports = mongoose.model('TrainingRun', trainingRunSchema);
