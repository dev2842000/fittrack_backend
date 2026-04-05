const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

// GET /api/profile
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, age, sex, height_cm, bio, is_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  const { name, age, sex, height_cm, bio } = req.body;

  if (name !== undefined && !name.trim())
    return res.status(400).json({ error: 'Name cannot be empty' });

  if (age !== undefined && age !== null && (age < 10 || age > 120))
    return res.status(400).json({ error: 'Enter a valid age' });

  try {
    const result = await pool.query(
      `UPDATE users
       SET name      = COALESCE($1, name),
           age       = $2,
           sex       = $3,
           height_cm = $4,
           bio       = $5
       WHERE id = $6
       RETURNING id, name, email, age, sex, height_cm, bio, is_verified, created_at`,
      [
        name?.trim() || null,
        age ?? null,
        sex ?? null,
        height_cm ?? null,
        bio?.trim() ?? null,
        req.user.id,
      ]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/profile/password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both fields are required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile, changePassword };
