// Preloaded by stress-rooms.js: every link is valid, so the test never calls Wikipedia,
// and memory is reported for the run summary.
const validator = require('../../src/game/validator');

validator.isValidLink = async () => true;
setInterval(() => console.log(`STRESS_RSS ${Math.round(process.memoryUsage().rss / 1048576)}`), 1000).unref();
