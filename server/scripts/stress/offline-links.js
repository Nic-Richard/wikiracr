// Preloaded by stress-rooms.js: every link is valid, so the test never calls Wikipedia,
// and memory, CPU and event loop delay are reported for the run summary.
const validator = require('../../src/game/validator');

validator.isValidLink = async () => true;
const { monitorEventLoopDelay } = require('node:perf_hooks');

const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();
let cpu = process.cpuUsage();
setInterval(() => {
  const used = process.cpuUsage(cpu);
  cpu = process.cpuUsage();
  const percent = Math.round((used.user + used.system) / 10_000);
  console.log(`STRESS_STATS ${Math.round(process.memoryUsage().rss / 1048576)} ${percent} ${Math.round(lag.max / 1e6)}`);
  lag.reset();
}, 1000).unref();
