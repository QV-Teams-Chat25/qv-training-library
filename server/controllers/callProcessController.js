const CallProcess = require('../models/CallProcess');

exports.getAll = async (req, res) => {
  const callProcesses = await CallProcess.find();
  res.json(callProcesses);
};

exports.create = async (req, res) => {
  const callProcess = new CallProcess(req.body);
  await callProcess.save();
  res.status(201).json(callProcess);
};

exports.update = async (req, res) => {
  const callProcess = await CallProcess.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(callProcess);
};

exports.delete = async (req, res) => {
  await CallProcess.findByIdAndDelete(req.params.id);
  res.status(204).end();
};

exports.pushLive = async (req, res) => {
  const callProcess = await CallProcess.findByIdAndUpdate(req.params.id, { isLive: true }, { new: true });
  res.json(callProcess);
};
