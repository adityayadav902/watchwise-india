/*
 * Public, non-secret frontend configuration.
 *
 * NEVER put a YouTube API key here — this file is downloaded by every visitor.
 * The API key lives only as a secret on the backend (see backend/ and README.md).
 */
window.APP_CONFIG = {
  // URL of your deployed backend, no trailing slash. Leave '' to run in DEMO mode.
  // Example: 'https://watchwise-api.your-subdomain.workers.dev'
  API_BASE_URL: 'https://watchwise-api.ny5357053.workers.dev',

  REGION_CODE: 'IN',          // informational; the backend enforces regionCode=IN
  REFRESH_DAYS: 20,           // informational; the backend cache TTL is 20 days
  REQUEST_TIMEOUT_MS: 15000,
  MAX_QUERY_LENGTH: 120
};
