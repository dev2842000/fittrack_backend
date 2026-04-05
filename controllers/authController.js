const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/connection');
const { sendOtp } = require('../lib/mailer');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// POST /api/auth/register
const register = async (req, res) => {
  const { name, password } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // If already verified, reject
      if (user.is_verified) return res.status(409).json({ error: 'Email already in use' });

      // Unverified — resend OTP
      const otp = generateOtp();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      await pool.query(
        'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE id = $3',
        [otp, expires, user.id]
      );
      await sendOtp(email, otp);
      return res.json({ message: 'OTP resent', email });
    }

    const hash = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO users (name, email, password, otp, otp_expires_at, is_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)`,
      [name, email, hash, otp, expires]
    );

    await sendOtp(email, otp);
    res.status(201).json({ message: 'OTP sent to your email', email });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!email || !otp)
    return res.status(400).json({ error: 'Email and OTP are required' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.status(400).json({ error: 'Email already verified' });
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > new Date(user.otp_expires_at))
      return res.status(400).json({ error: 'OTP expired' });

    await pool.query(
      'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    const token = generateToken(user);
    const { password: _, otp: __, otp_expires_at: ___, ...safeUser } = user;

    res.json({ token, user: { ...safeUser, is_verified: true } });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.status(400).json({ error: 'Email already verified' });

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE id = $3',
      [otp, expires, user.id]
    );

    await sendOtp(email, otp);
    res.json({ message: 'OTP resent' });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.is_verified)
      return res.status(403).json({ error: 'Please verify your email first', email });

    const token = generateToken(user);
    const { password: _, otp: __, otp_expires_at: ___, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, is_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { register, verifyOtp, resendOtp, login, getMe };
