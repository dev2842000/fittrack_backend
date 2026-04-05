const pool = require('../db/connection');

// POST /api/push/subscribe
const subscribe = async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'Invalid subscription object' });

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4, user_id = $1`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/push/subscribe
const unsubscribe = async (req, res) => {
  const { endpoint } = req.body;
  try {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [req.user.id, endpoint]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/push/vapid-public-key
const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };
