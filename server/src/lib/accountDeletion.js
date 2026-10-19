function summary(job) {
  return job ? { state: job.state, requested_at: job.requested_at, completed_at: job.completed_at } : { state: 'none' };
}

function createAccountDeletion({ store, clerk, stripe, eraseAlerts, deleteData, drain = () => true, disconnect = () => {} }) {
  async function request(userId, confirmation) {
    if (confirmation !== 'DELETE') return { status: 400, body: { error: 'Type DELETE to confirm permanent account deletion.' } };
    const existing = store.get(userId);
    if (existing) return { status: 202, body: summary(existing) };
    const user = await clerk.users.getUser(userId);
    const references = [...new Set([userId, ...user.emailAddresses.map(email => email.emailAddress),
      user.publicMetadata?.stripeCustomerId, user.publicMetadata?.stripeSubscriptionId].filter(Boolean))];
    const job = store.request(userId, references);
    disconnect(userId);
    return { status: 202, body: summary(job) };
  }
  async function process(job, now = Date.now()) {
    if (!drain(job.user_id)) return;
    // Recheck after in-flight checkouts settle, before removing the authentication identity.
    for await (const checkout of stripe.checkout.sessions.list({ status: 'open', limit: 100 })) {
      if (checkout.metadata?.clerkUserId === job.user_id) await stripe.checkout.sessions.expire(checkout.id);
    }
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      if (subscription.metadata?.clerkUserId === job.user_id || job.references.includes(subscription.id)) {
        job.references = [...new Set([...job.references, subscription.id, subscription.customer].filter(Boolean))];
        store.update(job.user_id, job);
        if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
          await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
        }
      }
    }
    if (!job.alerts_erased) {
      const result = await eraseAlerts(job.references, job.cursor);
      job.cursor = result.cursor;
      job.alerts_erased = result.complete;
      store.update(job.user_id, job);
      if (!job.alerts_erased) return;
    }
    disconnect(job.user_id);
    deleteData(job.user_id);
    try { await clerk.users.deleteUser(job.user_id); }
    catch (error) { if (error.status !== 404 && error.statusCode !== 404) throw error; }
    job.state = 'complete';
    job.completed_at = now;
    job.cursor = {};
    store.update(job.user_id, job);
  }
  return { request, process, requestDeletedIdentity: userId => {
    const job = store.request(userId, [userId]);
    disconnect(userId);
    return summary(job);
  } };
}

module.exports = { createAccountDeletion, summary };
