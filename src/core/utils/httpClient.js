const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const logger = require('./logger');

// 1. TCP Keep-Alive Configuration (Performance Improvement)
// Node.js does not keep alive TCP connections by default. 
// We create agents that keep connections open for reuse, significantly reducing TLS handshake overhead.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

// 2. Initialize Axios Instance
const httpClient = axios.create({
  timeout: 10000, // Strict timeout to prevent event-loop blocking
  httpAgent,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 3. Configure Auto-Retry & Exponential Backoff
axiosRetry(httpClient, {
  retries: 3, // Retry up to 3 times
  retryDelay: (retryCount) => {
    // Exponential backoff: 1000ms, 2000ms, 4000ms...
    return retryCount * 1000;
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn(`Retrying request attempt ${retryCount}`, {
      url: requestConfig.url,
      method: requestConfig.method,
      errorMessage: error.message,
    });
  },
});

// Helper: Mask sensitive headers in logs
const maskSensitiveHeaders = (headers) => {
  if (!headers) return headers;
  const masked = { ...headers };
  const sensitiveKeys = ['authorization', 'service-token', 'cookie', 'x-api-key'];
  Object.keys(masked).forEach((key) => {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      masked[key] = '***MASKED***';
    }
  });
  return masked;
};

// 4. Request Interceptor (Observability & Tracking)
httpClient.interceptors.request.use(
  (config) => {
    // Generate a unique Request ID for tracing
    const requestId = config.headers['X-Request-ID'] || crypto.randomUUID();
    config.headers['X-Request-ID'] = requestId;
    
    // Store metadata for duration calculation
    config.metadata = { startTime: Date.now(), requestId };

    // (Optional) Log outgoing request, but be careful with large bodies in production
    // logger.info(`[${requestId}] Outgoing Request`, {
    //   method: config.method,
    //   url: config.url,
    //   headers: maskSensitiveHeaders(config.headers),
    // });

    return config;
  },
  (error) => Promise.reject(error)
);

// 5. Response Interceptor (Error Normalization & Duration Tracking)
httpClient.interceptors.response.use(
  (response) => {
    const { startTime, requestId } = response.config.metadata || {};
    const duration = startTime ? Date.now() - startTime : 0;

    // Log successful API call
    logger.info(`[${requestId}] HTTP Request Succeeded`, {
      method: response.config.method,
      url: response.config.url,
      status: response.status,
      durationMs: duration,
    });

    // We typically only need the data
    return response.data;
  },
  (error) => {
    const { startTime, requestId } = error.config?.metadata || {};
    const duration = startTime ? Date.now() - startTime : 0;

    // Standardize error structure
    const errorDetails = {
      requestId: requestId || 'UNKNOWN',
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status || 'NETWORK_ERROR',
      durationMs: duration,
      message: error.message,
      responseBody: error.response?.data, // The actual API error message body
      headers: maskSensitiveHeaders(error.config?.headers),
    };

    logger.error(`[${errorDetails.requestId}] HTTP Request Failed`, errorDetails);

    // Return the rejected promise so caller can handle it
    return Promise.reject(error);
  }
);

// 6. Export modular functions matching typical usage
module.exports = {
  get: (url, config = {}) => httpClient.get(url, config),
  post: (url, data, config = {}) => httpClient.post(url, data, config),
  put: (url, data, config = {}) => httpClient.put(url, data, config),
  patch: (url, data, config = {}) => httpClient.patch(url, data, config),
  delete: (url, config = {}) => httpClient.delete(url, config),
  instance: httpClient,
};
