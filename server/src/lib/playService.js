const db = require('../db');
const api = require('./playApi');
let service;
function getPlayBilling() {
  service ||= require('./playBilling').createPlayBilling({ store: db.getPlayStore(), deletions: db.getDeletionStore(),
    clerk: require('./clerk'), api, sendAlert: require('./alerts').sendAlert });
  return service;
}
function startPlayReconciliation() {
  let running = false;
  const run = async () => {
    if (running || !api.configured()) return;
    running = true;
    try {
      for (const userId of db.getPlayStore().due()) {
        try { await getPlayBilling().refresh(userId); }
        catch { require('./logger').warn('Google Play subscription refresh will retry'); }
      }
    } finally { running = false; }
  };
  setInterval(run, 5 * 60_000).unref();
  setTimeout(run, 15_000).unref();
}
function proAccess(user) {
  const metadata = user.publicMetadata || {};
  const store = db.getPlayStore();
  if (metadata.playPro !== undefined || store?.status(user.id)) return !!metadata.stripeSubscriptionId || !!store?.active(user.id);
  return !!metadata.isPro;
}
module.exports = { getPlayBilling, startPlayReconciliation, proAccess };
