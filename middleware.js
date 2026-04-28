const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 100;

const requestCounts = new Map();

function rateLimiter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!requestCounts.has(clientIp)) {
    requestCounts.set(clientIp, []);
  }

  const timestamps = requestCounts.get(clientIp).filter(t => t > windowStart);
  requestCounts.set(clientIp, timestamps);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - timestamps[0]),
    });
  }

  timestamps.push(now);
  next();
}

function validateSlackRequest(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be JSON' });
  }

  if (!body.type) {
    return res.status(400).json({ error: 'Missing required field: type' });
  }

  const allowedTypes = ['url_verification', 'event_callback', 'app_rate_limited'];
  if (!allowedTypes.includes(body.type)) {
    return res.status(400).json({
      error: `Invalid event type: ${body.type}`,
      allowedTypes,
    });
  }

  if (body.type === 'event_callback' && !body.event) {
    return res.status(400).json({ error: 'event_callback must include an event field' });
  }

  next();
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    console[level](`${method} ${url} ${res.statusCode} ${duration}ms`);
  });

  next();
}

export { rateLimiter, validateSlackRequest, requestLogger };
