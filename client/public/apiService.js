(function () {
  var config = window.__QV_API_CONFIG__ || {};
  var DEFAULT_DEPLOYED_API_BASE_URL = 'https://qv-training-library.onrender.com/api';
  var hostname = (window.location.hostname || '').toLowerCase();
  var port = window.location.port || '';
  var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  var isSameOriginApiHost = hostname.indexOf('onrender.com') >= 0 || port === '5000';
  var isStandardWebPort = !port || port === '80' || port === '443';
  var fallbackApiBaseUrl = DEFAULT_DEPLOYED_API_BASE_URL;

  if (isSameOriginApiHost) {
    fallbackApiBaseUrl = window.location.origin + '/api';
  } else if (!isStandardWebPort) {
    fallbackApiBaseUrl = window.location.protocol + '//' + window.location.hostname + ':5000/api';
  } else if (isLocalhost) {
    fallbackApiBaseUrl = 'http://localhost:5000/api';
  }

  var API_BASE_URL = config.API_BASE_URL || fallbackApiBaseUrl;
  var isHttpApi = API_BASE_URL.indexOf('http://') === 0 || API_BASE_URL.indexOf('https://') === 0;
  var REBUTTALS_WORKING_KEY = 'qvApiRebuttalsWorking';
  var REBUTTALS_LIVE_KEY = 'qvApiRebuttalsLive';
  var PROCESS_WORKING_KEY = 'qvProcessWorking';
  var PROCESS_LIVE_KEY = 'qvProcessLive';
  var TRANSITIONS_WORKING_KEY = 'qvTransitionsWorking';
  var TRANSITIONS_LIVE_KEY = 'qvTransitionsLive';
  var REQUEST_HEADERS = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache'
  };

  function delay(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isEmptyObject(value) {
    return !isRecord(value) || Object.keys(value).length === 0;
  }

  function hasProcessContent(value) {
    if (!isRecord(value)) {
      return false;
    }

    return Object.keys(value).some(function (key) {
      var entry = value[key];
      if (typeof entry === 'string') {
        return entry.trim() !== '';
      }

      return isRecord(entry) && Object.keys(entry).length > 0;
    });
  }

  function cacheBustUrl(path) {
    return API_BASE_URL + path + (path.indexOf('?') === -1 ? '?' : '&') + 'cachebust=' + Date.now();
  }

  function clearStorage(keys) {
    keys.forEach(function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        // Ignore storage access issues.
      }
    });
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore storage write failures.
    }
  }

  function deepMerge(currentData, newData) {
    if (!isRecord(currentData) || !isRecord(newData)) {
      return newData != null ? newData : currentData;
    }

    var merged = Object.assign({}, currentData);
    Object.keys(newData).forEach(function (key) {
      var currentValue = merged[key];
      var nextValue = newData[key];
      if (isRecord(currentValue) && isRecord(nextValue)) {
        merged[key] = deepMerge(currentValue, nextValue);
        return;
      }
      if (nextValue !== undefined) {
        merged[key] = nextValue;
      }
    });
    return merged;
  }

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readTransition(key) {
    var parsed = readJson(key, null);
    if (!parsed) {
      return null;
    }
    if (typeof parsed.fileName !== 'string' || typeof parsed.mimeType !== 'string' || typeof parsed.dataUrl !== 'string') {
      return null;
    }
    return parsed;
  }

  function getRebuttals() {
    if (isHttpApi) {
      return fetch(cacheBustUrl('/rebuttals'), {
        cache: 'no-store',
        headers: REQUEST_HEADERS
      }).then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch rebuttals');
        }
        return response.json();
      }).then(function (data) {
        var working = (data && data.working) || {};
        var live = (data && data.live) || {};

        if (isEmptyObject(working)) {
          clearStorage([REBUTTALS_WORKING_KEY]);
        } else {
          writeJson(REBUTTALS_WORKING_KEY, working);
        }

        if (isEmptyObject(live)) {
          clearStorage([REBUTTALS_LIVE_KEY, 'qvRebuttalsLive']);
        } else {
          writeJson(REBUTTALS_LIVE_KEY, live);
          writeJson('qvRebuttalsLive', live);
        }

        return {
          working: working,
          live: live
        };
      });
    }

    return delay(150).then(function () {
      return {
        working: readJson(REBUTTALS_WORKING_KEY, {}),
        live: readJson(REBUTTALS_LIVE_KEY, readJson('qvRebuttalsLive', {}))
      };
    });
  }

  function getProcess() {
    if (isHttpApi) {
      return fetch(cacheBustUrl('/process'), {
        cache: 'no-store',
        headers: REQUEST_HEADERS
      }).then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch process');
        }
        return response.json();
      }).then(function (data) {
        var working = (data && data.working) || { 'Call Process': '', Verification: '' };
        var live = (data && data.live) || { 'Call Process': '', Verification: '' };

        if (!hasProcessContent(working)) {
          clearStorage([PROCESS_WORKING_KEY]);
        } else {
          writeJson(PROCESS_WORKING_KEY, working);
        }

        if (!hasProcessContent(live)) {
          clearStorage([PROCESS_LIVE_KEY]);
        } else {
          writeJson(PROCESS_LIVE_KEY, live);
        }

        return {
          working: working,
          live: live
        };
      });
    }

    return delay(150).then(function () {
      return {
        working: readJson(PROCESS_WORKING_KEY, { 'Call Process': '', Verification: '' }),
        live: readJson(PROCESS_LIVE_KEY, { 'Call Process': '', Verification: '' })
      };
    });
  }

  function getTransitions() {
    if (isHttpApi) {
      return fetch(cacheBustUrl('/transitions'), {
        cache: 'no-store',
        headers: REQUEST_HEADERS
      }).then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch transitions');
        }
        return response.json();
      }).then(function (data) {
        var working = (data && data.working) || null;
        var live = (data && data.live) || null;

        if (!working || !working.dataUrl) {
          clearStorage([TRANSITIONS_WORKING_KEY]);
        } else {
          writeJson(TRANSITIONS_WORKING_KEY, working);
        }

        if (!live || !live.dataUrl) {
          clearStorage([TRANSITIONS_LIVE_KEY]);
        } else {
          writeJson(TRANSITIONS_LIVE_KEY, live);
        }

        return {
          working: working,
          live: live
        };
      });
    }

    return delay(150).then(function () {
      return {
        working: readTransition(TRANSITIONS_WORKING_KEY),
        live: readTransition(TRANSITIONS_LIVE_KEY)
      };
    });
  }

  window.QVApiService = {
    API_BASE_URL: API_BASE_URL,
    deepMerge: deepMerge,
    getRebuttals: getRebuttals,
    getProcess: getProcess,
    getTransitions: getTransitions
  };
})();
