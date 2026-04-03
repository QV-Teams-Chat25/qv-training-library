const mongoose = require('mongoose');

const RebuttalSchema = new mongoose.Schema({
  client: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  deliveryTip: { type: String, default: '' },
  thirdPresentation: { type: String },
  isLive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rebuttal', RebuttalSchema);
