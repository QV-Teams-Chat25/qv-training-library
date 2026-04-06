const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'production';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quality_voices';
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

const WorkingLibrary = mongoose.models.WorkingLibrary || mongoose.model('WorkingLibrary', libraryEntrySchema, 'working_library');
const LiveLibrary = mongoose.models.LiveLibrary || mongoose.model('LiveLibrary', libraryEntrySchema, 'live_library');
const LegacyLibraryState = mongoose.models.LegacyLibraryState || mongoose.model('LegacyLibraryState', legacyStateSchema);

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

const createEmptyLibrarySnapshot = () => ({
  rebuttals: {},
  process: { ...emptyProcess },
  transitions: null,
});

const normalizeLibrarySnapshot = (snapshot) => {
  const source = isObjectRecord(snapshot) ? snapshot : {};

  return {
    rebuttals: sanitizeByType('rebuttals', source.rebuttals),
    process: sanitizeByType('process', source.process),
    transitions: sanitizeByType('transitions', source.transitions),
  };
};

const FALLBACK_STATE_PATH = path.join(__dirname, 'data', 'library-state.json');

const readFallbackState = () => {
  try {
    if (!fs.existsSync(FALLBACK_STATE_PATH)) {
      return {
        working: createEmptyLibrarySnapshot(),
        live: createEmptyLibrarySnapshot(),
      };
    }

    const raw = fs.readFileSync(FALLBACK_STATE_PATH, 'utf8');
    if (!raw.trim()) {
      return {
        working: createEmptyLibrarySnapshot(),
        live: createEmptyLibrarySnapshot(),
      };
    }

    const parsed = JSON.parse(raw);
    return {
      working: normalizeLibrarySnapshot(parsed.working),
      live: normalizeLibrarySnapshot(parsed.live),
    };
  } catch (error) {
    console.error('Failed to read fallback library state', error);
    return {
      working: createEmptyLibrarySnapshot(),
      live: createEmptyLibrarySnapshot(),
    };
  }
};

const writeFallbackState = (state) => {
  const normalizedState = {
    working: normalizeLibrarySnapshot(state && state.working),
    live: normalizeLibrarySnapshot(state && state.live),
  };

  fs.mkdirSync(path.dirname(FALLBACK_STATE_PATH), { recursive: true });
  fs.writeFileSync(FALLBACK_STATE_PATH, JSON.stringify(normalizedState, null, 2), 'utf8');
  return normalizedState;
};

const updateFallbackBucket = (scope, type, data) => {
  const currentState = readFallbackState();
  const nextState = {
    ...currentState,
    [scope]: {
      ...currentState[scope],
      [type]: sanitizeByType(type, data),
    },
  };

  return writeFallbackState(nextState)[scope][type];
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

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

const upsertBucket = async (Model, scope, type, data) => {
  const sanitized = sanitizeByType(type, data);

  if (!isDatabaseReady()) {
    return updateFallbackBucket(scope, type, sanitized);
  }

  const versionStamp = Date.now();

  try {
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

    const currentState = readFallbackState();
    writeFallbackState({
      ...currentState,
      [scope]: {
        ...currentState[scope],
        [type]: sanitized,
      },
    });

    return sanitized;
  } catch (error) {
    console.error(`Database write failed for ${scope}.${type}; using fallback storage instead.`, error);
    return updateFallbackBucket(scope, type, sanitized);
  }
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
  if (!isDatabaseReady()) {
    return readFallbackState();
  }

  try {
    await ensureLibrarySeeded();

    const [workingDocs, liveDocs] = await Promise.all([
      WorkingLibrary.find({}).lean(),
      LiveLibrary.find({}).lean(),
    ]);

    const state = {
      working: buildSnapshotFromDocs(workingDocs),
      live: buildSnapshotFromDocs(liveDocs),
    };

    writeFallbackState(state);
    return state;
  } catch (error) {
    console.error('Database load failed; serving fallback library state instead.', error);
    return readFallbackState();
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'qv-training-library-api' });
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
    const updatedWorking = await upsertBucket(WorkingLibrary, 'working', 'rebuttals', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

const handleDeleteRebuttal = async (req, res, next) => {
  try {
    const state = await loadLibraryState();
    const campaign = req.params.campaign;
    const title = req.params.title;

    const nextWorking = removeRebuttalCampaign(state.working.rebuttals, campaign, title);
    const nextLive = removeRebuttalCampaign(state.live.rebuttals, campaign, title);

    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'working', 'rebuttals', nextWorking),
      upsertBucket(LiveLibrary, 'live', 'rebuttals', nextLive),
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
    const savedLive = await upsertBucket(LiveLibrary, 'live', 'rebuttals', state.working.rebuttals);
    res.json({ live: savedLive, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/live/sync', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const [rebuttalsLive, processLive, transitionsLive] = await Promise.all([
      upsertBucket(LiveLibrary, 'live', 'rebuttals', state.working.rebuttals),
      upsertBucket(LiveLibrary, 'live', 'process', state.working.process),
      upsertBucket(LiveLibrary, 'live', 'transitions', state.working.transitions),
    ]);

    res.json({
      rebuttalsLive,
      processLive,
      transitionsLive,
      versionStamp: Date.now(),
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
    const updatedWorking = await upsertBucket(WorkingLibrary, 'working', 'process', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/process/working/:category/:title', async (req, res, next) => {
  try {
    const state = await loadLibraryState();
    const category = req.params.category;
    const title = req.params.title;

    if (category !== 'Call Process' && category !== 'Verification') {
      return res.status(400).json({ message: 'Invalid process category' });
    }

    const nextWorking = removeProcessTitle(state.working.process, category, title);
    const nextLive = removeProcessTitle(state.live.process, category, title);

    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'working', 'process', nextWorking),
      upsertBucket(LiveLibrary, 'live', 'process', nextLive),
    ]);

    res.json({ working: savedWorking, live: savedLive, deleted: title });
  } catch (error) {
    next(error);
  }
});

app.post('/api/process/publish', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const savedLive = await upsertBucket(LiveLibrary, 'live', 'process', state.working.process);
    res.json({ live: savedLive, versionStamp: Date.now() });
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
    const updatedWorking = await upsertBucket(WorkingLibrary, 'working', 'transitions', incomingWorking);
    res.json({ working: updatedWorking, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/transitions/working', async (_req, res, next) => {
  try {
    const [savedWorking, savedLive] = await Promise.all([
      upsertBucket(WorkingLibrary, 'working', 'transitions', null),
      upsertBucket(LiveLibrary, 'live', 'transitions', null),
    ]);

    res.json({ working: savedWorking, live: savedLive, deleted: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/transitions/publish', async (_req, res, next) => {
  try {
    const state = await loadLibraryState();
    const savedLive = await upsertBucket(LiveLibrary, 'live', 'transitions', state.working.transitions);
    res.json({ live: savedLive, versionStamp: Date.now() });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(CLIENT_BUILD_PATH)) {
  app.use(express.static(CLIENT_BUILD_PATH));

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
  } catch (error) {
    console.error('MongoDB unavailable; starting with fallback file storage.', error);
  }

  app.listen(PORT, HOST, () => {
    console.log(`QV backend (${NODE_ENV}) listening on http://127.0.0.1:${PORT}`);
    console.log(`Static build routing: ${fs.existsSync(CLIENT_BUILD_PATH) ? CLIENT_BUILD_PATH : 'client/build not found'}`);
    console.log(`Storage mode: ${isDatabaseReady() ? 'mongodb + fallback backup' : 'fallback file storage only'}`);
  });
};

start();
