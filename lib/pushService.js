const pool = require('../db/connection');

let webpush;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.GMAIL_USER}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch {
  console.warn('web-push not available — push notifications disabled');
}

const sendPushToUser = async (userId, title, body, url = '/dashboard') => {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;

  try {
    const result = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    const payload = JSON.stringify({ title, body, url });

    for (const sub of result.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        console.log('[Push] Sent to user', userId);
      } catch (err) {
        console.error('[Push] Failed:', err.statusCode, err.body || err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
          console.log('[Push] Removed stale subscription');
        }
      }
    }
  } catch (err) {
    console.error('sendPushToUser error:', err.message);
  }
};

module.exports = { sendPushToUser };
