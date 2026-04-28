const os = require('os');

function getSystemHealth() {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime),
    },
    memory: {
      heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
      externalMB: (memUsage.external / 1024 / 1024).toFixed(2),
    },
    cpu: {
      userMicroseconds: cpuUsage.user,
      systemMicroseconds: cpuUsage.system,
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      loadAverage: os.loadavg(),
      freeMemoryMB: (os.freemem() / 1024 / 1024).toFixed(2),
      totalMemoryMB: (os.totalmem() / 1024 / 1024).toFixed(2),
    },
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

function checkDependencies(dependencies) {
  const results = {};

  for (const [name, checkFn] of Object.entries(dependencies)) {
    try {
      const start = Date.now();
      const result = checkFn();
      const latencyMs = Date.now() - start;
      results[name] = { status: 'ok', latencyMs };
    } catch (err) {
      results[name] = { status: 'error', message: err.message };
    }
  }

  const allHealthy = Object.values(results).every(r => r.status === 'ok');
  return { healthy: allHealthy, dependencies: results };
}

module.exports = { getSystemHealth, formatUptime, checkDependencies };
