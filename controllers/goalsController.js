const pool = require('../db/connection');

// GET /api/goals
const getGoal = async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const [goalRes, weekRes] = await Promise.all([
      pool.query('SELECT * FROM user_goals WHERE user_id = $1', [req.user.id]),
      pool.query(
        `SELECT COUNT(*) AS count FROM workouts
         WHERE user_id = $1 AND completed_at IS NOT NULL AND completed_at >= $2`,
        [req.user.id, monday.toISOString()]
      ),
    ]);

    const goal = goalRes.rows[0];
    const thisWeek = parseInt(weekRes.rows[0].count);

    res.json({
      weeklyTarget: goal ? parseInt(goal.weekly_workouts) : null,
      thisWeek,
      achieved: goal ? thisWeek >= parseInt(goal.weekly_workouts) : false,
    });
  } catch (err) {
    console.error('Get goal error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/goals  { weekly_workouts: 3 }
const setGoal = async (req, res) => {
  const { weekly_workouts } = req.body;
  if (!weekly_workouts || weekly_workouts < 1 || weekly_workouts > 7)
    return res.status(400).json({ error: 'weekly_workouts must be 1–7' });

  try {
    const result = await pool.query(
      `INSERT INTO user_goals (user_id, weekly_workouts)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET weekly_workouts = $2
       RETURNING *`,
      [req.user.id, weekly_workouts]
    );
    res.json({ goal: result.rows[0] });
  } catch (err) {
    console.error('Set goal error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getGoal, setGoal };
