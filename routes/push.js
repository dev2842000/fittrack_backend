const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getVapidPublicKey } = require('../controllers/pushController');
const { protect } = require('../middleware/auth');

router.get('/vapid-public-key', getVapidPublicKey);

// Dev-only: trigger push without auth — usage: POST /api/push/test-dev { userId: 2 }
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-dev', async (req, res) => {
    const { sendPushToUser } = require('../lib/pushService');
    const { userId, title = 'Test 🔔', body = 'This is a test push notification!' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await sendPushToUser(userId, title, body, '/dashboard');
    res.json({ success: true });
  });
}

router.use(protect);
router.post('/subscribe', subscribe);
router.delete('/subscribe', unsubscribe);
router.post('/test', async (req, res) => {
  const { sendPushToUser } = require('../lib/pushService');
  const { createNotification } = require('../controllers/notificationsController');
  await createNotification(req.user.id, 'STREAK', 'Test Notification 🔔', 'Push notifications are working correctly!');
  await sendPushToUser(req.user.id, 'Test Notification 🔔', 'Push notifications are working correctly!', '/dashboard');
  res.json({ success: true });
});

module.exports = router;
