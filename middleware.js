const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.MAX_REQUESTS_PER_WINDOW || '100', 10);
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const requestCounts = new Map();

setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of requestCounts.entries()) {
    const active = timestamps.filter(t => t > windowStart);
    if (active.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, active);
    }
  }
}, CLEANUP_INTERVAL_MS);

function rateLimiter(req, res, next) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.ip
    || req.socket.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!requestCounts.has(clientIp)) {
    requestCounts.set(clientIp, []);
  }

  const timestamps = requestCounts.get(clientIp).filter(t => t > windowStart);
  requestCounts.set(clientIp, timestamps);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - timestamps[0]);
    res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfterMs,
      limit: MAX_REQUESTS_PER_WINDOW,
      windowMs: RATE_LIMIT_WINDOW_MS,
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

  const allowedTypes = [
    'url_verification',
    'event_callback',
    'app_rate_limited',
    'block_actions',
    'view_submission',
  ];
  if (!allowedTypes.includes(body.type)) {
    return res.status(400).json({
      error: `Invalid event type: ${body.type}`,
      allowedTypes,
    });
  }

  if (body.type === 'event_callback' && !body.event) {
    return res.status(400).json({ error: 'event_callback must include an event field' });
  }

  if (body.token && process.env.SLACK_VERIFICATION_TOKEN) {
    if (body.token !== process.env.SLACK_VERIFICATION_TOKEN) {
      return res.status(403).json({ error: 'Invalid verification token' });
    }
  }

  next();
}

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  req.requestId = requestId;
  res.set('X-Request-Id', requestId);

  const start = process.hrtime.bigint();
  const { method, url } = req;

  res.on('finish', () => {
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](JSON.stringify({
      requestId,
      method,
      url,
      status: res.statusCode,
      durationMs: elapsed.toFixed(2),
      contentLength: res.get('content-length') || 0,
      userAgent: req.headers['user-agent']?.slice(0, 100),
    }));
  });

  next();
}

function corsMiddleware(allowedOrigins = []) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin || '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Slack-Signature, X-Slack-Request-Timestamp');
      res.set('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  };
}

export { rateLimiter, validateSlackRequest, requestLogger, corsMiddleware };
