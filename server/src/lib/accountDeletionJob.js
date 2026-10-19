const db = require('../db');
const { createAccountDeletion } = require('./accountDeletion');
const { eraseAccountAlerts } = require('./alerts');
const { accountRequestsPending } = require('../middleware/auth');
const log = require('./logger');
let service;

function startAccountDeletion(io) {
  service = createAccountDeletion({
    store: db.getDeletionStore(), clerk: require('./clerk'),
    stripe: require('stripe')(process.env.STRIPE_SECRET_KEY), eraseAlerts: eraseAccountAlerts,
    deleteData: db.deleteAccountData, drain: id => !accountRequestsPending(id),
    disconnect: id => {
      require('../game/GameManager').eraseAccount(id, io);
      require('../game/higherLower').eraseAccount(id);
      require('./socketAuth').forgetAccount(id);
      for (const socket of io.sockets.sockets.values()) {
        if (socket.user?.userId === id) socket.disconnect(true);
      }
    },
  });
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const store = db.getDeletionStore();
      store.expire();
      for (const job of store.due()) {
        try { await service.process(job); }
        catch { job.state = 'retrying'; log.warn('Account deletion will retry'); }
        if (job.state !== 'complete') {
          job.next_attempt_at = Date.now() + 60_000;
          store.update(job.user_id, job);
        }
      }
    } catch { log.warn('Account deletion worker will retry'); }
    finally { running = false; }
  };
  setTimeout(run, 5000).unref();
  setInterval(run, 60_000).unref();
}

module.exports = { startAccountDeletion, requestDeletion: (...args) => service.request(...args),
  requestDeletedIdentity: id => service.requestDeletedIdentity(id),
};
