const mongoose = require('mongoose');

const TransitionSchema = new mongoose.Schema({
  client: { type: String, required: true },
  fileUrl: { type: String }, // URL to uploaded doc
  description: { type: String },
  isLive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transition', TransitionSchema);
