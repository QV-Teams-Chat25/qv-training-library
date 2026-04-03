const Transition = require('../models/Transition');

exports.getAll = async (req, res) => {
  const transitions = await Transition.find();
  res.json(transitions);
};

exports.create = async (req, res) => {
  const transition = new Transition(req.body);
  await transition.save();
  res.status(201).json(transition);
};

exports.update = async (req, res) => {
  const transition = await Transition.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(transition);
};

exports.delete = async (req, res) => {
  await Transition.findByIdAndDelete(req.params.id);
  res.status(204).end();
};

exports.pushLive = async (req, res) => {
  const transition = await Transition.findByIdAndUpdate(req.params.id, { isLive: true }, { new: true });
  res.json(transition);
};
