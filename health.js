const os = require('os');

const VERSION = process.env.APP_VERSION || 'unknown';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

function getSystemHealth() {
  const memUsage = process.memoryUsage();

  return {
    status: 'healthy',
    version: VERSION,
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    memory: {
      heapUsedMB: +(memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: +(memUsage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: +(memUsage.rss / 1024 / 1024).toFixed(2),
      heapUtilization: +(memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1),
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      loadAvg1m: os.loadavg()[0],
      freeMemoryMB: +(os.freemem() / 1024 / 1024).toFixed(0),
    },
  };
}

function formatUptime(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

async function checkDependencies(dependencies) {
  const results = {};

  const checks = Object.entries(dependencies).map(async ([name, checkFn]) => {
    const start = Date.now();
    try {
      await Promise.resolve(checkFn());
      results[name] = { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      results[name] = { status: 'error', latencyMs: Date.now() - start, message: err.message };
    }
  });

  await Promise.allSettled(checks);

  const healthy = Object.values(results).every(r => r.status === 'ok');
  const degraded = Object.values(results).some(r => r.status === 'ok');

  return {
    status: healthy ? 'healthy' : degraded ? 'degraded' : 'unhealthy',
    dependencies: results,
  };
}

module.exports = { getSystemHealth, formatUptime, checkDependencies };
