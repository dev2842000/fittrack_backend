const pool = require('../db/connection');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    const unreadCount = result.rows.filter(n => !n.is_read).length;
    res.json({ notifications: result.rows, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Internal helper — used by other controllers
const createNotification = async (userId, type, title, message) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)`,
      [userId, type, title, message]
    );
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
};

module.exports = { getNotifications, markRead, markAllRead, createNotification };
