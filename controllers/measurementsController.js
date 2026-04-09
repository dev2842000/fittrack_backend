const pool = require('../db/connection');

// POST /api/measurements
const logMeasurements = async (req, res) => {
  const { date, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO measurements
         (user_id, logged_date, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, logged_date)
       DO UPDATE SET
         chest_cm      = COALESCE(EXCLUDED.chest_cm, measurements.chest_cm),
         waist_cm      = COALESCE(EXCLUDED.waist_cm, measurements.waist_cm),
         hips_cm       = COALESCE(EXCLUDED.hips_cm, measurements.hips_cm),
         left_arm_cm   = COALESCE(EXCLUDED.left_arm_cm, measurements.left_arm_cm),
         right_arm_cm  = COALESCE(EXCLUDED.right_arm_cm, measurements.right_arm_cm),
         left_thigh_cm = COALESCE(EXCLUDED.left_thigh_cm, measurements.left_thigh_cm),
         right_thigh_cm= COALESCE(EXCLUDED.right_thigh_cm, measurements.right_thigh_cm)
       RETURNING *`,
      [
        req.user.id,
        date || new Date().toISOString().split('T')[0],
        chest_cm || null,
        waist_cm || null,
        hips_cm || null,
        left_arm_cm || null,
        right_arm_cm || null,
        left_thigh_cm || null,
        right_thigh_cm || null,
      ]
    );
    res.status(201).json({ measurement: result.rows[0] });
  } catch (err) {
    console.error('Log measurements error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/measurements
const getMeasurements = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, logged_date AS date, chest_cm, waist_cm, hips_cm,
              left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm
       FROM measurements WHERE user_id = $1 ORDER BY logged_date ASC`,
      [req.user.id]
    );
    const measurements = result.rows.map(r => ({
      ...r,
      chest_cm:       r.chest_cm       ? parseFloat(r.chest_cm)       : null,
      waist_cm:       r.waist_cm       ? parseFloat(r.waist_cm)       : null,
      hips_cm:        r.hips_cm        ? parseFloat(r.hips_cm)        : null,
      left_arm_cm:    r.left_arm_cm    ? parseFloat(r.left_arm_cm)    : null,
      right_arm_cm:   r.right_arm_cm   ? parseFloat(r.right_arm_cm)   : null,
      left_thigh_cm:  r.left_thigh_cm  ? parseFloat(r.left_thigh_cm)  : null,
      right_thigh_cm: r.right_thigh_cm ? parseFloat(r.right_thigh_cm) : null,
    }));
    res.json({ measurements });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { logMeasurements, getMeasurements };
