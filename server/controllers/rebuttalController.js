const Rebuttal = require('../models/Rebuttal');

exports.getAll = async (req, res) => {
  const rebuttals = await Rebuttal.find();
  res.json(rebuttals);
};

exports.create = async (req, res) => {
  const rebuttal = new Rebuttal(req.body);
  await rebuttal.save();
  res.status(201).json(rebuttal);
};

exports.update = async (req, res) => {
  const rebuttal = await Rebuttal.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(rebuttal);
};

exports.delete = async (req, res) => {
  await Rebuttal.findByIdAndDelete(req.params.id);
  res.status(204).end();
};

exports.pushLive = async (req, res) => {
  const rebuttal = await Rebuttal.findByIdAndUpdate(req.params.id, { isLive: true }, { new: true });
  res.json(rebuttal);
};
