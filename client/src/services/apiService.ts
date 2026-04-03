const resolveApiBaseUrl = () => {
  const envBaseUrl = process.env.REACT_APP_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return '/api';
  }

  const { protocol, hostname, port } = window.location;
  const isSameOriginProduction = !port || port === '80' || port === '443' || port === '5000';

  if (isSameOriginProduction) {
    return '/api';
  }

  return `${protocol}//${hostname}:5000/api`;
};

export const API_BASE_URL = resolveApiBaseUrl();

export type RebuttalScript = {
  title: string;
  content: string;
  deliveryTip?: string;
};

export type RebuttalValue = string | RebuttalScript | Record<string, string | RebuttalScript>;
export type RebuttalsMap = Record<string, RebuttalValue>;
export type ProcessValue = string | RebuttalScript | Record<string, string>;
export type ProcessMap = Record<'Call Process' | 'Verification', ProcessValue>;
export type TransitionFileRef = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

type RebuttalsResponse = {
  working: RebuttalsMap;
  live: RebuttalsMap;
};

type RebuttalsLiveResponse = {
  live: RebuttalsMap;
};

type ProcessResponse = {
  working: ProcessMap;
  live: ProcessMap;
};

type TransitionsResponse = {
  working: TransitionFileRef | null;
  live: TransitionFileRef | null;
};

type PublishLiveResponse = {
  rebuttalsLive: RebuttalsMap;
  processLive: ProcessMap;
  transitionsLive: TransitionFileRef | null;
};

const EMPTY_PROCESS: ProcessMap = {
  'Call Process': '',
  Verification: '',
};

const REQUEST_NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
};

const STORAGE_KEYS = {
  rebuttalsWorking: 'qvApiRebuttalsWorking',
  rebuttalsLive: 'qvApiRebuttalsLive',
  legacyRebuttalsLive: 'qvRebuttalsLive',
  processWorking: 'qvProcessWorking',
  processLive: 'qvProcessLive',
  transitionsWorking: 'qvTransitionsWorking',
  transitionsLive: 'qvTransitionsLive',
};

const buildCacheBustUrl = (path: string) => `${API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}cachebust=${Date.now()}`;

const clearBrowserCache = (...keys: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore browser storage access issues.
    }
  });

  if ('caches' in window) {
    void caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))).catch(() => {
      // Ignore Cache Storage cleanup failures.
    });
  }
};

const isEmptyRecord = (value: unknown) => !value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value as Record<string, unknown>).length === 0;

const hasProcessContent = (value: ProcessMap) => Object.values(value).some((entry) => {
  if (typeof entry === 'string') {
    return entry.trim() !== '';
  }

  if (entry && typeof entry === 'object') {
    return Object.keys(entry as Record<string, unknown>).length > 0;
  }

  return false;
});

const handleJsonResponse = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
};

export const getRebuttals = async (): Promise<RebuttalsResponse> => {
  const response = await fetch(buildCacheBustUrl('/rebuttals'), {
    cache: 'no-store',
    headers: REQUEST_NO_CACHE_HEADERS,
  });
  const data = await handleJsonResponse(response);
  const working = (data && data.working) || {};
  const live = (data && data.live) || {};

  if (isEmptyRecord(working)) {
    clearBrowserCache(STORAGE_KEYS.rebuttalsWorking);
  }

  if (isEmptyRecord(live)) {
    clearBrowserCache(STORAGE_KEYS.rebuttalsLive, STORAGE_KEYS.legacyRebuttalsLive);
  }

  return {
    working,
    live,
  };
};

export const getLiveRebuttals = async (): Promise<RebuttalsLiveResponse> => {
  const response = await fetch(buildCacheBustUrl('/rebuttals/live'), {
    cache: 'no-store',
    headers: REQUEST_NO_CACHE_HEADERS,
  });
  const data = await handleJsonResponse(response);
  const live = (data && data.live) || {};

  if (isEmptyRecord(live)) {
    clearBrowserCache(STORAGE_KEYS.rebuttalsLive, STORAGE_KEYS.legacyRebuttalsLive);
  }

  return {
    live,
  };
};

export const saveRebuttals = async (data: RebuttalsMap): Promise<RebuttalsMap> => {
  const response = await fetch(`${API_BASE_URL}/rebuttals/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || data;
};

export const deleteRebuttalDraft = async (campaign: string, title?: string): Promise<RebuttalsMap> => {
  const deletePath = title
    ? `${API_BASE_URL}/rebuttals/working/${encodeURIComponent(campaign)}/${encodeURIComponent(title)}`
    : `${API_BASE_URL}/rebuttals/working/${encodeURIComponent(campaign)}`;
  const response = await fetch(deletePath, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || {};
};

export const publishRebuttals = async (data: RebuttalsMap): Promise<RebuttalsMap> => {
  const response = await fetch(`${API_BASE_URL}/rebuttals/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.live) || {};
};

export const getProcess = async (): Promise<ProcessResponse> => {
  const response = await fetch(buildCacheBustUrl('/process'), {
    cache: 'no-store',
    headers: REQUEST_NO_CACHE_HEADERS,
  });
  const data = await handleJsonResponse(response);
  const working = (data && data.working) || { ...EMPTY_PROCESS };
  const live = (data && data.live) || { ...EMPTY_PROCESS };

  if (!hasProcessContent(working)) {
    clearBrowserCache(STORAGE_KEYS.processWorking);
  }

  if (!hasProcessContent(live)) {
    clearBrowserCache(STORAGE_KEYS.processLive);
  }

  return {
    working,
    live,
  };
};

export const saveProcess = async (data: ProcessMap): Promise<ProcessMap> => {
  const response = await fetch(`${API_BASE_URL}/process/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || data;
};

export const deleteProcessDraft = async (category: 'Call Process' | 'Verification', title: string): Promise<ProcessMap> => {
  const response = await fetch(`${API_BASE_URL}/process/working/${encodeURIComponent(category)}/${encodeURIComponent(title)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || { ...EMPTY_PROCESS };
};

export const publishProcess = async (data: ProcessMap): Promise<ProcessMap> => {
  const response = await fetch(`${API_BASE_URL}/process/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.live) || { ...EMPTY_PROCESS };
};

export const getTransitions = async (): Promise<TransitionsResponse> => {
  const response = await fetch(buildCacheBustUrl('/transitions'), {
    cache: 'no-store',
    headers: REQUEST_NO_CACHE_HEADERS,
  });
  const data = await handleJsonResponse(response);
  const working = (data && data.working) || null;
  const live = (data && data.live) || null;

  if (!working || !working.dataUrl) {
    clearBrowserCache(STORAGE_KEYS.transitionsWorking);
  }

  if (!live || !live.dataUrl) {
    clearBrowserCache(STORAGE_KEYS.transitionsLive);
  }

  return {
    working,
    live,
  };
};

export const saveTransitions = async (data: TransitionFileRef): Promise<TransitionFileRef> => {
  const response = await fetch(`${API_BASE_URL}/transitions/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || data;
};

export const deleteTransitionsDraft = async (): Promise<TransitionFileRef | null> => {
  const response = await fetch(`${API_BASE_URL}/transitions/working`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.working) || null;
};

export const publishTransitions = async (data: TransitionFileRef | null): Promise<TransitionFileRef | null> => {
  const response = await fetch(`${API_BASE_URL}/transitions/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ working: data }),
  });
  const payload = await handleJsonResponse(response);
  return (payload && payload.live) || null;
};

export const publishLive = async (
  _rebuttalsWorking?: RebuttalsMap,
  _processWorking?: ProcessMap,
  _transitionsWorking?: TransitionFileRef | null
): Promise<PublishLiveResponse> => {
  const response = await fetch(buildCacheBustUrl('/live/sync'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...REQUEST_NO_CACHE_HEADERS,
    },
    body: JSON.stringify({ requestedAt: Date.now() }),
  });
  const payload = await handleJsonResponse(response);
  return {
    rebuttalsLive: (payload && payload.rebuttalsLive) || {},
    processLive: (payload && payload.processLive) || { ...EMPTY_PROCESS },
    transitionsLive: (payload && payload.transitionsLive) || null,
  };
};
