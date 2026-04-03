const mongoose = require('mongoose');

const CallProcessSchema = new mongoose.Schema({
  client: { type: String, required: true },
  processType: { type: String, enum: ['Call Process', 'Verification'], required: true },
  content: { type: String, required: true },
  isLive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CallProcess', CallProcessSchema);
