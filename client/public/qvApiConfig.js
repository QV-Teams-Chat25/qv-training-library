(function () {
  var DEFAULT_DEPLOYED_API_BASE_URL = 'https://qv-training-library.onrender.com/api';
  var hostname = (window.location.hostname || '').toLowerCase();
  var port = window.location.port || '';
  var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  var isSameOriginApiHost = hostname.indexOf('onrender.com') >= 0 || port === '5000';
  var isStandardWebPort = !port || port === '80' || port === '443';
  var defaultApiBaseUrl = DEFAULT_DEPLOYED_API_BASE_URL;

  if (isLocalhost) {
    defaultApiBaseUrl = 'http://localhost:5000/api';
  } else if (isSameOriginApiHost || isStandardWebPort) {
    defaultApiBaseUrl = window.location.origin + '/api';
  } else {
    defaultApiBaseUrl = window.location.protocol + '//' + window.location.hostname + ':5000/api';
  }

  window.__QV_API_CONFIG__ = window.__QV_API_CONFIG__ || {
    API_BASE_URL: defaultApiBaseUrl
  };
})();
