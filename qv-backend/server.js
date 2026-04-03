require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'production';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quality_voices';
const CLIENT_BUILD_PATH = path.join(__dirname, '..', 'client', 'build');
const CLIENT_INDEX_PATH = path.join(CLIENT_BUILD_PATH, 'index.html');
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
};
const MONGO_OPTIONS = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 100),
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });

  if (req.method === 'GET') {
    res.setHeader('Clear-Site-Data', '"cache", "storage"');
  }

  next();
});

const emptyProcess = {
  'Call Process': '',
  Verification: '',
};
const LIBRARY_TYPES = ['rebuttals', 'process', 'transitions'];

const libraryEntrySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: LIBRARY_TYPES, unique: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    versionStamp: { type: Number, default: () => Date.now(), index: true },
  },
  {
    timestamps: true,
  }
);

const legacyStateSchema = new mongoose.Schema(
  {
    singleton: { type: String, required: true, unique: true },
    rebuttals: {
      working: { type: mongoose.Schema.Types.Mixed, default: {} },
      live: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    process: {
      working: { type: mongoose.Schema.Types.Mixed, default: emptyProcess },
      live: { type: mongoose.Schema.Types.Mixed, default: emptyProcess },
    },
    transitions: {
      working: { type: mongoose.Schema.Types.Mixed, default: null },
      live: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
    collection: 'trainingdatas',
  }
);

const WorkingLibrary = mongoose.model('WorkingLibrary', libraryEntrySchema, 'working_library');
const LiveLibrary = mongoose.model('LiveLibrary', libraryEntrySchema, 'live_library');
const LegacyLibraryState = mongoose.model('LegacyLibraryState', legacyStateSchema);

const isObjectRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeByType = (type, value) => {
  if (type === 'rebuttals') {
    return isObjectRecord(value) ? { ...value } : {};
  }

  if (type === 'process') {
    return isObjectRecord(value) ? { ...emptyProcess, ...value } : { ...emptyProcess };
  }

  if (type === 'transitions') {
    if (!value || !isObjectRecord(value)) {
      return null;
    }

    const { fileName, mimeType, dataUrl } = value;
    if (typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof dataUrl !== 'string') {
      return null;
    }

    return { fileName, mimeType, dataUrl };
  }

  return value ?? null;
};

const buildEntryDoc = (type, data, versionStamp) => ({
  type,
  data: sanitizeByType(type, data),
  versionStamp,
});

const buildEntryDocs = (snapshot, versionStamp) => LIBRARY_TYPES.map((type) => buildEntryDoc(type, snapshot[type], versionStamp));

const buildSnapshotFromDocs = (docs) => {
  const snapshot = {
    rebuttals: {},
    process: { ...emptyProcess },
    transitions: null,
  };

  docs.forEach((doc) => {
    if (doc && LIBRARY_TYPES.includes(doc.type)) {
      snapshot[doc.type] = sanitizeByType(doc.type, doc.data);
    }
  });

  return snapshot;
};

const removeRebuttalCampaign = (bucket, campaign, title) => {
  const nextBucket = isObjectRecord(bucket) ? { ...bucket } : {};

  if (!title) {
    delete nextBucket[campaign];
    return nextBucket;
  }

  const campaignBucket = nextBucket[campaign];
  if (!campaignBucket) {
    return nextBucket;
  }

  if (typeof campaignBucket === 'string') {
    delete nextBucket[campaign];
    return nextBucket;
  }

  if (isObjectRecord(campaignBucket)) {
    const record = { ...campaignBucket };

    if ('title' in record || 'content' in record || 'deliveryTip' in record) {
      const recordTitle = typeof record.title === 'string' ? record.title : campaign;
      if (recordTitle === title) {
        delete nextBucket[campaign];
      }
      return nextBucket;
    }

    delete record[title];
    if (Object.keys(record).length === 0) {
      delete nextBucket[campaign];
    } else {
      nextBucket[campaign] = record;
    }
  }

  return nextBucket;
};

const removeProcessTitle = (bucket, category, title) => {
  const currentWorking = sanitizeByType('process', bucket);
  const currentBucket = currentWorking[category];

  let nextBucket = '';
  if (isObjectRecord(currentBucket)) {
    if ('title' in currentBucket || 'content' in currentBucket) {
      const recordTitle = typeof currentBucket.title === 'string' ? currentBucket.title : category;
      nextBucket = recordTitle === title ? '' : currentBucket;
    } else {
      const candidate = { ...currentBucket };
      delete candidate[title];
      nextBucket = Object.keys(candidate).length ? candidate : '';
    }
  } else if (typeof currentBucket === 'string') {
    nextBucket = title === category ? '' : currentBucket;
  }

  return {
    ...emptyProcess,
    ...currentWorking,
    [category]: nextBucket,
  };
};

const upsertBucket = async (Model, type, data) => {
  const sanitized = sanitizeByType(type, data);
  const versionStamp = Date.now();

  await Model.findOneAndUpdate(
    { type },
    {
      $set: {
        data: sanitized,
        versionStamp,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return sanitized;
};

const ensureLibrarySeeded = async () => {
  const [workingCount, liveCount] = await Promise.all([
    WorkingLibrary.countDocuments(),
    LiveLibrary.countDocuments(),
  ]);

  if (workingCount > 0 && liveCount > 0) {
    return;
  }

  const legacyState = await LegacyLibraryState.findOne({ singleton: 'default' }).lean();
  const workingSnapshot = {
    rebuttals: legacyState?.rebuttals?.working || {},
    process: legacyState?.process?.working || { ...emptyProcess },
    transitions: legacyState?.transitions?.working || null,
  };
  const liveSnapshot = {
    rebuttals: legacyState?.rebuttals?.live || {},
    process: legacyState?.process?.live || { ...emptyProcess },
    transitions: legacyState?.transitions?.live || null,
  };

  if (workingCount === 0) {
    await WorkingLibrary.deleteMany({});
    await WorkingLibrary.insertMany(buildEntryDocs(workingSnapshot, Date.now()));
  }

  if (liveCount === 0) {
    await LiveLibrary.deleteMany({});
    await LiveLibrary.insertMany(buildEntryDocs(liveSnapshot, Date.now()));
  }
};

const loadLibraryState = async () => {
  await ensureLibrarySeeded();

  const [workingDocs, liveDocs] = await Promise.all([
    WorkingLibrary.find({}).lean(),
    LiveLibrary.find({}).lean(),
  ]);

  return {
    working: buildSnapshotFromDocs(workingDocs),
    live: buildSnapshotFromDocs(liveDocs),
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/save/:type', async (req, res, next) => {
  try {
    const type = req.params.type;
    const target = req.body && req.body.target === 'live' ? 'live' : 'working';

    if (!LIBRARY_TYPES.includes(type)) {
      return res.status(404).json({ message: 'Unknown save type' });
    }

    const Model = target === 'live' ? LiveLibrary : WorkingLibrary;
    const saved = await upsertBucket(Model, type, req.body ? req.body.value : null);
    return res.json({ ok: true, bucket: target, type, data: saved });
  } catch (error) {
    next(error);
  }
});

app.get('/api/rebuttals', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    res.json({
      working: state.working.rebuttals,
      live: state.live.rebuttals,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/rebuttals/live', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    res.json({
      live: state.live.rebuttals,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/rebuttals/save', async (req, res, next) => {
  try {
    const incomingWorking = req.body && req.body.working ? req.body.working : {};
    const updatedWorking = await upsertBucket(WorkingLibrary, 'rebuttals', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

const handleDeleteRebuttal = async (req, res, next) => {
  try {
    await ensureLibrarySeeded();
    const campaign = req.params.campaign;
    const title = req.params.title;
    const [workingDoc, liveDoc] = await Promise.all([
      WorkingLibrary.findOne({ type: 'rebuttals' }).lean(),
      LiveLibrary.findOne({ type: 'rebuttals' }).lean(),
    ]);

    const nextWorking = removeRebuttalCampaign(workingDoc && workingDoc.data, campaign, title);
    const nextLive = removeRebuttalCampaign(liveDoc && liveDoc.data, campaign, title);

    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'rebuttals', nextWorking),
      upsertBucket(LiveLibrary, 'rebuttals', nextLive),
    ]);

    res.json({ working: savedWorking, live: savedLive, deleted: title ? { campaign, title } : campaign });
  } catch (error) {
    next(error);
  }
};

app.delete('/api/rebuttals/working/:campaign', handleDeleteRebuttal);
app.delete('/api/rebuttals/working/:campaign/:title', handleDeleteRebuttal);

app.post('/api/rebuttals/publish', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const versionStamp = Date.now();

    await LiveLibrary.deleteMany({ type: 'rebuttals' });
    await LiveLibrary.insertMany([buildEntryDoc('rebuttals', state.working.rebuttals, versionStamp)]);

    res.json({ live: state.working.rebuttals, versionStamp });
  } catch (error) {
    next(error);
  }
});

app.post('/api/live/sync', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const syncVersion = Date.now();
    const nextLiveDocs = buildEntryDocs(state.working, syncVersion);

    // Explicitly remove any legacy Verification live records before the full atomic refresh.
    await LiveLibrary.collection.deleteMany({ category: 'Verification' });
    await LiveLibrary.deleteMany({ type: 'process' });
    await LiveLibrary.deleteMany({});
    await LiveLibrary.insertMany(nextLiveDocs);

    console.log(`ATOMIC LIVE SYNC COMPLETE @ ${syncVersion}`);

    res.json({
      rebuttalsLive: state.working.rebuttals,
      processLive: state.working.process,
      transitionsLive: state.working.transitions,
      versionStamp: syncVersion,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/process', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    res.json({
      working: state.working.process,
      live: state.live.process,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/process/save', async (req, res, next) => {
  try {
    const incomingWorking = req.body && req.body.working ? req.body.working : { ...emptyProcess };
    const updatedWorking = await upsertBucket(WorkingLibrary, 'process', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/process/working/:category/:title', async (req, res, next) => {
  try {
    await ensureLibrarySeeded();
    const category = req.params.category;
    const title = req.params.title;

    if (category !== 'Call Process' && category !== 'Verification') {
      return res.status(400).json({ message: 'Invalid process category' });
    }

    const [workingDoc, liveDoc] = await Promise.all([
      WorkingLibrary.findOne({ type: 'process' }).lean(),
      LiveLibrary.findOne({ type: 'process' }).lean(),
    ]);

    const nextWorking = removeProcessTitle(workingDoc && workingDoc.data, category, title);
    const nextLive = removeProcessTitle(liveDoc && liveDoc.data, category, title);

    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'process', nextWorking),
      upsertBucket(LiveLibrary, 'process', nextLive),
    ]);

    res.json({ working: savedWorking, live: savedLive, deleted: title });
  } catch (error) {
    next(error);
  }
});

app.post('/api/process/publish', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const versionStamp = Date.now();

    await LiveLibrary.deleteMany({ type: 'process' });
    await LiveLibrary.insertMany([buildEntryDoc('process', state.working.process, versionStamp)]);

    res.json({ live: state.working.process, versionStamp });
  } catch (error) {
    next(error);
  }
});

app.get('/api/transitions', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    res.json({
      working: state.working.transitions,
      live: state.live.transitions,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/transitions/save', async (req, res, next) => {
  try {
    const incomingWorking = req.body ? req.body.working : null;
    const updatedWorking = await upsertBucket(WorkingLibrary, 'transitions', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/transitions/working', async (_req, res, next) => {
  try {
    await ensureLibrarySeeded();

    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'transitions', null),
      upsertBucket(LiveLibrary, 'transitions', null),
    ]);

    res.json({ working: savedWorking, live: savedLive, deleted: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/transitions/publish', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const versionStamp = Date.now();

    await LiveLibrary.deleteMany({ type: 'transitions' });
    await LiveLibrary.insertMany([buildEntryDoc('transitions', state.working.transitions, versionStamp)]);

    res.json({ live: state.working.transitions, versionStamp });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(CLIENT_BUILD_PATH)) {
  app.use(express.static(CLIENT_BUILD_PATH));

  // BrowserRouter SPA catch-all: return index.html for clean client routes like /agents and /managers.
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(CLIENT_INDEX_PATH);
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: 'Internal server error',
  });
});

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
    await Promise.all([
      WorkingLibrary.syncIndexes(),
      LiveLibrary.syncIndexes(),
    ]);
    await ensureLibrarySeeded();
    console.log(`MongoDB connected: ${MONGO_URI}`);
    console.log(`Mongo pool config -> max: ${MONGO_OPTIONS.maxPoolSize}, min: ${MONGO_OPTIONS.minPoolSize}`);
    app.listen(PORT, HOST, () => {
      console.log(`QV backend (${NODE_ENV}) listening on http://127.0.0.1:${PORT}`);
      console.log(`Static build routing: ${fs.existsSync(CLIENT_BUILD_PATH) ? CLIENT_BUILD_PATH : 'client/build not found'}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

start();
