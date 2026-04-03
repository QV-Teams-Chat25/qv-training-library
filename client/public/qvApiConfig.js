(function () {
  var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var defaultApiBaseUrl = isLocalhost ? 'http://localhost:5000/api' : window.location.origin + '/api';

  window.__QV_API_CONFIG__ = window.__QV_API_CONFIG__ || {
    API_BASE_URL: defaultApiBaseUrl
  };
})();
