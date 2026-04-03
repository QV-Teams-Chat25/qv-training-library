const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const rebuttalRoutes = require('./routes/rebuttalRoutes');
const transitionRoutes = require('./routes/transitionRoutes');
const callProcessRoutes = require('./routes/callProcessRoutes');

const app = express();
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qv_training';

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'qv-training-library-api' });
});

// API routes
app.use('/api/rebuttals', rebuttalRoutes);
app.use('/api/transitions', transitionRoutes);
app.use('/api/call-process', callProcessRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
