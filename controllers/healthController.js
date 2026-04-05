const pool = require('../db/connection');

const getHealth = async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      message: 'FitTrack API is running',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'FitTrack API is running',
      db: 'disconnected',
      error: err.message,
    });
  }
};

module.exports = { getHealth };
