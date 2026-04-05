const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test connection on startup
pool.query('SELECT 1')
  .then(() => console.log('Neon PostgreSQL connected successfully'))
  .catch(err => console.error('PostgreSQL connection error:', err.message));

module.exports = pool;
